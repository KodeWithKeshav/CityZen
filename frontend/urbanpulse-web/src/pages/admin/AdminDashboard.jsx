// AdminDashboard - Overview statistics and chart visualizations
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { makeApiCall, apiClient } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'
import { Bar, Doughnut } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  Title, Tooltip, Legend, ArcElement
} from 'chart.js'
import { HiDocumentText, HiCheckCircle, HiClock, HiRefresh, HiUsers, HiTrendingUp } from 'react-icons/hi'
import { format } from 'date-fns'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement)

export default function AdminDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = async () => {
    try {
      const res = await makeApiCall(apiClient.admin.dashboard)
      if (res.success) setData(res.data)
    } catch (err) {
      toast.error('Failed to load dashboard')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const onRefresh = () => { setRefreshing(true); fetchData() }

  // admin-enhanced returns data.overview and data.topPriorityComplaints
  const stats_raw = data?.overview || data?.stats || data?.complaints || {}
  const complaints = {
    total: stats_raw.total || stats_raw.totalComplaints || 0,
    resolved: stats_raw.resolved || stats_raw.resolvedComplaints || 0,
    pending: stats_raw.pending || stats_raw.pendingComplaints || 0,
    inProgress: stats_raw.inProgress || stats_raw.inProgressComplaints || stats_raw.in_progress || 0,
    rejected: stats_raw.rejected || 0,
    resolutionRate: stats_raw.resolutionRate || (stats_raw.total ? Math.round((stats_raw.resolved / stats_raw.total) * 100) : 0),
  }
  const users = data?.users || {}

  const stats = [
    { label: 'Total Complaints', value: complaints.total, icon: HiDocumentText, color: 'from-blue-500 to-blue-600', bg: 'bg-blue-50', text: 'text-blue-700' },
    { label: 'Resolved', value: complaints.resolved, icon: HiCheckCircle, color: 'from-green-500 to-green-600', bg: 'bg-green-50', text: 'text-green-700' },
    { label: 'Pending', value: complaints.pending, icon: HiClock, color: 'from-amber-500 to-amber-600', bg: 'bg-amber-50', text: 'text-amber-700' },
    { label: 'Citizens', value: users.citizens || 0, icon: HiUsers, color: 'from-violet-500 to-violet-600', bg: 'bg-violet-50', text: 'text-violet-700' },
    { label: 'In Progress', value: complaints.inProgress, icon: HiRefresh, color: 'from-cyan-500 to-cyan-600', bg: 'bg-cyan-50', text: 'text-cyan-700' },
    { label: 'Resolution Rate', value: `${complaints.resolutionRate}%`, icon: HiTrendingUp, color: 'from-emerald-500 to-emerald-600', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  ]

  const doughnutData = {
    labels: ['Resolved', 'Pending', 'In Progress', 'Rejected'],
    datasets: [{
      data: [
        complaints.resolved || 0,
        complaints.pending || 0,
        complaints.inProgress || 0,
        complaints.rejected || 0,
      ],
      backgroundColor: ['#22c55e', '#f59e0b', '#3b82f6', '#ef4444'],
      borderWidth: 0,
    }]
  }

  const recentComplaints = data?.topComplaints || data?.recentComplaints || []

  return (
    <div className="p-4 max-w-6xl mx-auto pb-8 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Hey, {user?.fullName?.split(' ')[0] || 'Admin'}!</h1>
          <p className="text-sm text-gray-500">Civic Complaint Management Dashboard</p>
        </div>
        <button onClick={onRefresh} disabled={refreshing} className="p-2.5 rounded-xl hover:bg-gray-100 transition-colors disabled:opacity-50">
          <HiRefresh className={`w-5 h-5 text-gray-600 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
          {[1,2,3,4,5,6].map(i => <div key={i} className="h-24 skeleton rounded-2xl" />)}
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
            {stats.map(s => (
              <div key={s.label} className={`card ${s.bg}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center`}>
                    <s.icon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className={`text-2xl font-bold ${s.text}`}>{s.value}</p>
                    <p className="text-xs text-gray-600">{s.label}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Charts + Recent */}
          <div className="grid lg:grid-cols-3 gap-6 mb-6">
            <div className="card lg:col-span-1">
              <h3 className="font-bold text-gray-800 mb-4">Status Overview</h3>
              {(complaints.total || 0) > 0
                ? <Doughnut data={doughnutData} options={{ plugins: { legend: { position: 'bottom' } } }} />
                : <p className="text-gray-400 text-sm text-center py-8">No complaints yet</p>
              }
            </div>

            <div className="card lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-800">Recent Complaints</h3>
                <button onClick={() => navigate('/admin/complaints')} className="text-sm text-admin-600 font-medium hover:underline">View all â†’</button>
              </div>
              {recentComplaints.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-6">No recent complaints</p>
              ) : (
                <div className="space-y-2">
                  {recentComplaints.slice(0, 6).map(c => (
                    <div
                      key={c._id || c.id}
                      onClick={() => navigate(`/admin/complaints/${c._id || c.id}`)}
                      className="flex items-center gap-3 py-2.5 px-3 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <HiDocumentText className="w-4 h-4 text-admin-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{c.title || c.complaintTitle}</p>
                        <p className="text-xs text-gray-500">{c.citizenName || 'Unknown'} Â· {c.createdAt ? format(new Date(c.createdAt), 'MMM d') : 'â€”'}</p>
                      </div>
                      <span className={`badge capitalize flex-shrink-0 text-xs
                        ${c.status === 'resolved' ? 'badge-resolved'
                        : c.status === 'in_progress' || c.status === 'in-progress' ? 'badge-inprogress'
                        : c.status === 'rejected' ? 'badge-rejected'
                        : 'badge-pending'}`}>
                        {c.status?.replace(/_/g,' ')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Quick action cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Manage Complaints', icon: 'ðŸ“‹', to: '/admin/complaints', color: 'bg-blue-600' },
              { label: 'Priority Queue', icon: 'ðŸŽ¯', to: '/admin/priority', color: 'bg-orange-500' },
              { label: 'Complaint Map', icon: 'ðŸ—ºï¸', to: '/admin/map', color: 'bg-teal-600' },
              { label: 'Citizens', icon: 'ðŸ‘¥', to: '/admin/citizens', color: 'bg-violet-600' },
            ].map(a => (
              <button
                key={a.to}
                onClick={() => navigate(a.to)}
                className={`${a.color} text-white p-4 rounded-2xl text-left hover:opacity-90 transition-opacity active:scale-95`}
              >
                <div className="text-2xl mb-2">{a.icon}</div>
                <p className="font-bold text-sm">{a.label}</p>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
