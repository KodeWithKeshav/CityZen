import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { makeApiCall, apiClient } from '../../services/api'
import toast from 'react-hot-toast'
import {
  HiArrowLeft,
  HiLocationMarker,
  HiClock,
  HiThumbUp,
  HiExclamationCircle,
  HiShieldCheck,
  HiShare,
  HiSparkles,
  HiChartBar,
} from 'react-icons/hi'
import { formatDistanceToNow, format } from 'date-fns'
import { getPriorityTier, normalizePriorityScore } from '../../utils/priorityUtils'
import ExplainAiModal from '../../components/ExplainAiModal'
import GeometryEstimateCard from '../../components/GeometryEstimateCard'

const STATUS_CONFIG = {
  pending: { label: 'PENDING DISPATCH', bg: 'bg-amber-50 text-amber-900 border-amber-300' },
  in_progress: { label: 'UNDER REMEDIATION', bg: 'bg-blue-50 text-blue-900 border-blue-300' },
  'in-progress': { label: 'UNDER REMEDIATION', bg: 'bg-blue-50 text-blue-900 border-blue-300' },
  resolved: { label: 'RESOLVED & AUDITED', bg: 'bg-emerald-50 text-emerald-900 border-emerald-300' },
  rejected: { label: 'DISMISSED', bg: 'bg-rose-50 text-rose-900 border-rose-300' },
}

export default function ComplaintDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [complaint, setComplaint] = useState(null)
  const [loading, setLoading] = useState(true)
  const [progress, setProgress] = useState([])
  const [voting, setVoting] = useState(false)
  const [showAiExplainModal, setShowAiExplainModal] = useState(false)

  const fetchDetail = async () => {
    try {
      const [cRes, pRes] = await Promise.allSettled([
        makeApiCall(apiClient.complaints.byId(id)),
        makeApiCall(apiClient.complaints.progress(id)),
      ])
      if (cRes.status === 'fulfilled' && cRes.value.success) {
        const c = cRes.value.complaint || cRes.value.data || {}
        setComplaint({
          ...c,
          citizenName: c.users?.full_name || c.user?.full_name || c.citizenName || c.user_name || c.full_name || 'Verified Citizen',
          createdAt: c.createdAt || c.created_at,
          imageUrl: c.imageUrl || (c.image_urls && c.image_urls[0]),
          location: c.location || {
            address: c.location_address,
            lat: c.location_latitude,
            lng: c.location_longitude,
          },
          votes: c.votes || c.vote_count || 0,
        })
      }
      if (pRes.status === 'fulfilled' && pRes.value.success) {
        const data = pRes.value.data || {}
        const timelineData = (data.stages || []).map(s => ({
          status: s.stage_name || s.stage_status || s.status,
          note: s.stage_description || s.note,
          updatedAt: s.updated_at || s.updatedAt || s.created_at,
        }))
        setProgress(timelineData.length ? timelineData : data.timeline || [])
      }
    } catch (err) {
      toast.error('Failed to load incident dispatch detail')
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
        setComplaint(prev => ({
          ...prev,
          votes: typeof voteCount === 'number' ? voteCount : (prev.votes || 0) + 1,
        }))
        toast.success('Civic concurrence vote logged')
      }
    } catch (err) {
      toast.error(err.message || 'Voting unavailable')
    } finally {
      setVoting(false)
    }
  }

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href)
      toast.success('Incident link copied to clipboard')
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="h-6 w-32 bg-neutral-200 animate-pulse"></div>
        <div className="border border-neutral-200 p-8 space-y-4 bg-white">
          <div className="h-8 w-3/4 bg-neutral-200 animate-pulse"></div>
          <div className="h-4 w-1/2 bg-neutral-200 animate-pulse"></div>
          <div className="h-48 w-full bg-neutral-100 animate-pulse"></div>
        </div>
      </div>
    )
  }

  if (!complaint) {
    return (
      <div className="max-w-xl mx-auto border border-neutral-300 p-12 text-center bg-white">
        <HiExclamationCircle className="w-12 h-12 text-neutral-400 mx-auto mb-3" />
        <h2 className="font-serif text-xl font-bold text-neutral-900 uppercase">
          Record Not Found
        </h2>
        <p className="text-sm text-neutral-500 font-sans mt-1">
          The requested dispatch record could not be retrieved from the municipal registry.
        </p>
        <button
          onClick={() => navigate(-1)}
          className="mt-6 px-4 py-2 bg-black text-white font-mono text-xs uppercase"
        >
          Return to Ledger
        </button>
      </div>
    )
  }

  const statusKey = (complaint.status || 'pending').toLowerCase()
  const statusInfo = STATUS_CONFIG[statusKey] || {
    label: (complaint.status || 'PENDING').toUpperCase(),
    bg: 'bg-neutral-100 text-neutral-800 border-neutral-300',
  }

  const createdAtFormatted = complaint.createdAt
    ? format(new Date(complaint.createdAt), 'yyyy-MM-dd · HH:mm')
    : 'UNDATED'

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Navigation header */}
      <div className="flex items-center justify-between border-b border-black pb-3">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-neutral-700 hover:text-black"
        >
          <HiArrowLeft className="w-4 h-4" />
          <span>BACK TO INCIDENT LEDGER</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={handleShare}
            className="px-3 py-1.5 border border-neutral-300 font-mono text-xs text-neutral-700 hover:border-black flex items-center gap-1.5"
          >
            <HiShare className="w-3.5 h-3.5" />
            <span>SHARE</span>
          </button>
          <button
            onClick={handleVote}
            disabled={voting}
            className="px-4 py-1.5 bg-black text-white font-mono text-xs font-bold uppercase tracking-wider hover:bg-neutral-800 flex items-center gap-1.5 disabled:opacity-50"
          >
            <HiThumbUp className="w-3.5 h-3.5" />
            <span>CONCUR ({complaint.votes || 0})</span>
          </button>
        </div>
      </div>

      {/* Main Incident Dossier */}
      <div className="border border-neutral-200 bg-white">
        {/* Status header banner */}
        <div className="p-6 border-b border-neutral-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-neutral-50">
          <div>
            <div className="font-mono text-xs text-neutral-500 uppercase tracking-widest mb-1">
              RECORD ID: #{id}
            </div>
            <h1 className="font-serif text-2xl font-bold text-neutral-900 leading-tight">
              {complaint.title || complaint.complaintTitle || 'Civic Infrastructure Incident'}
            </h1>
          </div>
          <div className="flex-shrink-0">
            <span className={`px-3 py-1 border font-mono text-xs tracking-wider uppercase font-bold ${statusInfo.bg}`}>
              {statusInfo.label}
            </span>
          </div>
        </div>

        {/* Metadata row */}
        <div className="grid grid-cols-2 md:grid-cols-5 border-b border-neutral-200 divide-x divide-neutral-200 font-mono text-xs">
          <div className="p-4">
            <span className="text-neutral-500 uppercase tracking-wider block text-[10px] mb-1">
              REGISTERED BY
            </span>
            <span className="font-bold text-neutral-900 uppercase truncate block">
              {complaint.citizenName || complaint.users?.full_name || complaint.user?.full_name || complaint.user_name || 'Verified Citizen'}
            </span>
          </div>
          <div className="p-4">
            <span className="text-neutral-500 uppercase tracking-wider block text-[10px] mb-1">
              CATEGORY
            </span>
            <span className="font-bold text-neutral-900 uppercase">
              {(complaint.category || complaint.issueType || 'Unassigned').replace(/_/g, ' ')}
            </span>
          </div>
          <div className="p-4">
            <span className="text-neutral-500 uppercase tracking-wider block text-[10px] mb-1">
              SEVERITY LEVEL
            </span>
            <span className="font-bold text-neutral-900 uppercase">
              {complaint.priority || 'MEDIUM'}
            </span>
          </div>
          <div className="p-4">
            <span className="text-neutral-500 uppercase tracking-wider block text-[10px] mb-1">
              PRIORITY SCORE
            </span>
            {(() => {
              const pTier = getPriorityTier(complaint)
              return (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-neutral-900 text-sm">
                    {pTier.displayScore !== '—' ? `${pTier.displayScore} / 100` : 'N/A'}
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
          <div className="p-4">
            <span className="text-neutral-500 uppercase tracking-wider block text-[10px] mb-1">
              RECORD TIMESTAMP
            </span>
            <span className="font-bold text-neutral-900">{createdAtFormatted}</span>
          </div>
        </div>

        {/* Location & description section */}
        <div className="p-6 space-y-6">
          {/* Location details */}
          <div className="border border-neutral-200 p-4 bg-neutral-50 flex items-start gap-3">
            <HiLocationMarker className="w-5 h-5 text-neutral-700 flex-shrink-0 mt-0.5" />
            <div className="font-mono text-xs">
              <span className="text-neutral-500 uppercase tracking-wider block mb-0.5">
                GEOSPATIAL REFERENCE
              </span>
              <span className="font-semibold text-neutral-900">
                {complaint.location?.address || 'Municipal Zone Address Not Specified'}
              </span>
              {(complaint.location?.lat || complaint.location?.latitude) && (
                <span className="text-neutral-500 block mt-1">
                  GPS: {complaint.location.lat || complaint.location.latitude},{' '}
                  {complaint.location.lng || complaint.location.longitude}
                </span>
              )}
            </div>
          </div>

          {/* Text narrative */}
          <div>
            <span className="font-mono text-xs uppercase tracking-wider text-neutral-500 block mb-2">
              CITIZEN STATEMENT &amp; FIELD NOTES
            </span>
            <div className="border border-neutral-200 p-5 font-sans text-sm leading-relaxed text-neutral-800 bg-white">
              {complaint.description}
            </div>
          </div>

          {/* Photographic Evidence */}
          {complaint.imageUrl && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-xs uppercase tracking-wider text-neutral-500">
                  PHOTOGRAPHIC EVIDENCE ATTACHED
                </span>
                <button
                  type="button"
                  onClick={() => setShowAiExplainModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-neutral-900 text-white hover:bg-neutral-800 border border-black font-mono text-[11px] uppercase tracking-wider font-bold transition-colors cursor-pointer"
                >
                  <HiSparkles className="w-3.5 h-3.5 text-neutral-300" />
                  EXPLAIN AI (SAM-3)
                </button>
              </div>
              <div className="border border-neutral-200 bg-neutral-950 p-2 max-w-xl">
                <img
                  src={complaint.imageUrl}
                  alt="Incident evidence"
                  className="w-full h-72 object-contain"
                  onError={e => { e.target.style.display = 'none' }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Geometry & Pothole Depth Estimation */}
      <GeometryEstimateCard
        complaint={complaint}
        onGeometryUpdated={(updatedGeom) => {
          setComplaint(prev => ({ ...prev, ...updatedGeom }))
        }}
      />

      {/* AI Verification & Authenticity Analysis */}
      {complaint.aiAnalysis && (
        <div className="border border-neutral-200 bg-white p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-neutral-200 pb-3">
            <HiShieldCheck className="w-5 h-5 text-neutral-800" />
            <h3 className="font-serif text-base font-bold uppercase tracking-wide text-neutral-900">
              Automated Neural Analysis &amp; Verification
            </h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
            {complaint.aiAnalysis.sentiment && (
              <div className="border border-neutral-200 p-3 bg-neutral-50">
                <span className="text-neutral-500 block text-[10px] uppercase">SENTIMENT</span>
                <span className="font-bold text-neutral-900 uppercase">
                  {complaint.aiAnalysis.sentiment}
                </span>
              </div>
            )}
            {complaint.aiAnalysis.urgency && (
              <div className="border border-neutral-200 p-3 bg-neutral-50">
                <span className="text-neutral-500 block text-[10px] uppercase">URGENCY RATING</span>
                <span className="font-bold text-neutral-900 uppercase">
                  {complaint.aiAnalysis.urgency}
                </span>
              </div>
            )}
            {complaint.aiAnalysis.category && (
              <div className="border border-neutral-200 p-3 bg-neutral-50">
                <span className="text-neutral-500 block text-[10px] uppercase">DETECTED CLASS</span>
                <span className="font-bold text-neutral-900 uppercase">
                  {complaint.aiAnalysis.category}
                </span>
              </div>
            )}
            {complaint.aiAnalysis.isValid !== undefined && (
              <div className="border border-neutral-200 p-3 bg-neutral-50">
                <span className="text-neutral-500 block text-[10px] uppercase">CORROBORATED</span>
                <span className={`font-bold uppercase ${complaint.aiAnalysis.isValid ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {complaint.aiAnalysis.isValid ? 'AFFIRMATIVE' : 'SUSPICIOUS'}
                </span>
              </div>
            )}
          </div>

          {complaint.aiAnalysis.summary && (
            <div className="border border-neutral-200 bg-neutral-50 p-4 font-mono text-xs text-neutral-700 leading-relaxed">
              <span className="font-bold text-black uppercase block mb-1">SYNTHESIS:</span>
              {complaint.aiAnalysis.summary}
            </div>
          )}
        </div>
      )}

      {/* Progress Lifecycle Timeline */}
      <div className="border border-neutral-200 bg-white p-6 space-y-4">
        <h3 className="font-serif text-base font-bold uppercase tracking-wide text-neutral-900 border-b border-neutral-200 pb-3">
          Remediation Sequence &amp; Dispatch Timeline
        </h3>

        {progress.length > 0 ? (
          <div className="space-y-4 pt-2">
            {progress.map((stage, idx) => (
              <div key={idx} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-3.5 h-3.5 border-2 border-black bg-neutral-900 flex-shrink-0" />
                  {idx < progress.length - 1 && (
                    <div className="w-0.5 flex-1 bg-neutral-200 my-1" />
                  )}
                </div>
                <div className="pb-4 font-mono text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold uppercase text-neutral-900 tracking-wider">
                      {stage.status}
                    </span>
                    {stage.updatedAt && (
                      <span className="text-neutral-400 text-[11px]">
                        [{format(new Date(stage.updatedAt), 'yyyy-MM-dd HH:mm')}]
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
            Initial dispatch logged. Queue assignment pending dispatcher review.
          </div>
        )}
      </div>

      {/* Priority Engine Diagnostic Breakdown */}
      {(complaint.location_sensitivity_score !== undefined ||
        complaint.ai_confidence_score !== undefined ||
        complaint.emotion_score !== undefined) && (
        <div className="border border-neutral-200 bg-white p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
            <div className="flex items-center gap-2 font-serif font-bold text-sm uppercase text-neutral-900">
              <HiChartBar className="w-5 h-5 text-neutral-800" />
              <span>Algorithmic Priority Vector Analysis</span>
            </div>
            <span className="font-mono text-[10px] uppercase text-neutral-500">
              AHP MULTI-CRITERIA WEIGHTING
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
            {complaint.location_sensitivity_score !== undefined && (
              <div className="border border-neutral-200 p-3 bg-neutral-50">
                <span className="text-[10px] text-neutral-500 uppercase block">INFRASTRUCTURE IMPACT</span>
                <span className="font-bold text-neutral-900 text-sm">
                  {normalizePriorityScore(complaint.location_sensitivity_score)} / 100
                </span>
                <span className="text-[10px] text-neutral-400 block mt-0.5">Emergency access routes</span>
              </div>
            )}
            {complaint.ai_confidence_score !== undefined && (
              <div className="border border-neutral-200 p-3 bg-neutral-50">
                <span className="text-[10px] text-neutral-500 uppercase block">MODEL CONFIDENCE</span>
                <span className="font-bold text-neutral-900 text-sm">
                  {normalizePriorityScore(complaint.ai_confidence_score)}%
                </span>
                <span className="text-[10px] text-neutral-400 block mt-0.5">Visual verification</span>
              </div>
            )}
            {complaint.emotion_score !== undefined && (
              <div className="border border-neutral-200 p-3 bg-neutral-50">
                <span className="text-[10px] text-neutral-500 uppercase block">SEVERITY / URGENCY</span>
                <span className="font-bold text-neutral-900 text-sm">
                  {normalizePriorityScore(complaint.emotion_score)} / 100
                </span>
                <span className="text-[10px] text-neutral-400 block mt-0.5">Citizen sentiment model</span>
              </div>
            )}
            <div className="border border-neutral-200 p-3 bg-neutral-50">
              <span className="text-[10px] text-neutral-500 uppercase block">COMMUNITY VOTES</span>
              <span className="font-bold text-neutral-900 text-sm">
                {complaint.votes || complaint.vote_count || 0} VOTES
              </span>
              <span className="text-[10px] text-neutral-400 block mt-0.5">Civic crowd verification</span>
            </div>
          </div>
        </div>
      )}

      {/* Explain AI Modal (SAM-3 Vision Diagnostics) */}
      <ExplainAiModal
        isOpen={showAiExplainModal}
        onClose={() => setShowAiExplainModal(false)}
        imageUrl={complaint.imageUrl}
        title={complaint.title || complaint.complaintTitle}
        category={complaint.category}
      />
    </div>
  )
}
