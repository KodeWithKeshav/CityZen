import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { makeApiCall, apiClient } from '../../services/api'
import toast from 'react-hot-toast'
import { HiArrowLeft, HiExclamationCircle, HiShieldCheck, HiLocationMarker, HiSparkles } from 'react-icons/hi'
import { formatLocalizedDateTime } from '../../utils/dateLocale'
import { getPriorityTier, getCategoryLabel } from '../../utils/priorityUtils'
import { useTranslatedObject } from '../../context/TranslationContext'
import ExplainAiModal from '../../components/ExplainAiModal'
import GeometryEstimateCard from '../../components/GeometryEstimateCard'
import ScoreBreakdownPanel from '../../components/admin/ScoreBreakdownPanel'
import EmotionExplainPanel from '../../components/admin/EmotionExplainPanel'
import ComplaintWorkflowPanel from '../../components/admin/ComplaintWorkflowPanel'

export default function AdminComplaintDetail() {
  const { t, i18n } = useTranslation(['admin', 'citizen', 'complaint', 'common'])
  const { id } = useParams()
  const navigate = useNavigate()
  const [complaint, setComplaint] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showAiExplainModal, setShowAiExplainModal] = useState(false)

  const STATUS_CONFIG = {
    pending: { label: t('status.pending'), bg: 'bg-amber-50 text-amber-900 border-amber-300' },
    in_progress: { label: t('status.inProgress'), bg: 'bg-blue-50 text-blue-900 border-blue-300' },
    'in-progress': { label: t('status.inProgress'), bg: 'bg-blue-50 text-blue-900 border-blue-300' },
    resolved: { label: t('status.resolved'), bg: 'bg-emerald-50 text-emerald-900 border-emerald-300' },
    rejected: { label: t('status.rejected'), bg: 'bg-rose-50 text-rose-900 border-rose-300' },
  }

  const translatedComplaint = useTranslatedObject(complaint, [
    'title',
    'complaintTitle',
    'description',
    'location_address',
    'content_flag_reason',
    'citizenName',
  ])

  useEffect(() => {
    let cancelled = false
    const fetchComplaint = async () => {
      setLoading(true)
      setComplaint(null)
      try {
        const res = await makeApiCall(apiClient.admin.complaintById(id))
        if (cancelled) return
        if (res?.success && res?.data) {
          const mapped = {
            ...res.data,
            createdAt: res.data.createdAt || res.data.created_at,
            complaintTitle: res.data.complaintTitle || res.data.title,
            location_address: res.data.location_address || res.data.location?.address,
            citizenName:
              res.data.users?.full_name ||
              res.data.user?.full_name ||
              res.data.citizenName ||
              res.data.user_name ||
              res.data.full_name ||
              t('verifiedCitizen'),
            priorityScore: res.data.priorityScore ?? res.data.priority_score,
            imageUrl: res.data.imageUrl || (Array.isArray(res.data.image_urls) ? res.data.image_urls[0] : undefined),
          }
          setComplaint(mapped)
        } else {
          toast.error(res?.message || res?.error || t('complaintDossier.loadFailed'))
        }
      } catch (err) {
        if (!cancelled) {
          toast.error(err.message || t('complaintDossier.loadFailed'))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchComplaint()
    return () => { cancelled = true }
  }, [id])

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-4 font-mono text-xs text-neutral-500 p-4 sm:p-6 lg:p-8 py-12">
        <div className="h-6 w-32 bg-neutral-200 animate-pulse" />
        <div className="border border-neutral-200 p-6 sm:p-8 h-48 bg-white animate-pulse" />
      </div>
    )
  }

  if (!complaint) {
    return (
      <div className="max-w-xl mx-auto p-4 sm:p-6 lg:p-8 my-6 sm:my-12">
        <div className="border border-neutral-300 bg-white p-8 sm:p-12 text-center">
          <HiExclamationCircle className="w-12 h-12 text-neutral-400 mx-auto mb-3" />
          <h2 className="font-serif text-xl font-bold text-neutral-900 uppercase">
            {t('complaintDossier.notFoundTitle')}
          </h2>
          <p className="text-xs text-neutral-500 font-sans mt-1 break-all">
            {t('complaintDossier.notFoundDesc', { id })}
          </p>
          <button
            onClick={() => navigate(-1)}
            className="mt-6 px-4 py-2 bg-black text-white font-mono text-xs uppercase"
          >
            {t('complaintDossier.returnToRegistry')}
          </button>
        </div>
      </div>
    )
  }

  const activeComplaint = translatedComplaint || complaint
  const statusKey = (activeComplaint.status || 'pending').toLowerCase()
  const currentStatusInfo = STATUS_CONFIG[statusKey] || {
    label: (activeComplaint.status || t('status.pending')).toUpperCase(),
    bg: 'bg-neutral-100 text-neutral-800 border-neutral-300'
  }
  const pTier = getPriorityTier(activeComplaint, t)
  const createdAtStr = formatLocalizedDateTime(activeComplaint.createdAt, i18n.language) || '—'
  const gpsLat = activeComplaint.location_latitude ?? activeComplaint.location?.latitude ?? activeComplaint.location?.lat
  const gpsLng = activeComplaint.location_longitude ?? activeComplaint.location?.longitude ?? activeComplaint.location?.lng
  const authScoreNum = Number(activeComplaint.text_authenticity_score)
  const hasAuthenticityScore =
    activeComplaint.text_authenticity_score !== null &&
    activeComplaint.text_authenticity_score !== undefined &&
    activeComplaint.text_authenticity_score !== '' &&
    !Number.isNaN(authScoreNum)
  const categoryLabel = getCategoryLabel(activeComplaint.category || activeComplaint.issueType, t) || t('complaintDossier.civicIncident')
  const displayTitle = activeComplaint.title || activeComplaint.complaintTitle || t('complaintDossier.civicIncident')

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-4 sm:p-6 lg:p-8 pb-12">
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-neutral-700 hover:text-black border-b border-transparent hover:border-black transition-all pb-0.5"
      >
        <HiArrowLeft className="w-4 h-4" />
        <span>{t('complaintDossier.backToRegistry')}</span>
      </button>

      {/* Main Dossier Header */}
      <div className="border border-neutral-200 bg-white">
        <div className="p-4 sm:p-6 border-b border-neutral-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-neutral-50">
          <div className="min-w-0">
            <div className="font-mono text-xs text-neutral-500 uppercase tracking-widest mb-1 break-all">
              {t('complaintDossier.dossierHeader', { id })}
            </div>
            <h1 className="font-serif text-xl sm:text-2xl font-bold text-neutral-900 uppercase">
              {displayTitle}
            </h1>
          </div>
          <span className={`self-start sm:self-center flex-shrink-0 px-3 py-1 border font-mono text-xs uppercase tracking-wider font-bold ${currentStatusInfo.bg}`}>
            {currentStatusInfo.label}
          </span>
        </div>

        {/* Metadata Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 border-b border-neutral-200 gap-px bg-neutral-200 font-mono text-xs">
          <div className="p-4 bg-white">
            <span className="text-neutral-500 uppercase text-[10px] block mb-1">{t('complaintDossier.reportingCitizen')}</span>
            <span className="font-bold text-neutral-900">{activeComplaint.citizenName || activeComplaint.users?.full_name || activeComplaint.user?.full_name || activeComplaint.user_name || t('verifiedCitizen')}</span>
          </div>
          <div className="p-4 bg-white">
            <span className="text-neutral-500 uppercase text-[10px] block mb-1">{t('complaintDossier.classification')}</span>
            <span className="font-bold text-neutral-900 uppercase">
              {categoryLabel}
            </span>
          </div>
          <div className="p-4 bg-white">
            <span className="text-neutral-500 uppercase text-[10px] block mb-1">{t('complaintDossier.priorityScore')}</span>
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
          </div>
          <div className="p-4 bg-white">
            <span className="text-neutral-500 uppercase text-[10px] block mb-1">{t('complaintDossier.recordedTimestamp')}</span>
            <span className="font-bold text-neutral-900">
              {createdAtStr}
            </span>
          </div>
          <div className="p-4 bg-white">
            <span className="text-neutral-500 uppercase text-[10px] block mb-1">{t('complaintDossier.severityTier')}</span>
            <span className="font-bold text-neutral-900 uppercase">
              {pTier.score !== null ? pTier.label : t('common:priority.medium')}
            </span>
          </div>
          <div className="p-4 bg-white">
            <span className="text-neutral-500 uppercase text-[10px] block mb-1">{t('complaintDossier.citizenConcurrences')}</span>
            <span className="font-bold text-neutral-900">
              {t('complaintDossier.votesCount', { count: activeComplaint.vote_count ?? activeComplaint.upvotes ?? activeComplaint.votes ?? 0 })}
            </span>
          </div>
        </div>

        {/* Narrative & Location */}
        <div className="p-4 sm:p-6 space-y-5">
          <div>
            <span className="font-mono text-xs uppercase tracking-wider text-neutral-500 block mb-2">
              {t('complaintDossier.recordedNarrative')}
            </span>
            <div className="border border-neutral-200 p-4 font-sans text-sm leading-relaxed text-neutral-800 bg-neutral-50/50">
              {activeComplaint.description}
            </div>
          </div>

          {(activeComplaint.location_address || activeComplaint.location || (gpsLat != null && gpsLng != null)) && (
            <div className="border border-neutral-200 p-4 bg-neutral-50 flex items-start gap-3">
              <HiLocationMarker className="w-5 h-5 text-neutral-700 flex-shrink-0 mt-0.5" />
              <div className="font-mono text-xs">
                <span className="text-neutral-500 uppercase text-[10px] block mb-0.5">
                  {t('complaintDossier.geoReference')}
                </span>
                <span className="font-bold text-neutral-900">
                  {activeComplaint.location_address || activeComplaint.location?.address || t('complaintDossier.coordsLogged')}
                </span>
                {gpsLat != null && gpsLng != null && (
                  <span className="text-neutral-500 block mt-1">
                    {t('complaintDossier.gps', { lat: gpsLat, lon: gpsLng })}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Photo Evidence */}
          {activeComplaint.imageUrl && (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <span className="font-mono text-xs uppercase tracking-wider text-neutral-500">
                  {t('complaintDossier.verifiedPhoto')}
                </span>
                <button
                  type="button"
                  onClick={() => setShowAiExplainModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-neutral-900 text-white hover:bg-neutral-800 border border-black font-mono text-[11px] uppercase tracking-wider font-bold transition-colors cursor-pointer"
                >
                  <HiSparkles className="w-3.5 h-3.5 text-neutral-300" />
                  {t('complaintDossier.explainAi')}
                </button>
              </div>
              <div className="border border-neutral-200 bg-neutral-950 p-2 max-w-lg">
                <img
                  src={activeComplaint.imageUrl}
                  alt={displayTitle}
                  className="w-full h-56 sm:h-64 object-contain"
                  onError={e => { e.target.style.display = 'none' }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Score Breakdown (collapsible) */}
      <ScoreBreakdownPanel breakdown={activeComplaint.priority_breakdown} />

      {/* Emotion model explanation (SHAP) -- uses the ORIGINAL description, not the UI-translated one */}
      <EmotionExplainPanel text={complaint?.description} />

      {/* Geometry Estimation */}
      <GeometryEstimateCard
        complaint={activeComplaint}
        onGeometryUpdated={(updatedGeom) => {
          setComplaint(prev => ({ ...prev, ...updatedGeom }))
        }}
      />

      {/* Neural AI Verification Summary */}
      {activeComplaint.aiAnalysis && (
        <div className="border border-neutral-200 bg-white p-4 sm:p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-neutral-200 pb-3 font-serif font-bold text-sm uppercase text-neutral-900">
            <HiShieldCheck className="w-5 h-5" />
            <span>{t('complaintDossier.neuralValidation')}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 font-mono text-xs">
            {Object.entries(activeComplaint.aiAnalysis)
              .filter(([k, v]) => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')
              .map(([k, v]) => (
                <div key={k} className="border border-neutral-200 p-3 bg-neutral-50">
                  <span className="text-[10px] text-neutral-500 uppercase block">
                    {k.replace(/([A-Z])/g, ' $1')}
                  </span>
                  <span className="font-bold text-neutral-900 uppercase break-words">
                    {String(v)}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Authenticity Check (rule-based + multilingual model blend) */}
      {hasAuthenticityScore && (
        <div className={`border bg-white p-4 sm:p-6 space-y-3 ${activeComplaint.content_flagged ? 'border-rose-300' : 'border-neutral-200'}`}>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 pb-3">
            <div className="flex items-center gap-2 font-serif font-bold text-sm uppercase text-neutral-900">
              <HiShieldCheck className="w-5 h-5" />
              <span>{t('complaintDossier.authenticityCheck')}</span>
            </div>
            {activeComplaint.content_flagged && (
              <span className="px-2 py-0.5 border border-rose-300 bg-rose-50 text-rose-900 font-mono text-[10px] uppercase tracking-wider font-bold">
                {t('complaintDossier.flaggedForReview')}
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
            <div className="border border-neutral-200 p-3 bg-neutral-50">
              <span className="text-[10px] text-neutral-500 uppercase block">{t('complaintDossier.authenticityScore')}</span>
              <span className="font-bold text-neutral-900">
                {(authScoreNum <= 1 ? authScoreNum * 100 : authScoreNum).toFixed(0)} / 100
              </span>
            </div>
            <div className="border border-neutral-200 p-3 bg-neutral-50">
              <span className="text-[10px] text-neutral-500 uppercase block">{t('complaintDossier.verificationStatus')}</span>
              <span className="font-bold text-neutral-900 uppercase">{(activeComplaint.verification_status || 'unverified').replace(/_/g, ' ')}</span>
            </div>
            <div className="border border-neutral-200 p-3 bg-neutral-50">
              <span className="text-[10px] text-neutral-500 uppercase block">{t('complaintDossier.capturedLanguage')}</span>
              <span className="font-bold text-neutral-900 uppercase">{activeComplaint.language || 'en'}</span>
            </div>
          </div>
          {activeComplaint.content_flag_reason && (
            <div className="border border-neutral-200 p-3 bg-neutral-50 font-sans text-xs text-neutral-700">
              {activeComplaint.content_flag_reason}
            </div>
          )}
        </div>
      )}

      {/* Municipal Complaint Workflow: Initial Review -> Assessment -> Resolution */}
      <ComplaintWorkflowPanel complaintId={id} />

      {/* Explain AI Modal (SAM-3 Segmentation & Reasoning) */}
      <ExplainAiModal
        isOpen={showAiExplainModal}
        onClose={() => setShowAiExplainModal(false)}
        imageUrl={activeComplaint.imageUrl}
        title={displayTitle}
        category={activeComplaint.category || activeComplaint.issueType}
      />
    </div>
  )
}
