import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { makeApiCall, apiClient } from '../../services/api'
import toast from 'react-hot-toast'
import { HiRefresh, HiExclamationCircle, HiChevronRight } from 'react-icons/hi'
import { getPriorityTier } from '../../utils/priorityUtils'

export default function PriorityQueue() {
  const { t } = useTranslation('admin')
  const [queue, setQueue] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterTier, setFilterTier] = useState('all')
  const navigate = useNavigate()

  const fetchQueue = async () => {
    setLoading(true)
    try {
      let res = null
      try {
        const pqRes = await makeApiCall(apiClient.admin.priorityQueue)
        if (pqRes?.success) {
          res = pqRes
        }
      } catch {
        // Fallback to all complaints if priorityQueue endpoint fails
      }
      if (!res) {
        res = await makeApiCall(apiClient.complaints.all)
      }
      if (!res?.success) {
        toast.error(res?.message || res?.error || t('priorityQueue.loadFailed'))
        return
      }
      const rawData = res.data?.complaints || res.complaints || res.data
      const data = Array.isArray(rawData) ? rawData : []
      const sorted = [...data].sort((a, b) => {
        const scoreA = getPriorityTier(a).score ?? 0
        const scoreB = getPriorityTier(b).score ?? 0
        return scoreB - scoreA
      })
      setQueue(sorted)
    } catch (err) {
      toast.error(t('priorityQueue.loadFailed'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchQueue()
  }, [])

  const filteredQueue = queue.filter(c => {
    const score = getPriorityTier(c).score ?? 0
    if (filterTier === 'critical') return score >= 80
    if (filterTier === 'high') return score >= 60 && score < 80
    if (filterTier === 'medium') return score >= 40 && score < 60
    if (filterTier === 'low') return score < 40
    return true
  })

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="border-b border-black pb-4 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 font-mono text-xs text-neutral-500 uppercase tracking-widest mb-1">
            <span>{t('priorityQueue.breadcrumbTimeline')}</span>
            <span>/</span>
            <span>{t('priorityQueue.breadcrumbSequencing')}</span>
            <span>/</span>
            <span className="text-black font-semibold">{t('priorityQueue.breadcrumbDispatch')}</span>
          </div>
          <h1 className="font-serif text-3xl font-bold tracking-tight text-neutral-900 uppercase">
            {t('priorityQueue.title')}
          </h1>
          <p className="text-sm text-neutral-600 mt-1 font-sans">
            {t('priorityQueue.subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchQueue}
            disabled={loading}
            className="p-2 border border-neutral-300 hover:border-black transition-colors disabled:opacity-50"
            title={t('priorityQueue.refreshTooltip')}
          >
            <HiRefresh className={`w-4 h-4 text-neutral-800 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Tier Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border border-neutral-200 bg-white p-3 font-mono text-xs">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-neutral-400 text-[10px] uppercase tracking-wider mr-1">
            {t('priorityQueue.severityTiers')}
          </span>
          {[
            { id: 'all', label: t('priorityQueue.tiers.all') },
            { id: 'critical', label: t('priorityQueue.tiers.critical') },
            { id: 'high', label: t('priorityQueue.tiers.high') },
            { id: 'medium', label: t('priorityQueue.tiers.medium') },
            { id: 'low', label: t('priorityQueue.tiers.low') },
          ].map(tier => (
            <button
              key={tier.id}
              onClick={() => setFilterTier(tier.id)}
              className={`px-3 py-1.5 border uppercase tracking-wider transition-colors ${
                filterTier === tier.id
                  ? 'bg-neutral-900 text-white border-black font-bold'
                  : 'border-neutral-200 text-neutral-600 hover:border-black bg-neutral-50'
              }`}
            >
              {tier.label}
            </button>
          ))}
        </div>

        <div className="text-neutral-500 text-right">
          {t('priorityQueue.totalSequenced')} <strong className="text-black">{filteredQueue.length}</strong>
        </div>
      </div>

      {/* Triage Timeline Cards */}
      {loading ? (
        <div className="space-y-4 font-mono text-xs text-neutral-400">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="border border-neutral-200 p-6 bg-white animate-pulse h-32" />
          ))}
        </div>
      ) : filteredQueue.length === 0 ? (
        <div className="border border-dashed border-neutral-300 bg-white p-12 text-center">
          <HiExclamationCircle className="w-10 h-10 text-neutral-400 mx-auto mb-3" />
          <h3 className="font-serif text-lg font-bold text-neutral-900 uppercase">
            {t('priorityQueue.noIncidentsTitle')}
          </h3>
          <p className="text-xs text-neutral-500 font-sans mt-1">
            {t('priorityQueue.noIncidentsDesc')}
          </p>
        </div>
      ) : (
        <div className="space-y-4 relative">
          {/* Vertical sequence track line */}
          <div className="absolute left-[23px] top-6 bottom-6 w-0.5 bg-neutral-200 hidden md:block" />

          {filteredQueue.map((c, idx) => {
            const pTier = getPriorityTier(c)
            const score = pTier.score ?? 0
            const isCritical = score >= 80
            const isHigh = score >= 60 && score < 80

            return (
              <div
                key={c._id || c.id}
                onClick={() => navigate(`/admin/complaints/${c._id || c.id}`)}
                className="group relative border border-neutral-200 hover:border-black bg-white p-6 transition-colors cursor-pointer flex flex-col md:flex-row gap-6 items-start md:items-center"
              >
                {/* Sequence Rank Indicator */}
                <div className="flex items-center gap-4 flex-shrink-0 z-10">
                  <div
                    className={`w-12 h-12 border flex items-center justify-center font-mono text-sm font-bold ${
                      isCritical
                        ? 'bg-neutral-950 text-white border-black'
                        : isHigh
                        ? 'bg-neutral-800 text-white border-neutral-900'
                        : 'bg-neutral-100 text-neutral-800 border-neutral-300'
                    }`}
                  >
                    #{idx + 1}
                  </div>
                </div>

                {/* Body Details */}
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-semibold text-neutral-400">
                      {t('priorityQueue.recordLabel', { id: String(c._id || c.id || '').slice(-6).toUpperCase() })}
                    </span>
                    <span
                      className={`font-mono text-[10px] tracking-wider uppercase px-2 py-0.5 border ${
                        isCritical
                          ? 'bg-rose-50 text-rose-900 border-rose-300 font-bold'
                          : isHigh
                          ? 'bg-amber-50 text-amber-900 border-amber-300 font-bold'
                          : 'bg-neutral-100 text-neutral-800 border-neutral-300'
                      }`}
                    >
                      {isCritical ? t('priorityQueue.tier1') : isHigh ? t('priorityQueue.tier2') : t('priorityQueue.tier3')}
                    </span>
                    {(c.category || c.issueType) && (
                      <span className="font-mono text-[10px] px-2 py-0.5 border border-neutral-200 bg-neutral-50 text-neutral-600 uppercase">
                        {(c.category || c.issueType).replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>

                  <h3 className="font-serif font-bold text-lg text-neutral-900 group-hover:underline">
                    {c.title || c.complaintTitle || t('priorityQueue.unclassifiedHazard')}
                  </h3>

                  <p className="text-xs text-neutral-600 font-sans line-clamp-2 leading-relaxed">
                    {c.description}
                  </p>

                  {/* Metadata Row */}
                  <div className="pt-2 flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-xs text-neutral-500 border-t border-neutral-100">
                    <div>
                      <span className="text-[10px] text-neutral-400 block uppercase">{t('priorityQueue.leadAgency')}</span>
                      <span className="font-bold text-neutral-800 uppercase">
                        {c.assignedDept || c.assigned_department || t('priorityQueue.municipalRapidCorps')}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-neutral-400 block uppercase">{t('priorityQueue.submittedBy')}</span>
                      <span className="font-bold text-neutral-800 uppercase">
                        {c.citizenName || c.users?.full_name || c.user?.full_name || c.user_name || c.full_name || t('priorityQueue.verifiedCitizen')}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-neutral-400 block uppercase">{t('priorityQueue.dispatchStatus')}</span>
                      <span className="font-bold text-neutral-800 uppercase">
                        {(c.status || t('priorityQueue.queued')).replace(/_/g, ' ')}
                      </span>
                    </div>
                    {c.estimated_width_cm != null && c.estimated_length_cm != null && (
                      <div>
                        <span className="text-[10px] text-neutral-400 block uppercase">{t('priorityQueue.dimensions')}</span>
                        <span className="font-bold text-neutral-800">
                          {c.estimated_width_cm}×{c.estimated_length_cm} cm
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Score & Action Pillar */}
                <div className="flex md:flex-col items-center md:items-end justify-between w-full md:w-auto border-t md:border-t-0 pt-3 md:pt-0 border-neutral-100 font-mono flex-shrink-0">
                  <div className="text-right">
                    <span className="text-[10px] text-neutral-400 uppercase tracking-wider block">
                      {t('priorityQueue.severityIndex')}
                    </span>
                    <div className="text-2xl font-bold text-neutral-900">
                      {score}<span className="text-xs text-neutral-400 font-normal">/100</span>
                    </div>
                  </div>

                  <div className="mt-2 text-right">
                    <span className="text-xs text-neutral-400 font-bold group-hover:text-black flex items-center gap-1">
                      {t('priorityQueue.dispatchDossier')} <HiChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
