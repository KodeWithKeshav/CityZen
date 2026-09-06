import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { makeApiCall, apiClient } from '../../services/api'
import toast from 'react-hot-toast'
import { HiDocumentReport, HiPlus, HiExclamationCircle, HiChevronRight, HiFilter } from 'react-icons/hi'
import { format } from 'date-fns'
import { getPriorityTier } from '../../utils/priorityUtils'

const STATUS_CONFIG = {
  pending: { label: 'PENDING', bg: 'bg-amber-50 text-amber-900 border-amber-300' },
  in_progress: { label: 'IN PROGRESS', bg: 'bg-blue-50 text-blue-900 border-blue-300' },
  'in-progress': { label: 'IN PROGRESS', bg: 'bg-blue-50 text-blue-900 border-blue-300' },
  resolved: { label: 'RESOLVED', bg: 'bg-emerald-50 text-emerald-900 border-emerald-300' },
  rejected: { label: 'REJECTED', bg: 'bg-rose-50 text-rose-900 border-rose-300' },
}

export default function PersonalReports() {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
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

  const filteredReports = useMemo(() => {
    if (filter === 'all') return reports
    return reports.filter(r => (r.status || '').toLowerCase() === filter.toLowerCase())
  }, [reports, filter])

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="border-b border-black pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 font-mono text-xs text-neutral-500 uppercase tracking-widest mb-1">
            <span>CITIZEN REGISTRY</span>
            <span>/</span>
            <span>SUBMISSIONS</span>
            <span>/</span>
            <span className="text-black font-semibold">MY DOSSIERS</span>
          </div>
          <h1 className="font-serif text-3xl font-bold tracking-tight text-neutral-900 uppercase">
            Personal Reports
          </h1>
          <p className="text-sm text-neutral-600 mt-1 font-sans">
            Archival history of civic dispatches filed under your authenticated credentials.
          </p>
        </div>

        <button
          onClick={() => navigate('/citizen/submit')}
          className="px-4 py-2 bg-black text-white font-mono text-xs font-bold uppercase tracking-wider hover:bg-neutral-800 flex items-center gap-2"
        >
          <HiPlus className="w-4 h-4" />
          <span>NEW DISPATCH</span>
        </button>
      </div>

      {/* Filter Tabs & Summary */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border border-neutral-200 bg-white p-2">
        <div className="flex items-center gap-1 font-mono text-xs overflow-x-auto">
          {['all', 'pending', 'in_progress', 'resolved', 'rejected'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 border uppercase tracking-wider transition-colors ${
                filter === f
                  ? 'bg-neutral-900 text-white border-black font-bold'
                  : 'border-transparent text-neutral-600 hover:border-neutral-300'
              }`}
            >
              {f.replace(/_/g, ' ')}
            </button>
          ))}
        </div>

        <div className="font-mono text-xs text-neutral-500 px-2 text-right">
          TOTAL: <span className="font-bold text-black">{filteredReports.length}</span> RECORD(S)
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="border border-neutral-200 p-5 bg-white space-y-2">
              <div className="h-4 w-1/3 bg-neutral-200 animate-pulse" />
              <div className="h-3 w-3/4 bg-neutral-100 animate-pulse" />
            </div>
          ))}
        </div>
      ) : filteredReports.length === 0 ? (
        <div className="border border-dashed border-neutral-300 p-12 text-center bg-white">
          <HiDocumentReport className="w-10 h-10 text-neutral-400 mx-auto mb-3" />
          <h3 className="font-serif text-lg font-bold text-neutral-900 uppercase">
            No Reports On File
          </h3>
          <p className="text-sm text-neutral-500 font-sans mt-1">
            {filter === 'all'
              ? 'You have not submitted any civic incident reports yet.'
              : `No reports match the status "${filter.replace(/_/g, ' ')}".`}
          </p>
          <button
            onClick={() => navigate('/citizen/submit')}
            className="mt-5 px-4 py-2 bg-black text-white font-mono text-xs uppercase"
          >
            FILE FIRST INCIDENT
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredReports.map(r => {
            const statusKey = (r.status || 'pending').toLowerCase()
            const statusInfo = STATUS_CONFIG[statusKey] || {
              label: (r.status || 'PENDING').toUpperCase(),
              bg: 'bg-neutral-100 text-neutral-800 border-neutral-300',
            }
            const dateStr = r.createdAt ? format(new Date(r.createdAt), 'yyyy-MM-dd') : '—'

            return (
              <div
                key={r._id || r.id}
                onClick={() => navigate(`/citizen/complaint/${r._id || r.id}`)}
                className="group border border-neutral-200 hover:border-black bg-white p-5 transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-neutral-500 font-semibold">
                      #{(r._id || r.id || '').slice(-6).toUpperCase()}
                    </span>
                    <span className={`px-2 py-0.5 border font-mono text-[10px] tracking-wider uppercase font-semibold ${statusInfo.bg}`}>
                      {statusInfo.label}
                    </span>
                    {(() => {
                      const pTier = getPriorityTier(r)
                      if (pTier.score === null) return null
                      return (
                        <span className={`px-2 py-0.5 border font-mono text-[10px] tracking-wider uppercase font-semibold ${pTier.badgeClass}`}>
                          {pTier.label} ({pTier.displayScore})
                        </span>
                      )
                    })()}
                    {(r.category || r.issueType) && (
                      <span className="px-2 py-0.5 border border-neutral-200 bg-neutral-50 font-mono text-[10px] uppercase text-neutral-600">
                        {(r.category || r.issueType).replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>

                  <h3 className="font-serif font-bold text-neutral-900 text-base group-hover:underline truncate">
                    {r.title || r.complaintTitle || 'Untitled Incident'}
                  </h3>

                  <p className="text-xs text-neutral-500 font-sans line-clamp-1">
                    {r.description}
                  </p>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4 font-mono text-xs text-neutral-500 flex-shrink-0">
                  <span>{dateStr}</span>
                  <span className="text-neutral-400 group-hover:text-black flex items-center gap-1 font-bold">
                    VIEW DOSSIER <HiChevronRight className="w-4 h-4" />
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
