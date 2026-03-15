import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { makeApiCall, apiClient } from '../../services/api'
import toast from 'react-hot-toast'
import { HiArrowLeft, HiLocationMarker, HiClock, HiThumbUp, HiExclamationCircle } from 'react-icons/hi'
import { formatDistanceToNow, format } from 'date-fns'

const STATUS_STYLES = {
  pending: 'badge-pending',
  resolved: 'badge-resolved',
  in_progress: 'badge-inprogress',
  'in-progress': 'badge-inprogress',
  rejected: 'badge-rejected',
}

export default function ComplaintDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [complaint, setComplaint] = useState(null)
  const [loading, setLoading] = useState(true)
  const [progress, setProgress] = useState([])

  useEffect(() => {
    const fetch = async () => {
      try {
        const [cRes, pRes] = await Promise.allSettled([
          makeApiCall(apiClient.complaints.byId(id)),
          makeApiCall(apiClient.complaints.progress(id)),
        ])
        if (cRes.status === 'fulfilled' && cRes.value.success) {
           const c = cRes.value.complaint || cRes.value.data || {};
           setComplaint({
             ...c,
             createdAt: c.createdAt || c.created_at,
             imageUrl: c.imageUrl || (c.image_urls && c.image_urls[0]),
             location: c.location || { address: c.location_address, lat: c.location_latitude, lng: c.location_longitude },
             votes: c.votes || c.vote_count || 0
           })
        }
        if (pRes.status === 'fulfilled' && pRes.value.success) {
           const data = pRes.value.data || {}
           const timelineData = (data.stages || []).map(s => ({
              status: s.stage_name || s.stage_status || s.status,
              note: s.stage_description || s.note,
              updatedAt: s.updated_at || s.updatedAt || s.created_at
           }))
           setProgress(timelineData.length ? timelineData : (data.timeline || []))
        }
      } catch (err) {
        toast.error('Failed to load complaint')
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [id])

  if (loading) return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="animate-pulse space-y-4">
        <div className="h-6 bg-gray-200 rounded w-3/4" />
        <div className="h-4 bg-gray-200 rounded w-1/2" />
        <div className="h-32 bg-gray-200 rounded-2xl" />
        <div className="h-4 bg-gray-200 rounded" />
        <div className="h-4 bg-gray-200 rounded w-5/6" />
      </div>
    </div>
  )

  if (!complaint) return (
    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
      <HiExclamationCircle className="w-12 h-12 mb-3" />
      <p>Complaint not found</p>
      <button onClick={() => navigate(-1)} className="mt-4 btn-primary">Go Back</button>
    </div>
  )

  const status = complaint.status || 'pending'
  const createdAt = complaint.createdAt ? format(new Date(complaint.createdAt), 'MMM d, yyyy · h:mm a') : '—'

  return (
    <div className="p-4 max-w-2xl mx-auto fade-in pb-8">
      {/* Back */}
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-5 transition-colors">
        <HiArrowLeft className="w-5 h-5" />
        <span className="text-sm font-medium">Back</span>
      </button>

      {/* Status + Title */}
      <div className="card mb-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <h1 className="text-lg font-bold text-gray-900 leading-tight">{complaint.title || complaint.complaintTitle}</h1>
          <span className={`badge ${STATUS_STYLES[status] || 'badge-pending'} capitalize flex-shrink-0`}>
            {status?.replace(/_/g, ' ')}
          </span>
        </div>

        <div className="flex items-center gap-4 text-xs text-gray-500 mb-4">
          <span className="flex items-center gap-1"><HiClock className="w-3.5 h-3.5" />{createdAt}</span>
          {complaint.location?.address && (
            <span className="flex items-center gap-1 truncate">
              <HiLocationMarker className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate max-w-[160px]">{complaint.location.address}</span>
            </span>
          )}
        </div>

        <p className="text-gray-700 text-sm leading-relaxed">{complaint.description}</p>

        {complaint.imageUrl && (
          <img src={complaint.imageUrl} alt="complaint" className="w-full h-52 object-cover rounded-xl mt-4"
            onError={e => { e.target.style.display = 'none' }} />
        )}
      </div>

      {/* Meta cards */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {[
          { label: 'Category', value: (complaint.category || complaint.issueType)?.replace(/_/g, ' ') || '—' },
          { label: 'Priority', value: complaint.priority || '—' },
          { label: 'Votes', value: complaint.upvotes || complaint.votes || 0, icon: HiThumbUp },
          { label: 'Priority Score', value: complaint.priorityScore ? Math.round(complaint.priorityScore) : '—' },
        ].map(m => (
          <div key={m.label} className="card py-3 px-4">
            <p className="text-xs text-gray-500 mb-1">{m.label}</p>
            <div className="flex items-center gap-1.5">
              {m.icon && <m.icon className="w-4 h-4 text-primary-600" />}
              <p className="font-bold text-gray-800 capitalize">{m.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* AI Analysis */}
      {complaint.aiAnalysis && (
        <div className="card mb-4">
          <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">🤖 AI Analysis</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {complaint.aiAnalysis.sentiment && <div><span className="text-gray-500">Sentiment:</span> <span className="font-medium ml-1 capitalize">{complaint.aiAnalysis.sentiment}</span></div>}
            {complaint.aiAnalysis.urgency && <div><span className="text-gray-500">Urgency:</span> <span className="font-medium ml-1 capitalize">{complaint.aiAnalysis.urgency}</span></div>}
            {complaint.aiAnalysis.category && <div><span className="text-gray-500">Category:</span> <span className="font-medium ml-1 capitalize">{complaint.aiAnalysis.category}</span></div>}
            {complaint.aiAnalysis.isValid !== undefined && (
              <div><span className="text-gray-500">Valid:</span> <span className={`font-medium ml-1 ${complaint.aiAnalysis.isValid ? 'text-green-600' : 'text-red-500'}`}>{complaint.aiAnalysis.isValid ? 'Yes' : 'No'}</span></div>
            )}
          </div>
          {complaint.aiAnalysis.summary && (
            <p className="text-xs text-gray-600 mt-3 bg-gray-50 p-3 rounded-xl">{complaint.aiAnalysis.summary}</p>
          )}
        </div>
      )}

      {/* Progress timeline */}
      {progress.length > 0 && (
        <div className="card">
          <h3 className="font-bold text-gray-800 mb-4">Progress Timeline</h3>
          <div className="space-y-3">
            {progress.map((p, i) => (
              <div key={i} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="w-3 h-3 rounded-full bg-primary-600 flex-shrink-0 mt-1" />
                  {i < progress.length - 1 && <div className="w-0.5 flex-1 bg-gray-200 my-1" />}
                </div>
                <div className="pb-3">
                  <p className="font-medium text-sm text-gray-800">{p.status}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{p.note}</p>
                  {p.updatedAt && <p className="text-xs text-gray-400 mt-0.5">{format(new Date(p.updatedAt), 'MMM d, yyyy')}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
