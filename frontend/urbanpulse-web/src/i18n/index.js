import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enCommon from './locales/en/common.json';
import enAuth from './locales/en/auth.json';
import enComplaint from './locales/en/complaint.json';
import enChatbot from './locales/en/chatbot.json';
import enAdmin from './locales/en/admin.json';
import enCitizen from './locales/en/citizen.json';

import hiCommon from './locales/hi/common.json';
import hiAuth from './locales/hi/auth.json';
import hiComplaint from './locales/hi/complaint.json';
import hiChatbot from './locales/hi/chatbot.json';
import hiAdmin from './locales/hi/admin.json';
import hiCitizen from './locales/hi/citizen.json';

import taCommon from './locales/ta/common.json';
import taAuth from './locales/ta/auth.json';
import taComplaint from './locales/ta/complaint.json';
import taChatbot from './locales/ta/chatbot.json';
import taAdmin from './locales/ta/admin.json';
import taCitizen from './locales/ta/citizen.json';

import teCommon from './locales/te/common.json';
import teAuth from './locales/te/auth.json';
import teComplaint from './locales/te/complaint.json';
import teChatbot from './locales/te/chatbot.json';
import teAdmin from './locales/te/admin.json';
import teCitizen from './locales/te/citizen.json';

import mlCommon from './locales/ml/common.json';
import mlAuth from './locales/ml/auth.json';
import mlComplaint from './locales/ml/complaint.json';
import mlChatbot from './locales/ml/chatbot.json';
import mlAdmin from './locales/ml/admin.json';
import mlCitizen from './locales/ml/citizen.json';

import knCommon from './locales/kn/common.json';
import knAuth from './locales/kn/auth.json';
import knComplaint from './locales/kn/complaint.json';
import knChatbot from './locales/kn/chatbot.json';
import knAdmin from './locales/kn/admin.json';
import knCitizen from './locales/kn/citizen.json';

// The 6 languages Urban Pulse supports end-to-end (UI rendering, speech-to-
// text, chatbot replies). Keep this list in sync with the Expo app's
// src/i18n/index.js and both SubmitComplaint language dropdowns.
export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'ta', label: 'தமிழ்' },
  { code: 'te', label: 'తెలుగు' },
  { code: 'ml', label: 'മലയാളം' },
  { code: 'kn', label: 'ಕನ್ನಡ' },
];

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { common: enCommon, auth: enAuth, complaint: enComplaint, chatbot: enChatbot, admin: enAdmin, citizen: enCitizen },
      hi: { common: hiCommon, auth: hiAuth, complaint: hiComplaint, chatbot: hiChatbot, admin: hiAdmin, citizen: hiCitizen },
      ta: { common: taCommon, auth: taAuth, complaint: taComplaint, chatbot: taChatbot, admin: taAdmin, citizen: taCitizen },
      te: { common: teCommon, auth: teAuth, complaint: teComplaint, chatbot: teChatbot, admin: teAdmin, citizen: teCitizen },
      ml: { common: mlCommon, auth: mlAuth, complaint: mlComplaint, chatbot: mlChatbot, admin: mlAdmin, citizen: mlCitizen },
      kn: { common: knCommon, auth: knAuth, complaint: knComplaint, chatbot: knChatbot, admin: knAdmin, citizen: knCitizen },
    },
    supportedLngs: SUPPORTED_LANGUAGES.map(l => l.code),
    load: 'languageOnly',
    fallbackLng: 'en',
    ns: ['common', 'auth', 'complaint', 'chatbot', 'admin', 'citizen'],
    defaultNS: 'common',
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'urbanpulse_language',
      caches: ['localStorage'],
    },
  });

export default i18n;
