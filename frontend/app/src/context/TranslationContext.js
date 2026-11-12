import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { apiClient, makeApiCall } from '../../config/supabase';

const CACHE_STORAGE_KEY = 'urbanpulse_tx_cache_v2';
const MAX_PERSISTED_ENTRIES = 1200;
const BATCH_WINDOW_MS = 16;
const MAX_BATCH_CHUNK = 60;

// Global in-memory cache: `${lang}\u0000${text}` -> translated string
const memoryCache = new Map();
let cacheHydrationPromise = null;

function hydrateCache() {
  if (cacheHydrationPromise) return cacheHydrationPromise;
  cacheHydrationPromise = AsyncStorage.getItem(CACHE_STORAGE_KEY)
    .then((raw) => {
      if (!raw) return false;
      try {
        const parsed = JSON.parse(raw);
        let loaded = false;
        if (parsed && typeof parsed === 'object') {
          Object.entries(parsed).forEach(([k, v]) => {
            if (typeof v === 'string' && v) {
              memoryCache.set(k, v);
              loaded = true;
            }
          });
        }
        return loaded;
      } catch {
        return false;
      }
    })
    .catch(() => false);
  return cacheHydrationPromise;
}

let persistTimer = null;
function schedulePersistCache() {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    try {
      while (memoryCache.size > MAX_PERSISTED_ENTRIES) {
        const oldestKey = memoryCache.keys().next().value;
        memoryCache.delete(oldestKey);
      }
      const obj = {};
      memoryCache.forEach((v, k) => {
        obj[k] = v;
      });
      AsyncStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(obj)).catch(() => {});
    } catch {
      // Ignore persistence errors
    }
  }, 400);
}

function makeKey(text, lang) {
  return `${lang}\u0000${text}`;
}

function isSkippable(text) {
  if (typeof text !== 'string') return true;
  const trimmed = text.trim();
  if (!trimmed || trimmed.length <= 1) return true;
  if (/^https?:\/\/\S+$/i.test(trimmed)) return true;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return true;
  if (/^[\d\s.,:%+\-/#()°]+$/.test(trimmed)) return true;
  return false;
}

const SCRIPT_RANGES = {
  hi: /[\u0900-\u097F]/,
  ta: /[\u0B80-\u0BFF]/,
  te: /[\u0C00-\u0C7F]/,
  kn: /[\u0C80-\u0CFF]/,
  ml: /[\u0D00-\u0D7F]/,
};

function alreadyMatchesLang(text, lang) {
  if (lang === 'en') {
    return !/[\u0900-\u0DFF\u4E00-\u9FFF]/.test(text);
  }
  const regex = SCRIPT_RANGES[lang];
  if (!regex) return false;
  return regex.test(text) && !/[a-zA-Z]{3,}/.test(text);
}

const defaultContextValue = {
  currentLang: 'en',
  isTranslating: false,
  cacheVersion: 0,
  getCachedTranslation: (text) => text,
  requestTranslations: () => {},
};

const TranslationContext = createContext(defaultContextValue);

export function TranslationProvider({ children }) {
  const { i18n, t } = useTranslation('common');
  const currentLang = (i18n.resolvedLanguage || i18n.language || 'en').split('-')[0].toLowerCase();

  const [cacheVersion, setCacheVersion] = useState(0);
  const [activeRequests, setActiveRequests] = useState(0);

  const pendingQueueRef = useRef(new Map());
  const inFlightRef = useRef(new Set());
  const timerRef = useRef(null);
  const prevLangRef = useRef(currentLang);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let mounted = true;
    hydrateCache().then((loaded) => {
      if (mounted && loaded) {
        setCacheVersion((v) => v + 1);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Smooth opacity transition when switching language globally
  useEffect(() => {
    if (prevLangRef.current !== currentLang) {
      prevLangRef.current = currentLang;
      fadeAnim.setValue(0.75);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }).start();
    }
  }, [currentLang, fadeAnim]);

  const flushQueue = useCallback(async () => {
    timerRef.current = null;
    await hydrateCache();

    const entries = Array.from(pendingQueueRef.current.entries());
    pendingQueueRef.current.clear();

    for (const [lang, textSet] of entries) {
      const textsToFetch = Array.from(textSet).filter((text) => {
        const key = makeKey(text, lang);
        if (memoryCache.has(key) || inFlightRef.current.has(key)) return false;
        inFlightRef.current.add(key);
        return true;
      });

      if (textsToFetch.length === 0) continue;

      const chunks = [];
      for (let i = 0; i < textsToFetch.length; i += MAX_BATCH_CHUNK) {
        chunks.push(textsToFetch.slice(i, i + MAX_BATCH_CHUNK));
      }

      setActiveRequests((c) => c + chunks.length);

      Promise.all(
        chunks.map(async (chunk) => {
          try {
            const res = await makeApiCall(apiClient.translate.batch, {
              method: 'POST',
              body: JSON.stringify({ texts: chunk, targetLang: lang }),
            });
            if (res?.success && Array.isArray(res.translations)) {
              chunk.forEach((orig, idx) => {
                const translated = res.translations[idx];
                if (typeof translated === 'string' && translated.trim()) {
                  memoryCache.set(makeKey(orig, lang), translated);
                }
              });
              schedulePersistCache();
              setCacheVersion((v) => v + 1);
            }
          } catch {
            // Keep original text silently on failure
          } finally {
            chunk.forEach((orig) => inFlightRef.current.delete(makeKey(orig, lang)));
            setActiveRequests((c) => Math.max(0, c - 1));
          }
        })
      );
    }
  }, []);

  const requestTranslations = useCallback(
    (texts, langOverride) => {
      hydrateCache();
      const lang = (langOverride || currentLang || 'en').split('-')[0].toLowerCase();
      if (!Array.isArray(texts) || texts.length === 0) return;

      let added = false;
      for (const raw of texts) {
        if (isSkippable(raw) || alreadyMatchesLang(raw, lang)) continue;
        const key = makeKey(raw, lang);
        if (memoryCache.has(key) || inFlightRef.current.has(key)) continue;
        if (!pendingQueueRef.current.has(lang)) {
          pendingQueueRef.current.set(lang, new Set());
        }
        pendingQueueRef.current.get(lang).add(raw);
        added = true;
      }

      if (added && !timerRef.current) {
        timerRef.current = setTimeout(flushQueue, BATCH_WINDOW_MS);
      }
    },
    [currentLang, flushQueue]
  );

  const getCachedTranslation = useCallback(
    (text, langOverride) => {
      if (isSkippable(text)) return text;
      const lang = (langOverride || currentLang || 'en').split('-')[0].toLowerCase();
      if (alreadyMatchesLang(text, lang)) return text;
      return memoryCache.get(makeKey(text, lang)) || text;
    },
    [currentLang]
  );

  const value = useMemo(
    () => ({
      currentLang,
      isTranslating: activeRequests > 0,
      cacheVersion,
      getCachedTranslation,
      requestTranslations,
    }),
    [currentLang, activeRequests, cacheVersion, getCachedTranslation, requestTranslations]
  );

  return (
    <TranslationContext.Provider value={value}>
      <Animated.View style={[styles.flex, { opacity: fadeAnim }]}>
        {children}
      </Animated.View>
      {activeRequests > 0 && (
        <View pointerEvents="none" style={styles.pill}>
          <View style={styles.dot} />
          <Text style={styles.pillText}>{t('language.translating', 'Translating...')}</Text>
        </View>
      )}
    </TranslationContext.Provider>
  );
}

export function useDynamicTranslation() {
  return useContext(TranslationContext);
}

export function useTranslatedText(text) {
  const { currentLang, cacheVersion, getCachedTranslation, requestTranslations } = useDynamicTranslation();

  useEffect(() => {
    if (typeof text === 'string' && text.trim()) {
      requestTranslations([text], currentLang);
    }
  }, [text, currentLang, requestTranslations]);

  return useMemo(() => {
    if (typeof text !== 'string' || !text.trim()) return text;
    return getCachedTranslation(text, currentLang);
  }, [text, currentLang, cacheVersion, getCachedTranslation]);
}

export function useTranslatedList(items, fields = []) {
  const { currentLang, cacheVersion, getCachedTranslation, requestTranslations } = useDynamicTranslation();
  const fieldsKey = fields.join('|');

  useEffect(() => {
    if (!Array.isArray(items) || items.length === 0 || fields.length === 0) return;
    const texts = [];
    for (const item of items) {
      if (!item || typeof item !== 'object') continue;
      for (const field of fields) {
        const val = item[field];
        if (typeof val === 'string' && val.trim()) {
          texts.push(val);
        }
        if (field === 'location' && typeof item.location === 'object' && typeof item.location?.address === 'string') {
          texts.push(item.location.address);
        }
      }
    }
    if (texts.length > 0) {
      requestTranslations(texts, currentLang);
    }
  }, [items, fieldsKey, currentLang, requestTranslations]);

  return useMemo(() => {
    if (!Array.isArray(items) || items.length === 0) return items || [];
    return items.map((item) => {
      if (!item || typeof item !== 'object') return item;
      let changed = false;
      const clone = { ...item };
      for (const field of fields) {
        const val = item[field];
        if (typeof val === 'string' && val.trim()) {
          const tx = getCachedTranslation(val, currentLang);
          if (tx !== val) {
            clone[field] = tx;
            changed = true;
          }
        }
        if (field === 'location' && typeof item.location === 'object' && typeof item.location?.address === 'string') {
          const origAddr = item.location.address;
          const txAddr = getCachedTranslation(origAddr, currentLang);
          if (txAddr !== origAddr) {
            clone.location = { ...item.location, address: txAddr };
            changed = true;
          }
        }
      }
      return changed ? clone : item;
    });
  }, [items, fieldsKey, currentLang, cacheVersion, getCachedTranslation]);
}

export function useTranslatedObject(item, fields = []) {
  const arr = useMemo(() => (item ? [item] : []), [item]);
  const translated = useTranslatedList(arr, fields);
  return item ? translated[0] : item;
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  pill: {
    position: 'absolute',
    bottom: 26,
    left: 16,
    backgroundColor: '#111827',
    borderColor: '#000000',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 998,
    elevation: 5,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
    marginRight: 8,
  },
  pillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
});

