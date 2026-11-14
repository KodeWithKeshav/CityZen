import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { HiChevronDown, HiChevronUp, HiLightBulb } from 'react-icons/hi'
import { makeApiCall, apiClient } from '../../services/api'

// Devanagari .. Malayalam. The DistilBERT sentiment model is an English SST-2
// classifier, so SHAP on Indic-script text would only explain noise.
const INDIC_SCRIPT = /[ऀ-෿]/

const RED = '220, 38, 38'
const BLUE = '37, 99, 235'

/**
 * Background colour for one word: red = raises the distress signal, blue =
 * lowers it, opacity scales with |shap| relative to the strongest word.
 */
export function heatStyle(shap, maxAbs) {
  if (!Number.isFinite(shap) || !maxAbs || Math.abs(shap) < maxAbs * 0.04) return undefined
  const alpha = Math.min(0.85, 0.12 + 0.73 * (Math.abs(shap) / maxAbs))
  return { backgroundColor: `rgba(${shap > 0 ? RED : BLUE}, ${alpha.toFixed(2)})` }
}

/**
 * Split the original text into [{ text, word? }] using the words' char offsets,
 * so spaces/newlines are kept exactly and only real words carry a SHAP value.
 */
export function buildSegments(text, words) {
  const ordered = [...(words || [])]
    .filter(w => Number.isInteger(w.start) && Number.isInteger(w.end) && w.end > w.start)
    .sort((a, b) => a.start - b.start)
  const segments = []
  let cursor = 0
  for (const w of ordered) {
    if (w.start < cursor) continue
    if (w.start > cursor) segments.push({ text: text.slice(cursor, w.start) })
    segments.push({ text: text.slice(w.start, w.end), word: w })
    cursor = w.end
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor) })
  return segments
}

function signed(n) {
  const v = Number(n)
  if (!Number.isFinite(v)) return '—'
  return `${v > 0 ? '+' : ''}${v.toFixed(3)}`
}

/**
 * Collapsible admin panel: "which words made the DistilBERT emotion model read
 * this complaint as distressed?" -- SHAP values from the local Python service
 * (POST /api/emotion/explain, admin only). Closed by default and never runs on
 * its own: an explanation costs real CPU time, so the admin asks for it.
 */
export default function EmotionExplainPanel({ text }) {
  const { t } = useTranslation(['admin', 'common'])
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const safeText = typeof text === 'string' ? text.trim() : ''

  // A different complaint (or edited text) invalidates any previous explanation.
  useEffect(() => {
    setResult(null)
    setError(null)
    setLoading(false)
  }, [safeText])

  if (!safeText) return null

  const isEnglish = !INDIC_SCRIPT.test(safeText)

  const run = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await makeApiCall(apiClient.emotion.explain, {
        method: 'POST',
        body: JSON.stringify({ text: safeText, target: 'NEGATIVE' }),
        timeoutMs: 120000,
      })
      if (!res?.success || !res?.data) throw new Error(res?.message || 'Explanation failed')
      setResult(res.data)
    } catch (e) {
      setError(e?.message || t('complaintDossier.emotionExplain.unavailable'))
    } finally {
      setLoading(false)
    }
  }

  const words = result?.words || []
  const maxAbs = words.reduce((m, w) => Math.max(m, Math.abs(Number(w.shap) || 0)), 0)
  const segments = result ? buildSegments(result.text || safeText, words) : []

  return (
    <div className="border border-neutral-200 bg-white" data-testid="emotion-explain-panel">
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between gap-2 p-4 sm:p-6 text-left hover:bg-neutral-50 transition-colors"
      >
        <div className="flex items-center gap-2 font-serif font-bold text-sm uppercase text-neutral-900">
          <HiLightBulb className="w-5 h-5" />
          <span>{t('complaintDossier.emotionExplain.title')}</span>
        </div>
        {expanded ? <HiChevronUp className="w-4 h-4 text-neutral-500" /> : <HiChevronDown className="w-4 h-4 text-neutral-500" />}
      </button>

      {expanded && (
        <div className="border-t border-neutral-200 p-4 sm:p-6 space-y-4">
          <p className="font-sans text-xs text-neutral-600 leading-relaxed">
            {t('complaintDossier.emotionExplain.description')}
          </p>

          {!isEnglish ? (
            <div className="border border-amber-300 bg-amber-50 p-3 font-sans text-xs text-amber-900">
              {t('complaintDossier.emotionExplain.englishOnly')}
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={run}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-60 border border-black font-mono text-[11px] uppercase tracking-wider font-bold transition-colors cursor-pointer"
                >
                  {loading
                    ? t('complaintDossier.emotionExplain.running')
                    : result
                      ? t('complaintDossier.emotionExplain.rerun')
                      : t('complaintDossier.emotionExplain.run')}
                </button>
                {result && (
                  <span className="font-mono text-[11px] text-neutral-400">
                    {t('complaintDossier.emotionExplain.computedIn', { ms: result.elapsed_ms ?? 0 })}
                  </span>
                )}
              </div>

              {error && (
                <div role="alert" className="border border-rose-300 bg-rose-50 p-3 font-sans text-xs text-rose-900 space-y-1">
                  <div className="font-bold">{t('complaintDossier.emotionExplain.unavailable')}</div>
                  <div>{error}</div>
                  <div className="text-rose-700">{t('complaintDossier.emotionExplain.unavailableHint')}</div>
                </div>
              )}

              {result && (
                <div className="space-y-4">
                  <div className="font-mono text-xs text-neutral-700 flex flex-wrap gap-x-6 gap-y-1">
                    <span>
                      {t('complaintDossier.emotionExplain.verdict')}: <b>{result.label}</b> ({(Number(result.score) * 100).toFixed(1)}%)
                    </span>
                    <span>
                      {t('complaintDossier.emotionExplain.baseline')}: {(Number(result.base_value) * 100).toFixed(1)}%
                    </span>
                  </div>

                  <div
                    data-testid="emotion-explain-text"
                    className="border border-neutral-200 bg-neutral-50 p-3 font-sans text-sm leading-8 text-neutral-900 whitespace-pre-wrap break-words"
                  >
                    {segments.map((seg, i) =>
                      seg.word ? (
                        <span
                          key={i}
                          className="rounded-sm px-0.5"
                          style={heatStyle(Number(seg.word.shap), maxAbs)}
                          title={`${seg.word.text}: ${signed(seg.word.shap)}`}
                        >
                          {seg.text}
                        </span>
                      ) : (
                        <span key={i}>{seg.text}</span>
                      )
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-4 font-mono text-[10px] uppercase tracking-wider text-neutral-500">
                    <span className="inline-flex items-center gap-1.5">
                      <i className="inline-block w-3 h-3" style={{ backgroundColor: `rgba(${RED}, 0.6)` }} />
                      {t('complaintDossier.emotionExplain.raises')}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <i className="inline-block w-3 h-3" style={{ backgroundColor: `rgba(${BLUE}, 0.6)` }} />
                      {t('complaintDossier.emotionExplain.lowers')}
                    </span>
                  </div>

                  {(result.top_positive?.length > 0 || result.top_negative?.length > 0) && (
                    <div>
                      <span className="font-mono text-xs uppercase tracking-wider text-neutral-500 block mb-2">
                        {t('complaintDossier.emotionExplain.topWords')}
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-xs">
                        <ul data-testid="emotion-explain-top-positive" className="border border-neutral-200 divide-y divide-neutral-100">
                          {(result.top_positive || []).map(w => (
                            <li key={`p-${w.text}`} className="flex justify-between px-2.5 py-1.5">
                              <span>{w.text}</span>
                              <span className="font-bold text-red-700">{signed(w.shap)}</span>
                            </li>
                          ))}
                        </ul>
                        <ul data-testid="emotion-explain-top-negative" className="border border-neutral-200 divide-y divide-neutral-100">
                          {(result.top_negative || []).map(w => (
                            <li key={`n-${w.text}`} className="flex justify-between px-2.5 py-1.5">
                              <span>{w.text}</span>
                              <span className="font-bold text-blue-700">{signed(w.shap)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
