import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { makeApiCall, apiClient } from '../../services/api'
import toast from 'react-hot-toast'
import { HiDocumentReport, HiPlusCircle, HiExclamationCircle } from 'react-icons/hi'
import { format } from 'date-fns'

const STATUS_STYLES = {
  pending: 'badge-pending',
  resolved: 'badge-resolved',
  in_progress: 'badge-inprogress',
  'in-progress': 'badge-inprogress',
  rejected: 'badge-rejected',
}

export default function PersonalReports() {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await makeApiCall(apiClient.complaints.personalReports)
        if (res.success) {
          const arr = res.data?.complaints || res.complaints || res.data || []
          setReports(Array.isArray(arr) ? arr : Object.values(arr).filter(x => typeof x === 'object'))
        }
      } catch (err) {
        toast.error('Failed to load your reports')
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [])

  return (
    <div className="p-4 max-w-2xl mx-auto fade-in pb-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">My Reports</h1>
          <p className="text-sm text-gray-500">{reports.length} complaints submitted</p>
        </div>
        <button onClick={() => navigate('/citizen/submit')} className="btn-primary flex items-center gap-2 text-sm">
          <HiPlusCircle className="w-4 h-4" /> New Report
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-20 skeleton rounded-2xl" />)}
        </div>
      ) : reports.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <HiDocumentReport className="w-12 h-12 mb-3" />
          <p className="font-medium">No reports yet</p>
          <p className="text-sm mt-1">Start by submitting your first report</p>
          <button onClick={() => navigate('/citizen/submit')} className="btn-primary mt-4">Submit Report</button>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map(r => (
            <div
              key={r._id || r.id}
              onClick={() => navigate(`/citizen/complaint/${r._id || r.id}`)}
              className="card hover:shadow-md transition-all cursor-pointer fade-in"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center flex-shrink-0">
                  <HiDocumentReport className="w-5 h-5 text-primary-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-gray-800 text-sm truncate">{r.title || r.complaintTitle}</p>
                    <span className={`badge ${STATUS_STYLES[r.status] || 'badge-pending'} capitalize flex-shrink-0 text-xs`}>
                      {r.status?.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 line-clamp-1">{r.description}</p>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-xs text-gray-400">
                      {r.createdAt ? format(new Date(r.createdAt), 'MMM d, yyyy') : '—'}
                    </span>
                    {(r.category || r.issueType) && (
                      <span className="text-xs bg-primary-50 text-primary-700 px-2 py-0.5 rounded-full">
                        {(r.category || r.issueType)?.replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
