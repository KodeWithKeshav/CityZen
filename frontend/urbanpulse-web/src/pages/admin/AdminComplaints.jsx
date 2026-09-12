import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { makeApiCall, apiClient } from '../../services/api'
import toast from 'react-hot-toast'
import { HiSearch, HiRefresh, HiFilter, HiDocumentText, HiChevronRight } from 'react-icons/hi'
import { format } from 'date-fns'
import { getPriorityTier } from '../../utils/priorityUtils'

const STATUS_CONFIG = {
  pending: { label: 'PENDING', bg: 'bg-amber-50 text-amber-900 border-amber-300' },
  in_progress: { label: 'IN PROGRESS', bg: 'bg-blue-50 text-blue-900 border-blue-300' },
  'in-progress': { label: 'IN PROGRESS', bg: 'bg-blue-50 text-blue-900 border-blue-300' },
  resolved: { label: 'RESOLVED', bg: 'bg-emerald-50 text-emerald-900 border-emerald-300' },
  rejected: { label: 'REJECTED', bg: 'bg-rose-50 text-rose-900 border-rose-300' },
}

export default function AdminComplaints() {
  const [complaints, setComplaints] = useState([])
  const [filtered, setFiltered] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const navigate = useNavigate()

  const fetchComplaints = async () => {
    setLoading(true)
    try {
      const res = await makeApiCall(apiClient.complaints.all)
      const dataArray = res.complaints || res.data || []
      if (res.success || Array.isArray(dataArray)) {
        setComplaints(dataArray)
        setFiltered(dataArray)
      }
    } catch (err) {
      toast.error('Failed to load municipal complaint roster')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchComplaints()
  }, [])

  useEffect(() => {
    let list = complaints
    if (statusFilter !== 'all') {
      list = list.filter(c => c.status === statusFilter || c.status === statusFilter.replace(/_/g, '-'))
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(c =>
        (c.title || c.complaintTitle || '').toLowerCase().includes(q) ||
        (c.citizenName || '').toLowerCase().includes(q) ||
        (c.description || '').toLowerCase().includes(q) ||
        (c._id || c.id || '').toLowerCase().includes(q)
      )
    }
    setFiltered(list)
  }, [search, statusFilter, complaints])

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="border-b border-black pb-4 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 font-mono text-xs text-neutral-500 uppercase tracking-widest mb-1">
            <span>OPERATIONAL ARCHIVE</span>
            <span>/</span>
            <span>ALL SUBMISSIONS</span>
            <span>/</span>
            <span className="text-black font-semibold">CADASTRE</span>
          </div>
          <h1 className="font-serif text-3xl font-bold tracking-tight text-neutral-900 uppercase">
            Incident Dispatch Registry
          </h1>
          <p className="text-sm text-neutral-600 mt-1 font-sans">
            Centralized municipal ledger of citizen dispatches, field states, and resolution proofs.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchComplaints}
            className="p-2 border border-neutral-300 hover:border-black transition-colors"
            title="Refresh Roster"
          >
            <HiRefresh className="w-4 h-4 text-neutral-800" />
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="border border-neutral-200 bg-white p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <HiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 w-4 h-4" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by ID, keyword, complainant, or street address..."
              className="w-full pl-9 pr-3 py-2 border border-neutral-300 rounded-none text-xs font-mono placeholder-neutral-400 focus:outline-none focus:border-black"
            />
          </div>

          <div className="flex gap-1.5 flex-wrap font-mono text-xs">
            {['all', 'pending', 'in_progress', 'resolved', 'rejected'].map(f => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`px-3 py-2 border uppercase tracking-wider transition-colors ${
                  statusFilter === f
                    ? 'bg-neutral-900 text-white border-black font-bold'
                    : 'border-neutral-300 text-neutral-700 hover:border-black bg-white'
                }`}
              >
                {f.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-between items-center text-xs font-mono text-neutral-500 pt-1 border-t border-neutral-100">
          <span>MATCHING RECORDS: <strong className="text-black">{filtered.length}</strong> OF {complaints.length}</span>
          <span>STATUS FILTER: <strong className="text-black uppercase">{statusFilter.replace(/_/g, ' ')}</strong></span>
        </div>
      </div>

      {/* Main Table / Ledger */}
      {loading ? (
        <div className="border border-neutral-200 p-8 text-center font-mono text-xs text-neutral-500 bg-white">
          LOADING MUNICIPAL CADASTRE...
        </div>
      ) : filtered.length === 0 ? (
        <div className="border border-dashed border-neutral-300 bg-white p-12 text-center">
          <HiDocumentText className="w-10 h-10 text-neutral-400 mx-auto mb-3" />
          <h3 className="font-serif text-lg font-bold text-neutral-900 uppercase">
            No Records Found
          </h3>
          <p className="text-xs text-neutral-500 font-sans mt-1">
            No registered dispatches align with the provided criteria.
          </p>
        </div>
      ) : (
        <div className="border border-neutral-200 bg-white overflow-x-auto">
          <table className="w-full text-left font-mono text-xs border-collapse">
            <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="p-3 border-r border-neutral-200">ID</th>
                <th className="p-3 border-r border-neutral-200">INCIDENT &amp; DESCRIPTION</th>
                <th className="p-3 border-r border-neutral-200">CITIZEN</th>
                <th className="p-3 border-r border-neutral-200">CATEGORY</th>
                <th className="p-3 border-r border-neutral-200">SEVERITY</th>
                <th className="p-3 border-r border-neutral-200">STATUS</th>
                <th className="p-3 border-r border-neutral-200">FILED ON</th>
                <th className="p-3 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 text-neutral-800">
              {filtered.map(c => {
                const statusKey = (c.status || 'pending').toLowerCase()
                const statusInfo = STATUS_CONFIG[statusKey] || {
                  label: (c.status || 'PENDING').toUpperCase(),
                  bg: 'bg-neutral-100 text-neutral-800 border-neutral-300',
                }
                const dateStr = c.createdAt ? format(new Date(c.createdAt), 'yyyy-MM-dd') : '—'

                return (
                  <tr
                    key={c._id || c.id}
                    onClick={() => navigate(`/admin/complaints/${c._id || c.id}`)}
                    className="hover:bg-neutral-50 cursor-pointer transition-colors"
                  >
                    <td className="p-3 border-r border-neutral-200 font-bold text-neutral-500 whitespace-nowrap">
                      #{(c._id || c.id || '').slice(-6).toUpperCase()}
                    </td>
                    <td className="p-3 border-r border-neutral-200 max-w-xs">
                      <div className="font-serif font-bold text-sm text-neutral-900 truncate">
                        {c.title || c.complaintTitle || 'Unclassified Incident'}
                      </div>
                      <div className="font-sans text-xs text-neutral-500 truncate mt-0.5">
                        {c.description}
                      </div>
                    </td>
                    <td className="p-3 border-r border-neutral-200 whitespace-nowrap">
                      {c.citizenName || c.users?.full_name || c.user?.full_name || c.user_name || 'Verified Citizen'}
                    </td>
                    <td className="p-3 border-r border-neutral-200 whitespace-nowrap">
                      <span className="px-1.5 py-0.5 border border-neutral-200 bg-neutral-50 text-[10px] uppercase">
                        {(c.category || c.issueType || 'General').replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="p-3 border-r border-neutral-200 whitespace-nowrap">
                      {(() => {
                        const pTier = getPriorityTier(c)
                        return (
                          <div>
                            <span className="font-bold uppercase block text-xs">{pTier.label}</span>
                            {pTier.score !== null && (
                              <span className="text-neutral-500 text-[10px] block">
                                SCORE: {pTier.displayScore} / 100
                              </span>
                            )}
                          </div>
                        )
                      })()}
                    </td>
                    <td className="p-3 border-r border-neutral-200 whitespace-nowrap">
                      <span className={`px-2 py-0.5 border text-[10px] uppercase tracking-wider ${statusInfo.bg}`}>
                        {statusInfo.label}
                      </span>
                    </td>
                    <td className="p-3 border-r border-neutral-200 whitespace-nowrap text-neutral-500">
                      {dateStr}
                    </td>
                    <td className="p-3 text-right whitespace-nowrap font-bold">
                      <span className="text-black hover:underline inline-flex items-center gap-1 text-[11px]">
                        AUDIT <HiChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
