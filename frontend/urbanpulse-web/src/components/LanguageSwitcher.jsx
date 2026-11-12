import { useTranslation } from 'react-i18next'
import { SUPPORTED_LANGUAGES } from '../i18n'

export default function LanguageSwitcher({ className = '' }) {
  const { t, i18n } = useTranslation('common')
  const currentLang = i18n.resolvedLanguage || (i18n.language || 'en').split('-')[0]

  return (
    <select
      value={currentLang}
      onChange={(e) => i18n.changeLanguage(e.target.value)}
      className={`text-xs font-mono border border-black/10 bg-white px-2 py-1.5 focus:outline-none focus:border-black ${className}`}
      aria-label={t('language.label', 'Language')}
    >
      {SUPPORTED_LANGUAGES.map(({ code, label }) => (
        <option key={code} value={code}>{label}</option>
      ))}
    </select>
  )
}
