import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { makeApiCall, apiClient } from '../../services/api'
import toast from 'react-hot-toast'
import { HiSearch, HiRefresh, HiDocumentText } from 'react-icons/hi'
import { format } from 'date-fns'

const STATUS_STYLES = {
  pending: 'badge-pending',
  resolved: 'badge-resolved',
  in_progress: 'badge-inprogress',
  'in-progress': 'badge-inprogress',
  rejected: 'badge-rejected',
}

export default function AdminComplaints() {
  const [complaints, setComplaints] = useState([])
  const [filtered, setFiltered] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const navigate = useNavigate()

  const fetchComplaints = async () => {
    try {
      const res = await makeApiCall(apiClient.complaints.all)
      const dataArray = res.complaints || res.data || []
      if (res.success || Array.isArray(dataArray)) {
        setComplaints(dataArray)
        setFiltered(dataArray)
      }
    } catch (err) {
      toast.error('Failed to load complaints')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchComplaints() }, [])

  useEffect(() => {
    let list = complaints
    if (statusFilter !== 'all') {
      list = list.filter(c => c.status === statusFilter || c.status === statusFilter.replace(/_/g, '-'))
    }
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(c =>
        (c.title || c.complaintTitle || '').toLowerCase().includes(q) ||
        (c.citizenName || '').toLowerCase().includes(q) ||
        (c.description || '').toLowerCase().includes(q)
      )
    }
    setFiltered(list)
  }, [search, statusFilter, complaints])

  return (
    <div className="p-4 max-w-6xl mx-auto pb-8 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">All Complaints</h1>
          <p className="text-sm text-gray-500">{filtered.length} of {complaints.length} total</p>
        </div>
        <button onClick={fetchComplaints} className="p-2.5 rounded-xl hover:bg-gray-100 transition-colors">
          <HiRefresh className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <HiSearch className="absolute left-3 top-3.5 text-gray-400 w-5 h-5" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search complaints..."
            className="input pl-10"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['all', 'pending', 'in_progress', 'resolved', 'rejected'].map(f => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition-all
                ${statusFilter === f ? 'bg-admin-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {f === 'in_progress' ? 'In Progress' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Table / List */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3,4].map(i => <div key={i} className="h-16 skeleton rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <HiDocumentText className="w-12 h-12 mb-3" />
          <p>No complaints found</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block card p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Title', 'Citizen', 'Category', 'Status', 'Priority', 'Date', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(c => (
                  <tr key={c._id || c.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => navigate(`/admin/complaints/${c._id || c.id}`)}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 truncate max-w-[180px]">{c.title || c.complaintTitle}</p>
                      <p className="text-xs text-gray-500 truncate max-w-[180px]">{c.description}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{c.citizenName || '—'}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-gray-100 px-2 py-1 rounded-full capitalize">
                        {(c.category || c.issueType || '—').replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge capitalize ${STATUS_STYLES[c.status] || 'badge-pending'}`}>
                        {c.status?.replace(/_/g,' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 capitalize text-gray-600">{c.priority || '—'}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                      {c.createdAt ? format(new Date(c.createdAt), 'MMM d, yyyy') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-admin-600 text-xs font-medium hover:underline">View →</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.map(c => (
              <div key={c._id || c.id} className="card hover:shadow-md transition cursor-pointer" onClick={() => navigate(`/admin/complaints/${c._id || c.id}`)}>
                <div className="flex justify-between items-start gap-2 mb-1">
                  <p className="font-semibold text-gray-800 text-sm flex-1">{c.title || c.complaintTitle}</p>
                  <span className={`badge capitalize flex-shrink-0 ${STATUS_STYLES[c.status] || 'badge-pending'}`}>{c.status?.replace(/_/g,' ')}</span>
                </div>
                <p className="text-xs text-gray-500 mb-2 line-clamp-1">{c.description}</p>
                <div className="flex gap-3 text-xs text-gray-400">
                  <span>{c.citizenName || '—'}</span>
                  <span>·</span>
                  <span>{c.createdAt ? format(new Date(c.createdAt), 'MMM d') : '—'}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
