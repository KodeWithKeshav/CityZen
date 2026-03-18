// AdminComplaintDetail - Stage management and resolution workflow
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { makeApiCall, apiClient } from '../../services/api'
import toast from 'react-hot-toast'
import { HiArrowLeft, HiSave, HiExclamationCircle } from 'react-icons/hi'
import { format } from 'date-fns'

const STATUSES = ['pending', 'in_progress', 'resolved', 'rejected']

export default function AdminComplaintDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [complaint, setComplaint] = useState(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [status, setStatus] = useState('')
  const [adminNote, setAdminNote] = useState('')

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await makeApiCall(apiClient.admin.complaintById(id))
        if (res.success && res.data) {
          const mapped = {
            ...res.data,
            createdAt: res.data.createdAt || res.data.created_at,
            complaintTitle: res.data.complaintTitle || res.data.title,
            citizenName: res.data.citizenName || res.data.user_name || res.data.full_name,
            priorityScore: res.data.priorityScore || res.data.priority_score,
            imageUrl: res.data.imageUrl || (Array.isArray(res.data.image_urls) ? res.data.image_urls[0] : undefined),
          }
          setComplaint(mapped)
          setStatus(mapped.status || 'pending')
          setAdminNote(mapped.adminNote || mapped.resolution_notes || '')
        }
      } catch (err) {
        toast.error('Failed to load complaint')
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
        toast.success('Complaint updated successfully!')
        setComplaint(prev => ({ ...prev, status, adminNote, resolution_notes: adminNote }))
      }
    } catch (err) {
      toast.error(err.message || 'Update failed')
    } finally {
      setUpdating(false)
    }
  }

  if (loading) return (
    <div className="p-4 max-w-2xl mx-auto animate-pulse space-y-4 fade-in">
      <div className="h-6 bg-gray-200 rounded w-3/4" />
      <div className="h-32 bg-gray-200 rounded-2xl" />
    </div>
  )

  if (!complaint) return (
    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
      <HiExclamationCircle className="w-12 h-12 mb-3" />
      <p>Complaint not found</p>
      <button onClick={() => navigate(-1)} className="mt-4 btn-admin">Go Back</button>
    </div>
  )

  const STATUS_BADGE = {
    pending: 'badge-pending',
    resolved: 'badge-resolved',
    in_progress: 'badge-inprogress',
    rejected: 'badge-rejected',
  }

  return (
    <div className="p-4 max-w-2xl mx-auto pb-10 fade-in">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-5 text-sm font-medium transition-colors">
        <HiArrowLeft className="w-5 h-5" /> Back to Complaints
      </button>

      {/* Title + status */}
      <div className="card mb-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <h1 className="text-lg font-bold text-gray-900">{complaint.title || complaint.complaintTitle}</h1>
          <span className={`badge capitalize flex-shrink-0 ${STATUS_BADGE[complaint.status] || 'badge-pending'}`}>
            {complaint.status?.replace(/_/g,' ')}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm mb-4">
          {[
            ['Citizen', complaint.citizenName || '-'],
            ['Category', (complaint.category || complaint.issueType || '-').replace(/_/g,' ')],
            ['Priority', complaint.priority || '-'],
            ['Submitted', complaint.createdAt ? format(new Date(complaint.createdAt), 'MMM d, yyyy') : '-'],
            ['Votes', complaint.upvotes || complaint.votes || 0],
            ['Priority Score', complaint.priorityScore ? Math.round(complaint.priorityScore) : '-'],
          ].map(([k,v]) => (
            <div key={k}>
              <p className="text-gray-500 text-xs">{k}</p>
              <p className="font-medium text-gray-800 capitalize">{v}</p>
            </div>
          ))}
        </div>
        <p className="text-gray-700 text-sm leading-relaxed">{complaint.description}</p>
        {complaint.imageUrl && (
          <img src={complaint.imageUrl} alt="complaint" className="w-full h-48 object-cover rounded-xl mt-4"
            onError={e => { e.target.style.display = 'none' }} />
        )}
      </div>

      {/* Location */}
      {(complaint.location_address || complaint.location) && (
        <div className="card mb-4">
          <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2">Location</h3>
          {<p className="text-sm text-gray-700 mb-1">{complaint.location_address || complaint.location?.address}</p>}
          {(complaint.location_latitude || complaint.location?.latitude) && (
            <p className="text-xs text-gray-400">{complaint.location_latitude || complaint.location?.latitude}, {complaint.location_longitude || complaint.location?.longitude}</p>
          )}
        </div>
      )}

      {/* AI Analysis */}
      {complaint.aiAnalysis && (
        <div className="card mb-4">
          <h3 className="font-bold text-gray-800 mb-3">AI Analysis</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {Object.entries(complaint.aiAnalysis).map(([k, v]) => (
              typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' ? (
                <div key={k}>
                  <p className="text-gray-500 text-xs capitalize">{k.replace(/([A-Z])/g,' $1')}</p>
                  <p className="font-medium text-gray-800 capitalize">{String(v)}</p>
                </div>
              ) : null
            ))}
          </div>
        </div>
      )}

      {/* Update Status */}
      <div className="card">
        <h3 className="font-bold text-gray-800 mb-4">Update Complaint</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Update Status</label>
            <div className="grid grid-cols-2 gap-2">
              {STATUSES.map(s => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`p-2.5 rounded-xl border-2 text-sm font-medium capitalize transition-all
                    ${status === s ? 'border-admin-600 bg-blue-50 text-admin-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                >
                  {s.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Admin Note</label>
            <textarea
              value={adminNote}
              onChange={e => setAdminNote(e.target.value)}
              placeholder="Add a note for the citizen..."
              className="input-admin h-24 resize-none"
            />
          </div>
          <button onClick={handleUpdate} disabled={updating} className="btn-admin w-full flex items-center justify-center gap-2">
            {updating ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" /> : <><HiSave className="w-5 h-5" /> Save Changes</>}
          </button>
        </div>
      </div>
    </div>
  )
}
