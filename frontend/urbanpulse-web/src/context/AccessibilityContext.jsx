import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const AccessibilityContext = createContext(null)

const STORAGE_KEY = 'cityzen_accessibility_settings'

const DEFAULTS = {
  contrast: 'normal',     // 'normal' | 'high'
  fontScale: 'normal',    // 'normal' | 'large' | 'xlarge'
  reduceMotion: false,
  dyslexiaFont: false,
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULTS
    const parsed = JSON.parse(raw)
    return { ...DEFAULTS, ...parsed }
  } catch {
    return DEFAULTS
  }
}

function applyToDocument(settings) {
  const html = document.documentElement
  html.setAttribute('data-contrast', settings.contrast)
  html.setAttribute('data-font-scale', settings.fontScale)
  html.setAttribute('data-reduce-motion', String(settings.reduceMotion))
  html.setAttribute('data-dyslexia-font', String(settings.dyslexiaFont))
}

/**
 * App-wide accessibility preferences (contrast, text size, reduced motion,
 * dyslexia-friendly font), persisted to localStorage and applied as data-*
 * attributes on <html>. The actual visual effect of each setting lives in
 * the CSS override layer appended to index.css -- this context only owns
 * the state and persistence.
 */
export function AccessibilityProvider({ children }) {
  const [settings, setSettings] = useState(loadSettings)

  useEffect(() => {
    applyToDocument(settings)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    } catch {
      // localStorage unavailable (private mode, quota, etc.) -- setting
      // still applies for this session via the DOM attribute above.
    }
  }, [settings])

  const updateSetting = useCallback((key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }, [])

  const resetSettings = useCallback(() => setSettings(DEFAULTS), [])

  return (
    <AccessibilityContext.Provider value={{ settings, updateSetting, resetSettings }}>
      {children}
    </AccessibilityContext.Provider>
  )
}

export function useAccessibility() {
  const ctx = useContext(AccessibilityContext)
  if (!ctx) throw new Error('useAccessibility must be used within AccessibilityProvider')
  return ctx
}
