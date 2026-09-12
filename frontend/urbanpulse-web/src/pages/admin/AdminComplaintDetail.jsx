import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { makeApiCall, apiClient } from '../../services/api'
import toast from 'react-hot-toast'
import { HiArrowLeft, HiSave, HiExclamationCircle, HiShieldCheck, HiLocationMarker, HiSparkles } from 'react-icons/hi'
import { format } from 'date-fns'
import { getPriorityTier } from '../../utils/priorityUtils'
import ExplainAiModal from '../../components/ExplainAiModal'
import GeometryEstimateCard from '../../components/GeometryEstimateCard'

const STATUSES = ['pending', 'in_progress', 'resolved', 'rejected']

const STATUS_CONFIG = {
  pending: { label: 'PENDING', bg: 'bg-amber-50 text-amber-900 border-amber-300' },
  in_progress: { label: 'IN PROGRESS', bg: 'bg-blue-50 text-blue-900 border-blue-300' },
  resolved: { label: 'RESOLVED', bg: 'bg-emerald-50 text-emerald-900 border-emerald-300' },
  rejected: { label: 'REJECTED', bg: 'bg-rose-50 text-rose-900 border-rose-300' },
}

export default function AdminComplaintDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [complaint, setComplaint] = useState(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [status, setStatus] = useState('')
  const [adminNote, setAdminNote] = useState('')
  const [showAiExplainModal, setShowAiExplainModal] = useState(false)

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await makeApiCall(apiClient.admin.complaintById(id))
        if (res.success && res.data) {
          const mapped = {
            ...res.data,
            createdAt: res.data.createdAt || res.data.created_at,
            complaintTitle: res.data.complaintTitle || res.data.title,
            citizenName:
              res.data.users?.full_name ||
              res.data.user?.full_name ||
              res.data.citizenName ||
              res.data.user_name ||
              res.data.full_name ||
              'Verified Citizen',
            priorityScore: res.data.priorityScore || res.data.priority_score,
            imageUrl: res.data.imageUrl || (Array.isArray(res.data.image_urls) ? res.data.image_urls[0] : undefined),
          }
          setComplaint(mapped)
          setStatus(mapped.status || 'pending')
          setAdminNote(mapped.adminNote || mapped.resolution_notes || '')
        }
      } catch (err) {
        toast.error('Failed to load incident dispatch dossier')
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [id])

  const handleUpdate = async () => {
    setUpdating(true)
    try {
      const res = await makeApiCall(apiClient.complaints.updateStatus(id), {
        method: 'PUT',
        body: JSON.stringify({ status, notes: adminNote }),
      })
      if (res.success) {
        toast.success('Incident status and notes updated in municipal ledger')
        setComplaint(prev => ({ ...prev, status, adminNote, resolution_notes: adminNote }))
      }
    } catch (err) {
      toast.error(err.message || 'Ledger update failed')
    } finally {
      setUpdating(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-4 font-mono text-xs text-neutral-500 py-12">
        <div className="h-6 w-32 bg-neutral-200 animate-pulse" />
        <div className="border border-neutral-200 p-8 h-48 bg-white animate-pulse" />
      </div>
    )
  }

  if (!complaint) {
    return (
      <div className="max-w-xl mx-auto border border-neutral-300 bg-white p-12 text-center my-12">
        <HiExclamationCircle className="w-12 h-12 text-neutral-400 mx-auto mb-3" />
        <h2 className="font-serif text-xl font-bold text-neutral-900 uppercase">
          Incident Record Not Found
        </h2>
        <p className="text-xs text-neutral-500 font-sans mt-1">
          Dossier #{id} does not exist in the municipal registry.
        </p>
        <button
          onClick={() => navigate(-1)}
          className="mt-6 px-4 py-2 bg-black text-white font-mono text-xs uppercase"
        >
          Return to Registry
        </button>
      </div>
    )
  }

  const currentStatusInfo = STATUS_CONFIG[complaint.status] || {
    label: (complaint.status || 'PENDING').toUpperCase(),
    bg: 'bg-neutral-100 text-neutral-800 border-neutral-300'
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-neutral-700 hover:text-black border-b border-transparent hover:border-black transition-all pb-0.5"
      >
        <HiArrowLeft className="w-4 h-4" />
        <span>BACK TO INCIDENT REGISTRY</span>
      </button>

      {/* Main Dossier Header */}
      <div className="border border-neutral-200 bg-white">
        <div className="p-6 border-b border-neutral-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-neutral-50">
          <div>
            <div className="font-mono text-xs text-neutral-500 uppercase tracking-widest mb-1">
              DISPATCH AUDIT DOSSIER · RECORD #{id}
            </div>
            <h1 className="font-serif text-2xl font-bold text-neutral-900 uppercase">
              {complaint.title || complaint.complaintTitle || 'Civic Incident'}
            </h1>
          </div>
          <span className={`px-3 py-1 border font-mono text-xs uppercase tracking-wider font-bold ${currentStatusInfo.bg}`}>
            {currentStatusInfo.label}
          </span>
        </div>

        {/* Metadata Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 border-b border-neutral-200 divide-x divide-neutral-200 font-mono text-xs">
          <div className="p-4">
            <span className="text-neutral-500 uppercase text-[10px] block mb-1">REPORTING CITIZEN</span>
            <span className="font-bold text-neutral-900">{complaint.citizenName || complaint.users?.full_name || complaint.user?.full_name || complaint.user_name || 'Verified Citizen'}</span>
          </div>
          <div className="p-4">
            <span className="text-neutral-500 uppercase text-[10px] block mb-1">CLASSIFICATION</span>
            <span className="font-bold text-neutral-900 uppercase">
              {(complaint.category || complaint.issueType || 'General').replace(/_/g, ' ')}
            </span>
          </div>
          <div className="p-4">
            <span className="text-neutral-500 uppercase text-[10px] block mb-1">PRIORITY SCORE</span>
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
          <div className="p-4 border-t border-neutral-200">
            <span className="text-neutral-500 uppercase text-[10px] block mb-1">RECORDED TIMESTAMP</span>
            <span className="font-bold text-neutral-900">
              {complaint.createdAt ? format(new Date(complaint.createdAt), 'yyyy-MM-dd HH:mm') : '—'}
            </span>
          </div>
          <div className="p-4 border-t border-neutral-200">
            <span className="text-neutral-500 uppercase text-[10px] block mb-1">SEVERITY TIER</span>
            <span className="font-bold text-neutral-900 uppercase">{complaint.priority || 'MEDIUM'}</span>
          </div>
          <div className="p-4 border-t border-neutral-200">
            <span className="text-neutral-500 uppercase text-[10px] block mb-1">CITIZEN CONCURRENCES</span>
            <span className="font-bold text-neutral-900">{complaint.upvotes || complaint.votes || 0} VOTES</span>
          </div>
        </div>

        {/* Narrative & Location */}
        <div className="p-6 space-y-5">
          <div>
            <span className="font-mono text-xs uppercase tracking-wider text-neutral-500 block mb-2">
              RECORDED CITIZEN NARRATIVE
            </span>
            <div className="border border-neutral-200 p-4 font-sans text-sm leading-relaxed text-neutral-800 bg-neutral-50/50">
              {complaint.description}
            </div>
          </div>

          {(complaint.location_address || complaint.location) && (
            <div className="border border-neutral-200 p-4 bg-neutral-50 flex items-start gap-3">
              <HiLocationMarker className="w-5 h-5 text-neutral-700 flex-shrink-0 mt-0.5" />
              <div className="font-mono text-xs">
                <span className="text-neutral-500 uppercase text-[10px] block mb-0.5">
                  GEOGRAPHIC COORDINATE REFERENCE
                </span>
                <span className="font-bold text-neutral-900">
                  {complaint.location_address || complaint.location?.address}
                </span>
                {(complaint.location_latitude || complaint.location?.latitude) && (
                  <span className="text-neutral-500 block mt-1">
                    GPS: {complaint.location_latitude || complaint.location?.latitude},{' '}
                    {complaint.location_longitude || complaint.location?.longitude}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Photo Evidence */}
          {complaint.imageUrl && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-xs uppercase tracking-wider text-neutral-500">
                  VERIFIED FIELD PHOTOGRAPH
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
              <div className="border border-neutral-200 bg-neutral-950 p-2 max-w-lg">
                <img
                  src={complaint.imageUrl}
                  alt="Field evidence"
                  className="w-full h-64 object-contain"
                  onError={e => { e.target.style.display = 'none' }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Geometry Estimation */}
      <GeometryEstimateCard
        complaint={complaint}
        onGeometryUpdated={(updatedGeom) => {
          setComplaint(prev => ({ ...prev, ...updatedGeom }))
        }}
      />

      {/* Neural AI Verification Summary */}
      {complaint.aiAnalysis && (
        <div className="border border-neutral-200 bg-white p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-neutral-200 pb-3 font-serif font-bold text-sm uppercase text-neutral-900">
            <HiShieldCheck className="w-5 h-5" />
            <span>Automated Neural Validation Dossier</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono text-xs">
            {Object.entries(complaint.aiAnalysis)
              .filter(([k, v]) => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')
              .map(([k, v]) => (
                <div key={k} className="border border-neutral-200 p-3 bg-neutral-50">
                  <span className="text-[10px] text-neutral-500 uppercase block">
                    {k.replace(/([A-Z])/g, ' $1')}
                  </span>
                  <span className="font-bold text-neutral-900 uppercase">
                    {String(v)}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Admin Action Box: Status Update & Field Dispatch Notes */}
      <div className="border border-black bg-white p-6 md:p-8 space-y-6">
        <div className="border-b border-neutral-200 pb-3">
          <h3 className="font-serif text-lg font-bold uppercase text-neutral-900">
            Dispatcher Protocol: State Mutation
          </h3>
          <p className="text-xs font-mono text-neutral-500 mt-0.5">
            Modify incident lifecycle state and record official municipal action notes.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block font-mono text-xs uppercase tracking-wider text-neutral-700 mb-2">
              ASSIGN STATUS
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {STATUSES.map(s => {
                const isSelected = status === s
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    className={`py-2.5 px-3 border font-mono text-xs uppercase tracking-wider transition-colors ${
                      isSelected
                        ? 'bg-neutral-900 text-white border-black font-bold'
                        : 'border-neutral-300 text-neutral-700 hover:border-black bg-white'
                    }`}
                  >
                    {s.replace(/_/g, ' ')}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="block font-mono text-xs uppercase tracking-wider text-neutral-700 mb-1">
              OFFICIAL RESOLUTION &amp; FIELD NOTES
            </label>
            <textarea
              value={adminNote}
              onChange={e => setAdminNote(e.target.value)}
              placeholder="Record municipal work order ID, field crew dispatched, timeline update, or closure remarks..."
              className="w-full px-3 py-2 border border-neutral-300 rounded-none text-xs font-mono focus:outline-none focus:border-black h-28 resize-none"
            />
          </div>

          <button
            onClick={handleUpdate}
            disabled={updating}
            className="w-full py-3 bg-black text-white font-mono text-xs font-bold uppercase tracking-wider hover:bg-neutral-800 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {updating ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>COMMITTING TO MUNICIPAL LEDGER...</span>
              </>
            ) : (
              <>
                <HiSave className="w-4 h-4" />
                <span>COMMIT DOSSIER UPDATE →</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Explain AI Modal (SAM-3 Segmentation & Reasoning) */}
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
