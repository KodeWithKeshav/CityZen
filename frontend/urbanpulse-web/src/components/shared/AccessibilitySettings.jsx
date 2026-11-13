import { useTranslation } from 'react-i18next'
import { useAccessibility } from '../../context/AccessibilityContext'

/**
 * Accessibility preference controls (contrast, text size, reduced motion,
 * dyslexia-friendly font). Pure presentational wrapper around
 * AccessibilityContext -- reused inside both the citizen and admin Settings
 * pages. The actual visual effect of each setting lives in the CSS layer
 * appended to index.css.
 */
export default function AccessibilitySettings() {
  const { t } = useTranslation('common')
  const { settings, updateSetting, resetSettings } = useAccessibility()

  const segmented = (options, value, onChange) => (
    <div className="flex border border-neutral-300 divide-x divide-neutral-300 w-fit">
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1.5 font-mono text-xs uppercase tracking-wider transition-colors ${
            value === opt.value ? 'bg-neutral-900 text-white font-bold' : 'bg-white text-neutral-700 hover:bg-neutral-50'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )

  const toggle = (checked, onChange) => (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 flex-shrink-0 border transition-colors focus:outline-none focus:ring-1 focus:ring-black ${checked ? 'bg-neutral-900 border-black' : 'bg-white border-neutral-300'}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white border border-neutral-400 transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`}
      />
    </button>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 pb-3 border-b border-neutral-200">
        <div>
          <h3 className="font-serif text-lg font-bold uppercase text-neutral-900">
            {t('accessibility.title')}
          </h3>
          <p className="text-xs font-mono text-neutral-500 mt-0.5">{t('accessibility.subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={resetSettings}
          className="font-mono text-[11px] uppercase tracking-wider text-neutral-500 hover:text-black underline flex-shrink-0"
        >
          {t('accessibility.reset')}
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-mono text-xs uppercase tracking-wider text-neutral-900 font-bold">{t('accessibility.contrast.label')}</div>
          <p className="text-xs text-neutral-500 font-sans mt-0.5">{t('accessibility.contrast.desc')}</p>
        </div>
        {segmented(
          [
            { value: 'normal', label: t('accessibility.contrast.normal') },
            { value: 'high', label: t('accessibility.contrast.high') },
          ],
          settings.contrast,
          v => updateSetting('contrast', v)
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-mono text-xs uppercase tracking-wider text-neutral-900 font-bold">{t('accessibility.fontScale.label')}</div>
          <p className="text-xs text-neutral-500 font-sans mt-0.5">{t('accessibility.fontScale.desc')}</p>
        </div>
        {segmented(
          [
            { value: 'normal', label: t('accessibility.fontScale.normal') },
            { value: 'large', label: t('accessibility.fontScale.large') },
            { value: 'xlarge', label: t('accessibility.fontScale.xlarge') },
          ],
          settings.fontScale,
          v => updateSetting('fontScale', v)
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-mono text-xs uppercase tracking-wider text-neutral-900 font-bold">{t('accessibility.reduceMotion.label')}</div>
          <p className="text-xs text-neutral-500 font-sans mt-0.5">{t('accessibility.reduceMotion.desc')}</p>
        </div>
        {toggle(settings.reduceMotion, v => updateSetting('reduceMotion', v))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-mono text-xs uppercase tracking-wider text-neutral-900 font-bold">{t('accessibility.dyslexiaFont.label')}</div>
          <p className="text-xs text-neutral-500 font-sans mt-0.5">{t('accessibility.dyslexiaFont.desc')}</p>
        </div>
        {toggle(settings.dyslexiaFont, v => updateSetting('dyslexiaFont', v))}
      </div>
    </div>
  )
}
