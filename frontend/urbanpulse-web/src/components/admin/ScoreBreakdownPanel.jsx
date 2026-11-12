import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { HiChevronDown, HiChevronUp, HiChartBar } from 'react-icons/hi'

const SIGNAL_LABELS = {
  infrastructureScore: 'Infrastructure Proximity',
  imageValidationScore: 'Image Validation',
  emotionScore: 'Emotion Analysis',
  voteScore: 'Community Votes',
}

function pct(n) {
  const v = Number(n)
  return Number.isFinite(v) ? `${(v * 100).toFixed(1)}%` : '—'
}

function pts(n) {
  const v = Number(n)
  return Number.isFinite(v) ? (v * 100).toFixed(1) : '—'
}

/**
 * Collapsible "how was this score calculated" panel for admins -- renders
 * the complaint's stored `priority_breakdown` (see
 * backend/services/LocationPriorityService.js calculateComprehensivePriority()
 * and the add_priority_breakdown_column.sql migration). Closed by default;
 * nothing to show (older complaint, or migration not yet applied) renders
 * nothing at all rather than an empty shell.
 */
export default function ScoreBreakdownPanel({ breakdown }) {
  const { t } = useTranslation(['admin', 'common'])
  const [expanded, setExpanded] = useState(false)

  if (!breakdown || typeof breakdown !== 'object') return null

  const signalKeys = Object.keys(SIGNAL_LABELS).filter(k => breakdown[k] !== undefined)
  const weights = breakdown.weights || {}
  const contributions = breakdown.contributions || {}
  const facilityAnalysis = breakdown.facilityAnalysis || null
  const facilityEntries = facilityAnalysis
    ? Object.entries(facilityAnalysis).filter(([, v]) => v && v.count > 0)
    : []

  return (
    <div className="border border-neutral-200 bg-white">
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between gap-2 p-4 sm:p-6 text-left hover:bg-neutral-50 transition-colors"
      >
        <div className="flex items-center gap-2 font-serif font-bold text-sm uppercase text-neutral-900">
          <HiChartBar className="w-5 h-5" />
          <span>{t('complaintDossier.scoreBreakdown.title')}</span>
        </div>
        {expanded ? <HiChevronUp className="w-4 h-4 text-neutral-500" /> : <HiChevronDown className="w-4 h-4 text-neutral-500" />}
      </button>

      {expanded && (
        <div className="border-t border-neutral-200 p-4 sm:p-6 space-y-5">
          {breakdown.reasoning && (
            <div className="border border-neutral-200 p-3 bg-neutral-50 font-sans text-xs text-neutral-700 leading-relaxed">
              {breakdown.reasoning}
            </div>
          )}

          <div>
            <table className="w-full text-left font-mono text-xs border-collapse">
              <thead className="text-neutral-500 uppercase text-[10px] tracking-wider border-b border-neutral-200">
                <tr>
                  <th className="py-2 pr-2">{t('complaintDossier.scoreBreakdown.signal')}</th>
                  <th className="py-2 pr-2">{t('complaintDossier.scoreBreakdown.raw')}</th>
                  <th className="py-2 pr-2">{t('complaintDossier.scoreBreakdown.weight')}</th>
                  <th className="py-2">{t('complaintDossier.scoreBreakdown.contribution')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 text-neutral-800">
                {signalKeys.map(key => (
                  <tr key={key}>
                    <td className="py-2 pr-2">{SIGNAL_LABELS[key]}</td>
                    <td className="py-2 pr-2">{pct(breakdown[key])}</td>
                    <td className="py-2 pr-2">{weights[key] !== undefined ? `${(weights[key] * 100).toFixed(1)}%` : '—'}</td>
                    <td className="py-2 font-bold">{contributions[key] !== undefined ? pts(contributions[key]) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {typeof breakdown.statusMultiplier === 'number' && breakdown.statusMultiplier !== 1 && (
            <div className="font-mono text-xs text-neutral-600">
              {t('complaintDossier.scoreBreakdown.statusMultiplier')}: ×{breakdown.statusMultiplier}
            </div>
          )}

          {facilityEntries.length > 0 && (
            <div>
              <span className="font-mono text-xs uppercase tracking-wider text-neutral-500 block mb-2">
                {t('complaintDossier.scoreBreakdown.nearbyFacilities')}
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-xs">
                {facilityEntries.map(([type, info]) => (
                  <div key={type} className="border border-neutral-200 p-2.5 bg-neutral-50">
                    <div className="flex items-center justify-between">
                      <span className="uppercase text-[10px] text-neutral-500">{type.replace(/_/g, ' ')}</span>
                      <span className="font-bold">{info.count}</span>
                    </div>
                    {Array.isArray(info.facilities) && info.facilities[0] && (
                      <div className="text-neutral-500 mt-0.5 truncate">
                        {t('complaintDossier.scoreBreakdown.nearest')}: {info.facilities[0].name}
                        {typeof info.facilities[0].distance === 'number' && ` (${Math.round(info.facilities[0].distance)}m)`}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {breakdown.facilitiesCount !== undefined && (
            <div className="font-mono text-[11px] text-neutral-400">
              {t('complaintDossier.scoreBreakdown.totalFacilities')}: {breakdown.facilitiesCount}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
