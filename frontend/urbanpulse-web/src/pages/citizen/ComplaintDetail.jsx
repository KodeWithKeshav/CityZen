import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { makeApiCall, apiClient } from '../../services/api'
import toast from 'react-hot-toast'
import {
  HiArrowLeft,
  HiLocationMarker,
  HiThumbUp,
  HiExclamationCircle,
  HiShieldCheck,
  HiShare,
  HiSparkles,
  HiChartBar,
} from 'react-icons/hi'
import { getPriorityTier, normalizePriorityScore, getCategoryLabel } from '../../utils/priorityUtils'
import { useTranslatedObject, useTranslatedList } from '../../context/TranslationContext'
import { formatLocalizedDateTime } from '../../utils/dateLocale'
import ExplainAiModal from '../../components/ExplainAiModal'
import GeometryEstimateCard from '../../components/GeometryEstimateCard'

export default function ComplaintDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation(['citizen', 'admin', 'complaint', 'common'])
  const [complaint, setComplaint] = useState(null)
  const [loading, setLoading] = useState(true)
  const [progress, setProgress] = useState([])
  const [voting, setVoting] = useState(false)
  const [showAiExplainModal, setShowAiExplainModal] = useState(false)
  const [reopening, setReopening] = useState(false)

  const STATUS_CONFIG = {
    pending: { label: t('admin:status.pending'), bg: 'bg-amber-50 text-amber-900 border-amber-300' },
    in_progress: { label: t('admin:status.inProgress'), bg: 'bg-blue-50 text-blue-900 border-blue-300' },
    'in-progress': { label: t('admin:status.inProgress'), bg: 'bg-blue-50 text-blue-900 border-blue-300' },
    resolved: { label: t('admin:status.resolved'), bg: 'bg-emerald-50 text-emerald-900 border-emerald-300' },
    rejected: { label: t('admin:status.rejected'), bg: 'bg-rose-50 text-rose-900 border-rose-300' },
  }

  const translatedComplaint = useTranslatedObject(complaint, [
    'title',
    'complaintTitle',
    'description',
    'location',
    'location_address',
    'citizenName',
  ])
  const translatedAiAnalysis = useTranslatedObject(complaint?.aiAnalysis || null, [
    'sentiment',
    'urgency',
    'summary',
  ])
  const translatedProgress = useTranslatedList(progress, ['status', 'note'])

  const fetchDetail = async () => {
    try {
      const [cRes, pRes] = await Promise.allSettled([
        makeApiCall(apiClient.complaints.byId(id)),
        makeApiCall(apiClient.complaints.progress(id)),
      ])
      let fetchedComplaint = null
      if (cRes.status === 'fulfilled' && cRes.value?.success) {
        const c = cRes.value.complaint || cRes.value.data || {}
        fetchedComplaint = {
          ...c,
          citizenName: c.users?.full_name || c.user?.full_name || c.citizenName || c.user_name || c.full_name || t('citizen:feed.verifiedCitizen'),
          createdAt: c.createdAt || c.created_at,
          imageUrl: c.imageUrl || (Array.isArray(c.image_urls) ? c.image_urls[0] : null),
          location: c.location || {
            address: c.location_address,
            lat: c.location_latitude,
            lng: c.location_longitude,
          },
          votes: c.votes ?? c.vote_count ?? 0,
        }
        setComplaint(fetchedComplaint)
      } else if (cRes.status === 'rejected') {
        toast.error(cRes.reason?.message || t('citizen:complaintDetail.loadFailed'))
      } else if (cRes.status === 'fulfilled' && !cRes.value?.success) {
        toast.error(cRes.value?.message || t('citizen:complaintDetail.loadFailed'))
      }

      if (pRes.status === 'fulfilled' && pRes.value?.success) {
        const data = pRes.value.data || {}
        const stageTimeline = (data.stages || []).map(s => ({
          status: s.stage_name || s.stage_status || s.status,
          note: s.stage_description || s.note,
          updatedAt: s.updated_at || s.updatedAt || s.created_at,
        }))
        const actionTimeline = (data.timeline || []).map(entry => ({
          status: entry.action_type || entry.status || 'UPDATE',
          note: entry.action_description || entry.note,
          updatedAt: entry.created_at || entry.updatedAt,
        }))
        const updatesTimeline = (fetchedComplaint?.updates || []).map(u => ({
          status: u.new_status || u.status || 'UPDATE',
          note: u.update_notes || u.note,
          updatedAt: u.created_at || u.updatedAt,
        }))
        setProgress(
          stageTimeline.length
            ? stageTimeline
            : actionTimeline.length
              ? actionTimeline
              : updatesTimeline
        )
      } else if (fetchedComplaint?.updates?.length) {
        setProgress(
          fetchedComplaint.updates.map(u => ({
            status: u.new_status || u.status || 'UPDATE',
            note: u.update_notes || u.note,
            updatedAt: u.created_at || u.updatedAt,
          }))
        )
      }
    } catch {
      toast.error(t('citizen:complaintDetail.loadFailed'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDetail()
  }, [id])

  const handleVote = async () => {
    if (!complaint) return
    setVoting(true)
    try {
      const res = await makeApiCall(apiClient.complaints.vote(), {
        method: 'POST',
        body: JSON.stringify({ complaintId: id }),
      })
      if (res.success) {
        const voteCount = res?.data?.voteCount
        const currentVotes = complaint.votes ?? complaint.vote_count ?? 0
        const nextVotes = typeof voteCount === 'number' ? voteCount : currentVotes + 1
        setComplaint(prev => ({
          ...prev,
          votes: nextVotes,
          vote_count: nextVotes,
          userVoted: typeof res?.data?.userVoted === 'boolean' ? res.data.userVoted : prev.userVoted,
        }))
        toast.success(
          res?.data?.action === 'unvoted' || res?.data?.action === 'removed'
            ? (res.message || t('citizen:complaintDetail.voteRemoved'))
            : t('citizen:complaintDetail.voteLogged')
        )
      } else {
        toast.error(res.message || t('citizen:complaintDetail.votingUnavailable'))
      }
    } catch (err) {
      toast.error(err.message || t('citizen:complaintDetail.votingUnavailable'))
    } finally {
      setVoting(false)
    }
  }

  const handleReopen = async () => {
    if (!complaint) return
    setReopening(true)
    try {
      const res = await makeApiCall(apiClient.complaints.reopen(id), { method: 'POST' })
      if (res?.success) {
        toast.success(t('citizen:complaintDetail.reopened'))
        setComplaint(prev => ({ ...prev, status: 'in_progress' }))
      } else {
        toast.error(res?.message || t('citizen:complaintDetail.reopenFailed'))
      }
    } catch (err) {
      toast.error(err.message || t('citizen:complaintDetail.reopenFailed'))
    } finally {
      setReopening(false)
    }
  }

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href)
      toast.success(t('citizen:complaintDetail.linkCopied'))
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 p-4 sm:p-6 lg:p-8">
        <div className="h-6 w-32 bg-neutral-200 animate-pulse"></div>
        <div className="border border-neutral-200 p-6 sm:p-8 space-y-4 bg-white">
          <div className="h-8 w-3/4 bg-neutral-200 animate-pulse"></div>
          <div className="h-4 w-1/2 bg-neutral-200 animate-pulse"></div>
          <div className="h-48 w-full bg-neutral-100 animate-pulse"></div>
        </div>
      </div>
    )
  }

  if (!complaint) {
    return (
      <div className="max-w-xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="border border-neutral-300 p-8 sm:p-12 text-center bg-white">
          <HiExclamationCircle className="w-12 h-12 text-neutral-400 mx-auto mb-3" />
          <h2 className="font-serif text-xl font-bold text-neutral-900 uppercase">
            {t('citizen:complaintDetail.notFoundTitle')}
          </h2>
          <p className="text-sm text-neutral-500 font-sans mt-1">
            {t('citizen:complaintDetail.notFoundDesc')}
          </p>
          <button
            onClick={() => navigate(-1)}
            className="mt-6 px-4 py-2 bg-black text-white font-mono text-xs uppercase"
          >
            {t('citizen:complaintDetail.returnToLedger')}
          </button>
        </div>
      </div>
    )
  }

  const activeComplaint = translatedComplaint || complaint
  const activeLang = i18n.resolvedLanguage || i18n.language
  const statusKey = (activeComplaint.status || 'pending').toLowerCase()
  const statusInfo = STATUS_CONFIG[statusKey] || {
    label: (activeComplaint.status || t('admin:status.pending')).toUpperCase(),
    bg: 'bg-neutral-100 text-neutral-800 border-neutral-300',
  }

  const createdAtFormatted = formatLocalizedDateTime(activeComplaint.createdAt, activeLang) || t('citizen:complaintDetail.undated')
  const voteTotal = activeComplaint.votes ?? activeComplaint.vote_count ?? 0

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-4 sm:p-6 lg:p-8 pb-12">
      {/* Navigation header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black pb-3">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-neutral-700 hover:text-black"
        >
          <HiArrowLeft className="w-4 h-4" />
          <span>{t('citizen:complaintDetail.backToLedger')}</span>
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleShare}
            className="px-3 py-1.5 border border-neutral-300 font-mono text-xs text-neutral-700 hover:border-black flex items-center gap-1.5"
          >
            <HiShare className="w-3.5 h-3.5" />
            <span>{t('citizen:complaintDetail.share')}</span>
          </button>
          <button
            onClick={handleVote}
            disabled={voting}
            className="px-4 py-1.5 bg-black text-white font-mono text-xs font-bold uppercase tracking-wider hover:bg-neutral-800 flex items-center gap-1.5 disabled:opacity-50"
          >
            <HiThumbUp className="w-3.5 h-3.5" />
            <span>{activeComplaint.userVoted ? t('citizen:complaintDetail.concurred') : t('citizen:complaintDetail.concur')} ({voteTotal})</span>
          </button>
        </div>
      </div>

      {/* Main Incident Dossier */}
      <div className="border border-neutral-200 bg-white">
        {/* Status header banner */}
        <div className="p-4 sm:p-6 border-b border-neutral-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-neutral-50">
          <div className="min-w-0">
            <div className="font-mono text-xs text-neutral-500 uppercase tracking-widest mb-1 break-all">
              {t('citizen:complaintDetail.recordId', { id })}
            </div>
            <h1 className="font-serif text-xl sm:text-2xl font-bold text-neutral-900 leading-tight">
              {activeComplaint.title || activeComplaint.complaintTitle || t('citizen:complaintDetail.defaultTitle')}
            </h1>
          </div>
          <div className="flex-shrink-0 self-start sm:self-center flex items-center gap-2">
            <span className={`px-3 py-1 border font-mono text-xs tracking-wider uppercase font-bold inline-block ${statusInfo.bg}`}>
              {statusInfo.label}
            </span>
            {statusKey === 'resolved' && (
              <button
                onClick={handleReopen}
                disabled={reopening}
                className="px-3 py-1 border border-black bg-white text-black hover:bg-neutral-100 font-mono text-xs font-bold uppercase tracking-wider disabled:opacity-50"
              >
                {reopening ? t('citizen:complaintDetail.reopening') : t('citizen:complaintDetail.reopen')}
              </button>
            )}
          </div>
        </div>

        {/* Metadata row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 border-b border-neutral-200 gap-px bg-neutral-200 font-mono text-xs">
          <div className="p-4 bg-white">
            <span className="text-neutral-500 uppercase tracking-wider block text-[10px] mb-1">
              {t('citizen:complaintDetail.registeredBy')}
            </span>
            <span className="font-bold text-neutral-900 uppercase truncate block">
              {activeComplaint.citizenName || activeComplaint.users?.full_name || activeComplaint.user?.full_name || activeComplaint.user_name || t('citizen:feed.verifiedCitizen')}
            </span>
          </div>
          <div className="p-4 bg-white">
            <span className="text-neutral-500 uppercase tracking-wider block text-[10px] mb-1">
              {t('citizen:complaintDetail.category')}
            </span>
            <span className="font-bold text-neutral-900 uppercase">
              {(activeComplaint.category || activeComplaint.issueType)
                ? getCategoryLabel(activeComplaint.category || activeComplaint.issueType, t)
                : t('citizen:complaintDetail.unassigned')}
            </span>
          </div>
          <div className="p-4 bg-white">
            <span className="text-neutral-500 uppercase tracking-wider block text-[10px] mb-1">
              {t('citizen:complaintDetail.severityLevel')}
            </span>
            <span className="font-bold text-neutral-900 uppercase">
              {t(`common:priority.${(activeComplaint.priority || 'medium').toLowerCase()}`, activeComplaint.priority || 'MEDIUM')}
            </span>
          </div>
          <div className="p-4 bg-white">
            <span className="text-neutral-500 uppercase tracking-wider block text-[10px] mb-1">
              {t('citizen:complaintDetail.priorityScore')}
            </span>
            {(() => {
              const pTier = getPriorityTier(activeComplaint, t)
              return (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-neutral-900 text-sm">
                    {pTier.displayScore !== '—' ? `${pTier.displayScore} / 100` : t('common:priority.na')}
                  </span>
                  {pTier.score !== null && (
                    <span className={`px-1.5 py-0.5 text-[9px] uppercase tracking-wider font-semibold ${pTier.badgeClass}`}>
                      {pTier.label}
                    </span>
                  )}
                </div>
              )
            })()}
          </div>
          <div className="p-4 bg-white sm:col-span-2 md:col-span-1">
            <span className="text-neutral-500 uppercase tracking-wider block text-[10px] mb-1">
              {t('citizen:complaintDetail.recordTimestamp')}
            </span>
            <span className="font-bold text-neutral-900">{createdAtFormatted}</span>
          </div>
        </div>

        {/* Location & description section */}
        <div className="p-4 sm:p-6 space-y-6">
          {/* Location details */}
          <div className="border border-neutral-200 p-4 bg-neutral-50 flex items-start gap-3">
            <HiLocationMarker className="w-5 h-5 text-neutral-700 flex-shrink-0 mt-0.5" />
            <div className="font-mono text-xs">
              <span className="text-neutral-500 uppercase tracking-wider block mb-0.5">
                {t('citizen:complaintDetail.geoReference')}
              </span>
              <span className="font-semibold text-neutral-900">
                {(typeof activeComplaint.location === 'string' ? activeComplaint.location : activeComplaint.location?.address) || activeComplaint.location_address || t('citizen:complaintDetail.noAddress')}
              </span>
              {(activeComplaint.location?.lat ?? activeComplaint.location?.latitude) != null &&
                (activeComplaint.location?.lng ?? activeComplaint.location?.longitude) != null && (
                  <span className="text-neutral-500 block mt-1">
                    {t('citizen:complaintDetail.gps', {
                      lat: activeComplaint.location.lat ?? activeComplaint.location.latitude,
                      lon: activeComplaint.location.lng ?? activeComplaint.location.longitude,
                    })}
                  </span>
                )}
            </div>
          </div>

          {/* Text narrative */}
          <div>
            <span className="font-mono text-xs uppercase tracking-wider text-neutral-500 block mb-2">
              {t('citizen:complaintDetail.statementHeader')}
            </span>
            <div className="border border-neutral-200 p-5 font-sans text-sm leading-relaxed text-neutral-800 bg-white">
              {activeComplaint.description}
            </div>
          </div>

          {/* Photographic Evidence */}
          {activeComplaint.imageUrl && (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <span className="font-mono text-xs uppercase tracking-wider text-neutral-500">
                  {t('citizen:complaintDetail.photoEvidence')}
                </span>
                <button
                  type="button"
                  onClick={() => setShowAiExplainModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-neutral-900 text-white hover:bg-neutral-800 border border-black font-mono text-[11px] uppercase tracking-wider font-bold transition-colors cursor-pointer"
                >
                  <HiSparkles className="w-3.5 h-3.5 text-neutral-300" />
                  {t('citizen:complaintDetail.explainAi')}
                </button>
              </div>
              <div className="border border-neutral-200 bg-neutral-950 p-2 max-w-xl">
                <img
                  src={activeComplaint.imageUrl}
                  alt={t('citizen:complaintDetail.photoEvidence')}
                  className="w-full h-56 sm:h-72 object-contain"
                  onError={e => { e.target.style.display = 'none' }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Geometry Estimation */}
      <GeometryEstimateCard
        complaint={activeComplaint}
        onGeometryUpdated={(updatedGeom) => {
          setComplaint(prev => ({ ...prev, ...updatedGeom }))
        }}
      />

      {/* AI Verification & Authenticity Analysis */}
      {activeComplaint.aiAnalysis && (
        <div className="border border-neutral-200 bg-white p-4 sm:p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-neutral-200 pb-3">
            <HiShieldCheck className="w-5 h-5 text-neutral-800" />
            <h3 className="font-serif text-base font-bold uppercase tracking-wide text-neutral-900">
              {t('citizen:complaintDetail.neuralAnalysisTitle')}
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 font-mono text-xs">
            {(translatedAiAnalysis?.sentiment || activeComplaint.aiAnalysis.sentiment) && (
              <div className="border border-neutral-200 p-3 bg-neutral-50">
                <span className="text-neutral-500 block text-[10px] uppercase">{t('citizen:complaintDetail.sentiment')}</span>
                <span className="font-bold text-neutral-900 uppercase">
                  {translatedAiAnalysis?.sentiment || activeComplaint.aiAnalysis.sentiment}
                </span>
              </div>
            )}
            {(translatedAiAnalysis?.urgency || activeComplaint.aiAnalysis.urgency) && (
              <div className="border border-neutral-200 p-3 bg-neutral-50">
                <span className="text-neutral-500 block text-[10px] uppercase">{t('citizen:complaintDetail.urgencyRating')}</span>
                <span className="font-bold text-neutral-900 uppercase">
                  {translatedAiAnalysis?.urgency || activeComplaint.aiAnalysis.urgency}
                </span>
              </div>
            )}
            {activeComplaint.aiAnalysis.category && (
              <div className="border border-neutral-200 p-3 bg-neutral-50">
                <span className="text-neutral-500 block text-[10px] uppercase">{t('citizen:complaintDetail.detectedClass')}</span>
                <span className="font-bold text-neutral-900 uppercase">
                  {getCategoryLabel(activeComplaint.aiAnalysis.category, t)}
                </span>
              </div>
            )}
            {activeComplaint.aiAnalysis.isValid !== undefined && (
              <div className="border border-neutral-200 p-3 bg-neutral-50">
                <span className="text-neutral-500 block text-[10px] uppercase">{t('citizen:complaintDetail.corroborated')}</span>
                <span className={`font-bold uppercase ${activeComplaint.aiAnalysis.isValid ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {activeComplaint.aiAnalysis.isValid ? t('citizen:complaintDetail.affirmative') : t('citizen:complaintDetail.suspicious')}
                </span>
              </div>
            )}
          </div>

          {(translatedAiAnalysis?.summary || activeComplaint.aiAnalysis.summary) && (
            <div className="border border-neutral-200 bg-neutral-50 p-4 font-mono text-xs text-neutral-700 leading-relaxed">
              <span className="font-bold text-black uppercase block mb-1">{t('citizen:complaintDetail.synthesis')}</span>
              {translatedAiAnalysis?.summary || activeComplaint.aiAnalysis.summary}
            </div>
          )}
        </div>
      )}

      {/* Progress Lifecycle Timeline */}
      <div className="border border-neutral-200 bg-white p-4 sm:p-6 space-y-4">
        <h3 className="font-serif text-base font-bold uppercase tracking-wide text-neutral-900 border-b border-neutral-200 pb-3">
          {t('citizen:complaintDetail.timelineTitle')}
        </h3>

        {translatedProgress.length > 0 ? (
          <div className="space-y-4 pt-2">
            {translatedProgress.map((stage, idx) => (
              <div key={idx} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-3.5 h-3.5 border-2 border-black bg-neutral-900 flex-shrink-0" />
                  {idx < translatedProgress.length - 1 && (
                    <div className="w-0.5 flex-1 bg-neutral-200 my-1" />
                  )}
                </div>
                <div className="pb-4 font-mono text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold uppercase text-neutral-900 tracking-wider">
                      {stage.status}
                    </span>
                    {formatLocalizedDateTime(stage.updatedAt, activeLang) && (
                      <span className="text-neutral-400 text-[11px]">
                        [{formatLocalizedDateTime(stage.updatedAt, activeLang)}]
                      </span>
                    )}
                  </div>
                  {stage.note && (
                    <p className="text-neutral-600 font-sans text-xs mt-1 leading-relaxed">
                      {stage.note}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="font-mono text-xs text-neutral-500 py-4">
            {t('citizen:complaintDetail.timelineEmpty')}
          </div>
        )}
      </div>

      {/* Priority Engine Diagnostic Breakdown */}
      {(activeComplaint.location_sensitivity_score != null ||
        activeComplaint.ai_confidence_score != null ||
        activeComplaint.emotion_score != null) && (
          <div className="border border-neutral-200 bg-white p-4 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 pb-3">
              <div className="flex items-center gap-2 font-serif font-bold text-sm uppercase text-neutral-900">
                <HiChartBar className="w-5 h-5 text-neutral-800" />
                <span>{t('citizen:complaintDetail.priorityVectorTitle')}</span>
              </div>
              <span className="font-mono text-[10px] uppercase text-neutral-500">
                {t('citizen:complaintDetail.ahpWeighting')}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 font-mono text-xs">
              {normalizePriorityScore(activeComplaint.location_sensitivity_score) !== null && (
                <div className="border border-neutral-200 p-3 bg-neutral-50">
                  <span className="text-[10px] text-neutral-500 uppercase block">{t('citizen:complaintDetail.infraImpact')}</span>
                  <span className="font-bold text-neutral-900 text-sm">
                    {normalizePriorityScore(activeComplaint.location_sensitivity_score)} / 100
                  </span>
                  <span className="text-[10px] text-neutral-400 block mt-0.5">{t('citizen:complaintDetail.emergencyRoutes')}</span>
                </div>
              )}
              {normalizePriorityScore(activeComplaint.ai_confidence_score) !== null && (
                <div className="border border-neutral-200 p-3 bg-neutral-50">
                  <span className="text-[10px] text-neutral-500 uppercase block">{t('citizen:complaintDetail.modelConfidence')}</span>
                  <span className="font-bold text-neutral-900 text-sm">
                    {normalizePriorityScore(activeComplaint.ai_confidence_score)}%
                  </span>
                  <span className="text-[10px] text-neutral-400 block mt-0.5">{t('citizen:complaintDetail.visualVerification')}</span>
                </div>
              )}
              {normalizePriorityScore(activeComplaint.emotion_score) !== null && (
                <div className="border border-neutral-200 p-3 bg-neutral-50">
                  <span className="text-[10px] text-neutral-500 uppercase block">{t('citizen:complaintDetail.severityUrgency')}</span>
                  <span className="font-bold text-neutral-900 text-sm">
                    {normalizePriorityScore(activeComplaint.emotion_score)} / 100
                  </span>
                  <span className="text-[10px] text-neutral-400 block mt-0.5">{t('citizen:complaintDetail.sentimentModel')}</span>
                </div>
              )}
              <div className="border border-neutral-200 p-3 bg-neutral-50">
                <span className="text-[10px] text-neutral-500 uppercase block">{t('citizen:complaintDetail.communityVotes')}</span>
                <span className="font-bold text-neutral-900 text-sm">
                  {t('citizen:complaintDetail.votesCount', { count: voteTotal })}
                </span>
                <span className="text-[10px] text-neutral-400 block mt-0.5">{t('citizen:complaintDetail.crowdVerification')}</span>
              </div>
            </div>
          </div>
        )}

      {/* Explain AI Modal (SAM-3 Vision Diagnostics) */}
      <ExplainAiModal
        isOpen={showAiExplainModal}
        onClose={() => setShowAiExplainModal(false)}
        imageUrl={activeComplaint.imageUrl}
        title={activeComplaint.title || activeComplaint.complaintTitle}
        category={activeComplaint.category || activeComplaint.issueType}
      />
    </div>
  )
}
