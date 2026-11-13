import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { apiClient, makeApiCall } from '../services/api'

const CACHE_STORAGE_KEY = 'urbanpulse_tx_cache_v2'
const MAX_PERSISTED_ENTRIES = 1500
const BATCH_WINDOW_MS = 16
const MAX_BATCH_CHUNK = 60
const FAILED_COOLDOWN_MS = 60000

// Global in-memory cache: `${lang}\u0000${text}` -> translated string
const memoryCache = new Map()
let cacheHydrated = false

function hydrateCache() {
  if (cacheHydrated) return
  cacheHydrated = true
  if (typeof window === 'undefined' || !window.localStorage) return
  try {
    const raw = window.localStorage.getItem(CACHE_STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') {
      Object.entries(parsed).forEach(([k, v]) => {
        if (typeof v === 'string' && v) memoryCache.set(k, v)
      })
    }
  } catch {
    // Ignore corrupt localStorage cache
  }
}

function persistCache() {
  if (typeof window === 'undefined' || !window.localStorage) return
  try {
    while (memoryCache.size > MAX_PERSISTED_ENTRIES) {
      const oldestKey = memoryCache.keys().next().value
      memoryCache.delete(oldestKey)
    }
    const obj = {}
    memoryCache.forEach((v, k) => {
      obj[k] = v
    })
    window.localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(obj))
  } catch {
    // Ignore storage quota errors
  }
}

function makeKey(text, lang) {
  return `${lang}\u0000${text}`
}

function isSkippable(text) {
  if (typeof text !== 'string') return true
  const trimmed = text.trim()
  if (!trimmed || trimmed.length <= 1) return true
  if (/^https?:\/\/\S+$/i.test(trimmed)) return true
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return true
  if (/^[\d\s.,:%+\-/#()°]+$/.test(trimmed)) return true
  return false
}

const SCRIPT_RANGES = {
  hi: /[\u0900-\u097F]/,
  ta: /[\u0B80-\u0BFF]/,
  te: /[\u0C00-\u0C7F]/,
  kn: /[\u0C80-\u0CFF]/,
  ml: /[\u0D00-\u0D7F]/,
}

function alreadyMatchesLang(text, lang) {
  if (lang === 'en') {
    return !/[\u0900-\u0DFF\u4E00-\u9FFF]/.test(text)
  }
  const regex = SCRIPT_RANGES[lang]
  if (!regex) return false
  return regex.test(text) && !/[a-zA-Z]{3,}/.test(text)
}

const defaultContextValue = {
  currentLang: 'en',
  isTranslating: false,
  cacheVersion: 0,
  getCachedTranslation: (text) => text,
  requestTranslations: () => {},
}

const TranslationContext = createContext(defaultContextValue)

export function TranslationProvider({ children }) {
  const { i18n, t } = useTranslation('common')
  const currentLang = (i18n.resolvedLanguage || i18n.language || 'en').split('-')[0].toLowerCase()

  const [cacheVersion, setCacheVersion] = useState(0)
  const [activeRequests, setActiveRequests] = useState(0)
  const [isFading, setIsFading] = useState(false)

  const pendingQueueRef = useRef(new Map()) // lang -> Set<string>
  const inFlightRef = useRef(new Set()) // cacheKey
  const failedCooldownRef = useRef(new Map()) // cacheKey -> retryAfterMs
  const timerRef = useRef(null)
  const prevLangRef = useRef(currentLang)

  useEffect(() => {
    hydrateCache()
    if (memoryCache.size > 0) {
      setCacheVersion((v) => v + 1)
    }
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [])

  // Smooth opacity transition when switching global language
  useEffect(() => {
    if (prevLangRef.current !== currentLang) {
      prevLangRef.current = currentLang
      setIsFading(true)
      const id = setTimeout(() => setIsFading(false), 150)
      return () => clearTimeout(id)
    }
  }, [currentLang])

  const flushQueue = useCallback(async () => {
    timerRef.current = null
    const entries = Array.from(pendingQueueRef.current.entries())
    pendingQueueRef.current.clear()

    for (const [lang, textSet] of entries) {
      const textsToFetch = Array.from(textSet).filter((text) => {
        const key = makeKey(text, lang)
        if (memoryCache.has(key) || inFlightRef.current.has(key)) return false
        inFlightRef.current.add(key)
        return true
      })

      if (textsToFetch.length === 0) continue

      const chunks = []
      for (let i = 0; i < textsToFetch.length; i += MAX_BATCH_CHUNK) {
        chunks.push(textsToFetch.slice(i, i + MAX_BATCH_CHUNK))
      }

      setActiveRequests((c) => c + chunks.length)

      Promise.all(
        chunks.map(async (chunk) => {
          try {
            const res = await makeApiCall(apiClient.translate.batch, {
              method: 'POST',
              body: JSON.stringify({ texts: chunk, targetLang: lang }),
            })
            if (res?.success && Array.isArray(res.translations)) {
              const now = Date.now()
              chunk.forEach((orig, idx) => {
                const translated = res.translations[idx]
                const key = makeKey(orig, lang)
                if (typeof translated === 'string' && translated.trim()) {
                  memoryCache.set(key, translated)
                  failedCooldownRef.current.delete(key)
                } else {
                  failedCooldownRef.current.set(key, now + FAILED_COOLDOWN_MS)
                }
              })
              persistCache()
              setCacheVersion((v) => v + 1)
            } else {
              const retryAt = Date.now() + FAILED_COOLDOWN_MS
              chunk.forEach((orig) => failedCooldownRef.current.set(makeKey(orig, lang), retryAt))
            }
          } catch {
            const retryAt = Date.now() + FAILED_COOLDOWN_MS
            chunk.forEach((orig) => failedCooldownRef.current.set(makeKey(orig, lang), retryAt))
          } finally {
            chunk.forEach((orig) => inFlightRef.current.delete(makeKey(orig, lang)))
            setActiveRequests((c) => Math.max(0, c - 1))
          }
        })
      )
    }
  }, [])

  const requestTranslations = useCallback(
    (texts, langOverride) => {
      hydrateCache()
      const lang = (langOverride || currentLang || 'en').split('-')[0].toLowerCase()
      if (!Array.isArray(texts) || texts.length === 0) return

      let added = false
      const now = Date.now()
      for (const raw of texts) {
        if (isSkippable(raw) || alreadyMatchesLang(raw, lang)) continue
        const key = makeKey(raw, lang)
        if (memoryCache.has(key) || inFlightRef.current.has(key)) continue
        if ((failedCooldownRef.current.get(key) || 0) > now) continue
        if (!pendingQueueRef.current.has(lang)) {
          pendingQueueRef.current.set(lang, new Set())
        }
        pendingQueueRef.current.get(lang).add(raw)
        added = true
      }

      if (added && !timerRef.current) {
        timerRef.current = setTimeout(flushQueue, BATCH_WINDOW_MS)
      }
    },
    [currentLang, flushQueue]
  )

  const getCachedTranslation = useCallback(
    (text, langOverride) => {
      hydrateCache()
      if (isSkippable(text)) return text
      const lang = (langOverride || currentLang || 'en').split('-')[0].toLowerCase()
      if (alreadyMatchesLang(text, lang)) return text
      return memoryCache.get(makeKey(text, lang)) || text
    },
    [currentLang]
  )

  const value = useMemo(
    () => ({
      currentLang,
      isTranslating: activeRequests > 0,
      cacheVersion,
      getCachedTranslation,
      requestTranslations,
    }),
    [currentLang, activeRequests, cacheVersion, getCachedTranslation, requestTranslations]
  )

  return (
    <TranslationContext.Provider value={value}>
      <div className={`transition-opacity duration-150 ${isFading ? 'opacity-70' : 'opacity-100'}`}>
        {children}
      </div>
      {activeRequests > 0 && (
        <div
          aria-live="polite"
          className="fixed bottom-4 left-4 z-50 pointer-events-none bg-neutral-900 text-white border border-black px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider flex items-center gap-2"
        >
          <span className="inline-block w-2 h-2 bg-white animate-pulse" />
          <span>{t('language.translating', 'Translating...')}</span>
        </div>
      )}
    </TranslationContext.Provider>
  )
}

export function useDynamicTranslation() {
  return useContext(TranslationContext)
}

export function useTranslatedText(text) {
  const { currentLang, cacheVersion, getCachedTranslation, requestTranslations } = useDynamicTranslation()

  useEffect(() => {
    if (typeof text === 'string' && text.trim()) {
      requestTranslations([text], currentLang)
    }
  }, [text, currentLang, requestTranslations])

  return useMemo(() => {
    if (typeof text !== 'string' || !text.trim()) return text
    return getCachedTranslation(text, currentLang)
  }, [text, currentLang, cacheVersion, getCachedTranslation])
}

/**
 * Translates an array of objects in place (returning shallow-copied objects)
 * for the specified top-level string fields, plus optional nested getters/setters.
 *
 * Example:
 *   const translated = useTranslatedList(complaints, ['title', 'complaintTitle', 'description', 'location_address'])
 */
export function useTranslatedList(items, fields = []) {
  const { currentLang, cacheVersion, getCachedTranslation, requestTranslations } = useDynamicTranslation()
  const fieldsKey = fields.join('|')

  useEffect(() => {
    if (!Array.isArray(items) || items.length === 0 || fields.length === 0) return
    const texts = []
    for (const item of items) {
      if (!item || typeof item !== 'object') continue
      for (const field of fields) {
        const val = item[field]
        if (typeof val === 'string' && val.trim()) {
          texts.push(val)
        }
        if (field === 'location' && typeof item.location === 'object' && typeof item.location?.address === 'string') {
          texts.push(item.location.address)
        }
      }
    }
    if (texts.length > 0) {
      requestTranslations(texts, currentLang)
    }
  }, [items, fieldsKey, currentLang, requestTranslations])

  return useMemo(() => {
    if (!Array.isArray(items) || items.length === 0) return items || []
    return items.map((item) => {
      if (!item || typeof item !== 'object') return item
      let changed = false
      const clone = { ...item }
      for (const field of fields) {
        const val = item[field]
        if (typeof val === 'string' && val.trim()) {
          const tx = getCachedTranslation(val, currentLang)
          if (tx !== val) {
            clone[field] = tx
            changed = true
          }
        }
        if (field === 'location' && typeof item.location === 'object' && typeof item.location?.address === 'string') {
          const origAddr = item.location.address
          const txAddr = getCachedTranslation(origAddr, currentLang)
          if (txAddr !== origAddr) {
            clone.location = { ...item.location, address: txAddr }
            changed = true
          }
        }
      }
      return changed ? clone : item
    })
  }, [items, fieldsKey, currentLang, cacheVersion, getCachedTranslation])
}

export function useTranslatedObject(item, fields = []) {
  const arr = useMemo(() => (item ? [item] : []), [item])
  const translated = useTranslatedList(arr, fields)
  return item ? translated[0] : item
}

