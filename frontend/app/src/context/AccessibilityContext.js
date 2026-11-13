import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AccessibilityContext = createContext(null);

const STORAGE_KEY = 'cityzen_accessibility_settings';

const DEFAULTS = {
  contrast: 'normal',   // 'normal' | 'high'
  fontScale: 'normal',  // 'normal' | 'large' | 'xlarge'
  reduceMotion: false,
};

const FONT_SCALE_MULTIPLIERS = { normal: 1, large: 1.15, xlarge: 1.3 };

// High-contrast color overrides for the small set of shared components
// that opt into this context (new screens this app adds going forward).
// NOTE: this app has no shared Typography/Theme component, and every
// existing screen hand-rolls its own StyleSheet with hardcoded colors --
// retrofitting font-scaling/contrast into every one of them is out of
// scope for this pass. Existing screens keep working as-is and continue to
// respect the OS-level font-scale accessibility setting (which React
// Native's Text/TextInput already honor by default); this context is for
// new/updated screens (e.g. the Settings screen) to adopt incrementally.
const HIGH_CONTRAST_COLORS = {
  text: '#000000',
  textSecondary: '#000000',
  background: '#FFFFFF',
  border: '#000000',
};
const NORMAL_COLORS = {
  text: '#1A1A1A',
  textSecondary: '#6B7280',
  background: '#FFFFFF',
  border: '#E0E0E0',
};

async function loadSettings() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

export function AccessibilityProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadSettings().then(s => { setSettings(s); setLoaded(true); });
  }, []);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings)).catch(() => {});
  }, [settings, loaded]);

  const updateSetting = useCallback((key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  const resetSettings = useCallback(() => setSettings(DEFAULTS), []);

  // Scales a base font size per the current fontScale setting -- new
  // screens call this instead of hardcoding a number, e.g.
  // fontSize: scaledFont(16).
  const scaledFont = useCallback(
    (baseSize) => Math.round(baseSize * FONT_SCALE_MULTIPLIERS[settings.fontScale]),
    [settings.fontScale]
  );

  const colors = settings.contrast === 'high' ? HIGH_CONTRAST_COLORS : NORMAL_COLORS;

  return (
    <AccessibilityContext.Provider value={{ settings, updateSetting, resetSettings, scaledFont, colors }}>
      {children}
    </AccessibilityContext.Provider>
  );
}

export function useAccessibility() {
  const ctx = useContext(AccessibilityContext);
  if (!ctx) throw new Error('useAccessibility must be used within AccessibilityProvider');
  return ctx;
}
