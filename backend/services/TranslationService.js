/**
 * TranslationService
 *
 * Fast, cached, batched translation service supporting Urban Pulse's 6
 * end-to-end languages: en, hi, ta, te, ml, kn.
 *
 * Speed & reliability design:
 *  - In-memory LRU + TTL cache keyed by (targetLang, sha256(text))
 *  - Deduplicates identical strings and skips non-translatable tokens
 *    (numbers, IDs, URLs, pure symbols)
 *  - Batches up to 20 strings into a single Groq JSON completion call
 *    (ultra-low latency) with concurrent chunk execution
 *  - Falls back to Sarvam AI (/translate) when Groq is unavailable or fails,
 *    and gracefully returns original text if all providers fail
 */

const crypto = require('crypto');
const axios = require('axios');

const SUPPORTED_LANGUAGES = ['en', 'hi', 'ta', 'te', 'ml', 'kn'];

const LANGUAGE_NAMES = {
  en: 'English',
  hi: 'Hindi',
  ta: 'Tamil',
  te: 'Telugu',
  ml: 'Malayalam',
  kn: 'Kannada',
};

const SARVAM_LANGUAGE_MAP = {
  en: 'en-IN',
  hi: 'hi-IN',
  ta: 'ta-IN',
  te: 'te-IN',
  ml: 'ml-IN',
  kn: 'kn-IN',
};

const GROQ_API_BASE = (process.env.GROQ_API_BASE || 'https://api.groq.com/openai/v1').replace(/\/+$/, '');
const GROQ_PRIMARY_MODEL = process.env.GROQ_TRANSLATE_MODEL || 'llama-3.1-8b-instant';
const GROQ_FALLBACK_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
const REQUEST_TIMEOUT_MS = 10000;
const CHUNK_SIZE = 20;
const MAX_CACHE_ENTRIES = 5000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// LRU cache: key -> { value, expiresAt }
const cache = new Map();
const inFlight = new Map();

function normalizeLang(lang) {
  if (typeof lang !== 'string') return 'en';
  const base = lang.trim().toLowerCase().split(/[-_]/)[0];
  return SUPPORTED_LANGUAGES.includes(base) ? base : 'en';
}

function hashText(text) {
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 24);
}

function makeCacheKey(text, targetLang) {
  return `${targetLang}:${hashText(text)}`;
}

function getCached(text, targetLang) {
  const key = makeCacheKey(text, targetLang);
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  // Refresh LRU order
  cache.delete(key);
  cache.set(key, entry);
  return entry.value;
}

function setCached(text, targetLang, translated) {
  if (!translated || typeof translated !== 'string') return;
  const key = makeCacheKey(text, targetLang);
  if (cache.has(key)) cache.delete(key);
  cache.set(key, {
    value: translated,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
  while (cache.size > MAX_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
  }
}

function isNonTranslatable(text) {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length <= 1) return true;
  // URLs, emails, UUIDs, numbers/units/symbols only
  if (/^https?:\/\/\S+$/i.test(trimmed)) return true;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return true;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) return true;
  if (/^[\d\s.,:%+\-/#()°]+$/.test(trimmed)) return true;
  return false;
}

// Fast heuristic: if target is English and string is pure ASCII with no non-ASCII scripts,
// still allow translation if caller passed non-English? Wait: pure ASCII is usually English,
// Romanized Hindi/Tamil etc. could exist, so only skip for 'en' if it's purely numeric/symbolic.
// For Indian scripts, if string already contains characters exclusively in target script, skip API call.
const SCRIPT_RANGES = {
  hi: /[\u0900-\u097F]/,
  ta: /[\u0B80-\u0BFF]/,
  te: /[\u0C00-\u0C7F]/,
  kn: /[\u0C80-\u0CFF]/,
  ml: /[\u0D00-\u0D7F]/,
};

function alreadyInTargetScript(text, targetLang) {
  if (targetLang === 'en') {
    // If no Indic/non-Latin letters at all, likely already English
    return !/[\u0900-\u0DFF\u4E00-\u9FFF]/.test(text);
  }
  const targetRegex = SCRIPT_RANGES[targetLang];
  if (!targetRegex) return false;
  // Must contain target script chars and no Latin word sequences (>2 letters) except acronyms/numbers
  const hasTarget = targetRegex.test(text);
  const hasLongLatin = /[a-zA-Z]{2,}/.test(text);
  return hasTarget && !hasLongLatin;
}

async function callGroqBatch(items, targetLang, model = GROQ_PRIMARY_MODEL) {
  const apiKey = (process.env.GROQ_API_KEY || '').trim();
  if (!apiKey) return null;

  const targetName = LANGUAGE_NAMES[targetLang] || 'English';
  const numberedInput = items.map((text, idx) => ({ id: idx, text }));

  const scriptRule = targetLang !== 'en'
    ? `When translating into ${targetName} (${targetLang}), phonetically transliterate ALL person names, usernames, place names, and department or organization names into ${targetName} script (e.g., "Arun Nanthakumar" -> Devanagari/Tamil/Telugu/etc., never leave names or words in English Latin letters). Do NOT translate or modify email addresses, URLs, hashtags, or alphanumeric record IDs.`
    : 'Preserve proper nouns, emails, URLs, hashtags, and record IDs.';

  const systemPrompt = [
    `You are a fast, accurate civic-portal translator translating UI, citizen names, and complaint text into ${targetName} (${targetLang}).`,
    'Translate every item in the input array accurately and naturally into the target language.',
    scriptRule,
    'Translate measurement units (such as cm, km, m) naturally into the target language while preserving numeric digits and markdown formatting (**bold**, bullets).',
    'If an item is already purely in the target language and script, return it unchanged.',
    'Return ONLY valid JSON of the exact shape: {"translations": ["...", "..."]} with the EXACT same length and order as the input array.',
  ].join(' ');

  const response = await axios.post(
    `${GROQ_API_BASE}/chat/completions`,
    {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: JSON.stringify({ targetLang, items: numberedInput }) },
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: REQUEST_TIMEOUT_MS,
    }
  );

  const rawContent = response.data?.choices?.[0]?.message?.content?.trim();
  if (!rawContent) return null;

  const parsed = JSON.parse(rawContent);
  const list = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.translations)
    ? parsed.translations
    : null;

  if (!Array.isArray(list) || list.length !== items.length) {
    return null;
  }

  const mapped = list.map((val) => {
    if (typeof val === 'string' && val.trim()) return val.trim();
    if (val && typeof val === 'object' && typeof val.text === 'string' && val.text.trim()) {
      return val.text.trim();
    }
    return null;
  });

  // If every element failed to parse as a string, treat the batch response as invalid
  if (mapped.every((v) => v === null)) {
    return null;
  }

  return mapped;
}

async function callSarvamSingle(text, targetLang) {
  const apiKey = (process.env.SARVAM_API_KEY || '').trim();
  const targetCode = SARVAM_LANGUAGE_MAP[targetLang];
  if (!apiKey || !targetCode) return null;

  const response = await axios.post(
    'https://api.sarvam.ai/translate',
    {
      input: text.slice(0, 1000),
      source_language_code: 'auto',
      target_language_code: targetCode,
      mode: 'formal',
      enable_preprocessing: true,
    },
    {
      headers: {
        'api-subscription-key': apiKey,
        'Content-Type': 'application/json',
      },
      timeout: REQUEST_TIMEOUT_MS,
    }
  );

  const translated = response.data?.translated_text;
  return typeof translated === 'string' && translated.trim() ? translated.trim() : null;
}

async function translateChunk(uniqueChunk, targetLang) {
  if (uniqueChunk.length === 0) return { results: [], provider: 'cache' };

  // Try Groq primary model first
  try {
    const groqOut = await callGroqBatch(uniqueChunk, targetLang, GROQ_PRIMARY_MODEL);
    if (groqOut) {
      return { results: groqOut, provider: 'groq' };
    }
  } catch (err) {
    console.warn(`⚠️ Groq primary translate (${GROQ_PRIMARY_MODEL}) failed:`, err.message);
  }

  // Try Groq fallback model if different
  if (GROQ_FALLBACK_MODEL && GROQ_FALLBACK_MODEL !== GROQ_PRIMARY_MODEL) {
    try {
      const groqFallbackOut = await callGroqBatch(uniqueChunk, targetLang, GROQ_FALLBACK_MODEL);
      if (groqFallbackOut) {
        return { results: groqFallbackOut, provider: 'groq_fallback' };
      }
    } catch (err) {
      console.warn(`⚠️ Groq fallback translate (${GROQ_FALLBACK_MODEL}) failed:`, err.message);
    }
  }

  // Fallback to Sarvam AI for up to chunk items in parallel
  if ((process.env.SARVAM_API_KEY || '').trim()) {
    try {
      const sarvamResults = await Promise.all(
        uniqueChunk.map(async (text) => {
          try {
            const out = await callSarvamSingle(text, targetLang);
            return out || text;
          } catch {
            return text;
          }
        })
      );
      return { results: sarvamResults, provider: 'sarvam' };
    } catch (err) {
      console.warn('⚠️ Sarvam translate failed:', err.message);
    }
  }

  return { results: uniqueChunk, provider: 'passthrough' };
}

/**
 * Translate an array of strings into `targetLang` using cache, deduplication,
 * chunked batching, and multi-provider fallback.
 *
 * @param {string[]} texts
 * @param {string} targetLang
 * @returns {Promise<{ translations: string[], targetLang: string, cachedCount: number, translatedCount: number, provider: string }>}
 */
async function translateBatch(texts, targetLang) {
  const safeLang = normalizeLang(targetLang);
  if (!Array.isArray(texts) || texts.length === 0) {
    return { translations: [], targetLang: safeLang, cachedCount: 0, translatedCount: 0, provider: 'none' };
  }

  const normalizedInputs = texts.map((t) => (typeof t === 'string' ? t : (t == null ? '' : String(t))));
  const results = new Array(normalizedInputs.length);
  const missingSet = new Set();
  let cachedCount = 0;

  normalizedInputs.forEach((text, idx) => {
    if (isNonTranslatable(text) || alreadyInTargetScript(text, safeLang)) {
      results[idx] = text;
      cachedCount += 1;
      return;
    }
    const cached = getCached(text, safeLang);
    if (cached !== null) {
      results[idx] = cached;
      cachedCount += 1;
    } else {
      missingSet.add(text);
    }
  });

  const missingList = Array.from(missingSet);
  if (missingList.length === 0) {
    return {
      translations: results,
      targetLang: safeLang,
      cachedCount,
      translatedCount: 0,
      provider: 'cache',
    };
  }

  const resolvedMap = new Map();
  const toFetch = [];
  const waitingPromises = [];

  for (const text of missingList) {
    const flightKey = makeCacheKey(text, safeLang);
    if (inFlight.has(flightKey)) {
      waitingPromises.push(
        inFlight.get(flightKey).then((val) => {
          resolvedMap.set(text, val);
        })
      );
    } else {
      toFetch.push(text);
    }
  }

  let usedProvider = 'cache';
  let actualTranslatedCount = 0;
  if (toFetch.length > 0) {
    const chunks = [];
    for (let i = 0; i < toFetch.length; i += CHUNK_SIZE) {
      chunks.push(toFetch.slice(i, i + CHUNK_SIZE));
    }

    const chunkPromises = chunks.map((chunk) => {
      const p = translateChunk(chunk, safeLang);
      chunk.forEach((text, idx) => {
        const flightKey = makeCacheKey(text, safeLang);
        const itemPromise = p.then(({ results: chunkRes }) => chunkRes[idx] || text);
        inFlight.set(flightKey, itemPromise);
        itemPromise.finally(() => inFlight.delete(flightKey));
      });
      return p;
    });

    const settledChunks = await Promise.all(chunkPromises);
    settledChunks.forEach((chunkResult, cIdx) => {
      const chunk = chunks[cIdx];
      if (chunkResult.provider && chunkResult.provider !== 'cache') {
        if (usedProvider === 'cache' || (usedProvider === 'passthrough' && chunkResult.provider !== 'passthrough')) {
          usedProvider = chunkResult.provider;
        }
      }
      chunk.forEach((text, i) => {
        const rawTranslated = chunkResult.results[i];
        const hasRealTranslation = typeof rawTranslated === 'string' && rawTranslated.trim().length > 0;
        const translated = hasRealTranslation ? rawTranslated : text;
        resolvedMap.set(text, translated);
        // Only cache real translations (avoid caching failed passthrough or null slots)
        if (chunkResult.provider !== 'passthrough' && hasRealTranslation) {
          actualTranslatedCount += 1;
          setCached(text, safeLang, translated);
        }
      });
    });
  }

  if (waitingPromises.length > 0) {
    await Promise.all(waitingPromises);
  }

  normalizedInputs.forEach((text, idx) => {
    if (results[idx] === undefined) {
      results[idx] = resolvedMap.get(text) ?? text;
    }
  });

  return {
    translations: results,
    targetLang: safeLang,
    cachedCount,
    translatedCount: actualTranslatedCount,
    provider: usedProvider,
  };
}

async function translateText(text, targetLang) {
  if (typeof text !== 'string' || !text.trim()) return text || '';
  const { translations } = await translateBatch([text], targetLang);
  return translations[0] ?? text;
}

function clearCache() {
  cache.clear();
}

module.exports = {
  SUPPORTED_LANGUAGES,
  LANGUAGE_NAMES,
  normalizeLang,
  translateBatch,
  translateText,
  clearCache,
  alreadyInTargetScript,
  isNonTranslatable,
};

