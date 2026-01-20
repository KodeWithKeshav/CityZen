import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { makeApiCall, apiClient } from '../../services/api'
import toast from 'react-hot-toast'
import { HiArrowLeft, HiExclamationCircle, HiDocumentText } from 'react-icons/hi'
import { format } from 'date-fns'

const STATUS_STYLES = {
  pending: 'badge-pending',
  resolved: 'badge-resolved',
  in_progress: 'badge-inprogress',
  'in-progress': 'badge-inprogress',
  rejected: 'badge-rejected',
}

export default function CitizenDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [citizen, setCitizen] = useState(null)
  const [complaints, setComplaints] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await makeApiCall(apiClient.admin.citizenById(id))
        if (res.success && res.data) {
          setCitizen(res.data.citizen || res.data)
          setComplaints(res.data.complaints || [])
        }
      } catch (err) {
        toast.error('Failed to load citizen details')
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [id])

  if (loading) return (
    <div className="p-4 max-w-2xl mx-auto animate-pulse space-y-4 fade-in">
      <div className="h-6 bg-gray-200 rounded w-1/2" />
      <div className="h-32 bg-gray-200 rounded-2xl" />
    </div>
  )

  if (!citizen) return (
    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
      <HiExclamationCircle className="w-12 h-12 mb-3" />
      <p>Citizen not found</p>
      <button onClick={() => navigate(-1)} className="mt-4 btn-admin">Go Back</button>
    </div>
  )

  return (
    <div className="p-4 max-w-2xl mx-auto pb-10 fade-in">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-5 text-sm font-medium transition-colors">
        <HiArrowLeft className="w-5 h-5" /> Back to Citizens
      </button>

      {/* Profile card */}
      <div className="card mb-5">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-16 h-16 rounded-2xl bg-violet-100 flex items-center justify-center font-bold text-violet-700 text-2xl">
            {citizen.fullName?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{citizen.fullName || '—'}</h1>
            <p className="text-gray-500 text-sm">{citizen.email}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          {[
            ['Phone', citizen.phoneNumber || '—'],
            ['Address', citizen.address || '—'],
            ['Joined', citizen.createdAt ? format(new Date(citizen.createdAt), 'MMM d, yyyy') : '—'],
            ['Total Complaints', complaints.length],
          ].map(([k, v]) => (
            <div key={k} className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-0.5">{k}</p>
              <p className="font-medium text-gray-800 truncate">{v}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Complaints */}
      <div>
        <h2 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
          <HiDocumentText className="w-5 h-5 text-admin-600" />
          Complaint History ({complaints.length})
        </h2>

        {complaints.length === 0 ? (
          <p className="text-center text-gray-400 py-8 text-sm">No complaints submitted</p>
        ) : (
          <div className="space-y-3">
            {complaints.map(c => (
              <div
                key={c._id || c.id}
                onClick={() => navigate(`/admin/complaints/${c._id || c.id}`)}
                className="card hover:shadow-md transition cursor-pointer"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-gray-800 text-sm flex-1">{c.title || c.complaintTitle}</p>
                  <span className={`badge capitalize flex-shrink-0 ${STATUS_STYLES[c.status] || 'badge-pending'}`}>
                    {c.status?.replace(/_/g,' ')}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1 line-clamp-1">{c.description}</p>
                <p className="text-xs text-gray-400 mt-1.5">
                  {c.createdAt ? format(new Date(c.createdAt), 'MMM d, yyyy') : '—'}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
