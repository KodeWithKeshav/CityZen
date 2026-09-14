import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';

import enCommon from './locales/en/common.json';
import enAuth from './locales/en/auth.json';
import enComplaint from './locales/en/complaint.json';
import enChatbot from './locales/en/chatbot.json';
import enAdmin from './locales/en/admin.json';

import hiCommon from './locales/hi/common.json';
import hiAuth from './locales/hi/auth.json';
import hiComplaint from './locales/hi/complaint.json';
import hiChatbot from './locales/hi/chatbot.json';
import hiAdmin from './locales/hi/admin.json';

import taCommon from './locales/ta/common.json';
import taAuth from './locales/ta/auth.json';
import taComplaint from './locales/ta/complaint.json';
import taChatbot from './locales/ta/chatbot.json';
import taAdmin from './locales/ta/admin.json';

import teCommon from './locales/te/common.json';
import teAuth from './locales/te/auth.json';
import teComplaint from './locales/te/complaint.json';
import teChatbot from './locales/te/chatbot.json';
import teAdmin from './locales/te/admin.json';

import mlCommon from './locales/ml/common.json';
import mlAuth from './locales/ml/auth.json';
import mlComplaint from './locales/ml/complaint.json';
import mlChatbot from './locales/ml/chatbot.json';
import mlAdmin from './locales/ml/admin.json';

import knCommon from './locales/kn/common.json';
import knAuth from './locales/kn/auth.json';
import knComplaint from './locales/kn/complaint.json';
import knChatbot from './locales/kn/chatbot.json';
import knAdmin from './locales/kn/admin.json';

// The 6 languages Urban Pulse supports end-to-end (UI rendering, speech-to-
// text, chatbot replies). Keep this list in sync with the web app's
// src/i18n/index.js and both SubmitComplaint language dropdowns.
export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'ta', label: 'தமிழ்' },
  { code: 'te', label: 'తెలుగు' },
  { code: 'ml', label: 'മലയാളം' },
  { code: 'kn', label: 'ಕನ್ನಡ' },
];

const STORAGE_KEY = 'urbanpulse_language';

function detectDeviceLanguage() {
  try {
    const locales = Localization.getLocales();
    const code = locales?.[0]?.languageCode;
    return SUPPORTED_LANGUAGES.some(l => l.code === code) ? code : 'en';
  } catch {
    return 'en';
  }
}

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { common: enCommon, auth: enAuth, complaint: enComplaint, chatbot: enChatbot, admin: enAdmin },
      hi: { common: hiCommon, auth: hiAuth, complaint: hiComplaint, chatbot: hiChatbot, admin: hiAdmin },
      ta: { common: taCommon, auth: taAuth, complaint: taComplaint, chatbot: taChatbot, admin: taAdmin },
      te: { common: teCommon, auth: teAuth, complaint: teComplaint, chatbot: teChatbot, admin: teAdmin },
      ml: { common: mlCommon, auth: mlAuth, complaint: mlComplaint, chatbot: mlChatbot, admin: mlAdmin },
      kn: { common: knCommon, auth: knAuth, complaint: knComplaint, chatbot: knChatbot, admin: knAdmin },
    },
    supportedLngs: SUPPORTED_LANGUAGES.map(l => l.code),
    lng: detectDeviceLanguage(),
    fallbackLng: 'en',
    ns: ['common', 'auth', 'complaint', 'chatbot', 'admin'],
    defaultNS: 'common',
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });

// Once AsyncStorage resolves, an explicit saved preference overrides the
// device-locale guess used above for the very first render.
AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
  if (saved && SUPPORTED_LANGUAGES.some(l => l.code === saved) && saved !== i18n.language) {
    i18n.changeLanguage(saved);
  }
});

i18n.on('languageChanged', (lng) => {
  AsyncStorage.setItem(STORAGE_KEY, lng).catch(() => {});
});

export default i18n;
