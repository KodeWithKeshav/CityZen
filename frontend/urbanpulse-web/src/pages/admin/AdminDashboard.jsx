import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { makeApiCall, apiClient } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'
import { Doughnut } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  Title, Tooltip, Legend, ArcElement
} from 'chart.js'
import { HiRefresh, HiArrowRight } from 'react-icons/hi'
import { format } from 'date-fns'
import { getPriorityTier } from '../../utils/priorityUtils'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement)

const STATUS_CONFIG = {
  pending: { label: 'PENDING', bg: 'bg-amber-50 text-amber-900 border-amber-300' },
  in_progress: { label: 'IN PROGRESS', bg: 'bg-blue-50 text-blue-900 border-blue-300' },
  'in-progress': { label: 'IN PROGRESS', bg: 'bg-blue-50 text-blue-900 border-blue-300' },
  resolved: { label: 'RESOLVED', bg: 'bg-emerald-50 text-emerald-900 border-emerald-300' },
  rejected: { label: 'REJECTED', bg: 'bg-rose-50 text-rose-900 border-rose-300' },
}

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
      toast.error('Failed to load operational console telemetry')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const onRefresh = () => {
    setRefreshing(true)
    fetchData()
  }

  const statsRaw = data?.overview || data?.stats || data?.complaints || {}
  const complaints = {
    total: statsRaw.total || statsRaw.totalComplaints || 0,
    resolved: statsRaw.resolved || statsRaw.resolvedComplaints || 0,
    pending: statsRaw.pending || statsRaw.pendingComplaints || 0,
    inProgress: statsRaw.inProgress || statsRaw.inProgressComplaints || statsRaw.in_progress || 0,
    rejected: statsRaw.rejected || 0,
    resolutionRate: statsRaw.resolutionRate || (statsRaw.total ? Math.round((statsRaw.resolved / statsRaw.total) * 100) : 0),
  }
  const users = data?.users || {}

  const stats = [
    { label: 'TOTAL INCIDENTS LOGGED', value: complaints.total, sub: 'Archived & active' },
    { label: 'REMEDIATED & SIGNED OFF', value: complaints.resolved, sub: 'Closed audit dossiers' },
    { label: 'PENDING DISPATCH / TRIAGE', value: complaints.pending, sub: 'Awaiting team assignment' },
    { label: 'ACTIVE FIELD TEAMS', value: complaints.inProgress, sub: 'Currently under repair' },
    { label: 'VERIFIED CITIZEN ACCOUNTS', value: users.citizens || 0, sub: 'Enrolled in jurisdiction' },
    { label: 'SLA RESOLUTION INDEX', value: `${complaints.resolutionRate}%`, sub: 'Baseline target: 90%' },
  ]

  const doughnutData = {
    labels: ['RESOLVED', 'PENDING', 'IN PROGRESS', 'REJECTED'],
    datasets: [{
      data: [
        complaints.resolved || 0,
        complaints.pending || 0,
        complaints.inProgress || 0,
        complaints.rejected || 0,
      ],
      backgroundColor: ['#111827', '#6B7280', '#D1D5DB', '#9CA3AF'],
      borderColor: '#FFFFFF',
      borderWidth: 2,
    }]
  }

  const recentComplaints = data?.topComplaints || data?.recentComplaints || []

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="border-b border-black pb-4 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 font-mono text-xs text-neutral-500 uppercase tracking-widest mb-1">
            <span>MUNICIPAL ADMINISTRATION</span>
            <span>/</span>
            <span>OPERATIONAL OVERSIGHT</span>
            <span>/</span>
            <span className="text-black font-semibold">CONSOLE</span>
          </div>
          <h1 className="font-serif text-3xl font-bold tracking-tight text-neutral-900 uppercase">
            Operations Command Ledger
          </h1>
          <p className="text-sm text-neutral-600 mt-1 font-sans">
            Authenticated Admin: <strong className="text-black uppercase">{user?.fullName || 'Chief Dispatcher'}</strong> ({user?.department || 'Civic Infrastructure Dept'})
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="p-2 border border-neutral-300 hover:border-black transition-colors disabled:opacity-50"
            title="Refresh Operations Telemetry"
          >
            <HiRefresh className={`w-4 h-4 text-neutral-800 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => navigate('/admin/priority')}
            className="px-4 py-2 bg-black text-white font-mono text-xs font-bold uppercase tracking-wider hover:bg-neutral-800"
          >
            VIEW PRIORITY SEQUENCING →
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 font-mono text-xs text-neutral-400">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="border border-neutral-200 p-4 h-24 bg-white animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* Top Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {stats.map(s => (
              <div key={s.label} className="border border-neutral-200 bg-white p-4 font-mono">
                <span className="text-[9px] text-neutral-500 uppercase tracking-wider block mb-1 truncate" title={s.label}>
                  {s.label}
                </span>
                <div className="text-2xl font-bold text-neutral-900">
                  {s.value}
                </div>
                <span className="text-[10px] text-neutral-400 block mt-1 truncate">
                  {s.sub}
                </span>
              </div>
            ))}
          </div>

          {/* Middle Operational Section: Distribution & Recent Incidents */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Status Donut */}
            <div className="border border-neutral-200 bg-white p-6 font-mono">
              <div className="flex items-center justify-between border-b border-neutral-200 pb-3 mb-4 text-xs">
                <span className="font-bold uppercase tracking-wider text-neutral-900">
                  STATUS ALLOCATION
                </span>
                <span className="text-neutral-500">LIVE COHORT</span>
              </div>
              {complaints.total > 0 ? (
                <div className="max-w-[220px] mx-auto py-2">
                  <Doughnut
                    data={doughnutData}
                    options={{
                      plugins: {
                        legend: {
                          position: 'bottom',
                          labels: {
                            font: { family: 'monospace', size: 9 },
                            boxWidth: 10,
                          }
                        }
                      }
                    }}
                  />
                </div>
              ) : (
                <p className="text-neutral-400 text-xs text-center py-10">
                  NO ACTIVE INCIDENT TELEMETRY
                </p>
              )}
            </div>

            {/* Recent Incidents Table / Stream */}
            <div className="border border-neutral-200 bg-white p-6 lg:col-span-2">
              <div className="flex items-center justify-between border-b border-neutral-200 pb-3 mb-4 font-mono text-xs">
                <div>
                  <span className="font-bold uppercase tracking-wider text-neutral-900">
                    RECENT INTAKE DOSSIERS
                  </span>
                  <span className="text-neutral-500 ml-2">MOST RECENT SUBMISSIONS</span>
                </div>
                <button
                  onClick={() => navigate('/admin/complaints')}
                  className="font-bold text-neutral-900 hover:underline uppercase tracking-wider text-xs flex items-center gap-1"
                >
                  FULL REGISTRY <HiArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {recentComplaints.length === 0 ? (
                <div className="text-center py-12 font-mono text-xs text-neutral-400">
                  NO RECENT INCIDENTS IN DISPATCH STREAM
                </div>
              ) : (
                <div className="divide-y divide-neutral-100">
                  {recentComplaints.slice(0, 5).map(c => {
                    const statusKey = (c.status || 'pending').toLowerCase()
                    const statusInfo = STATUS_CONFIG[statusKey] || {
                      label: (c.status || 'PENDING').toUpperCase(),
                      bg: 'bg-neutral-100 text-neutral-800 border-neutral-300'
                    }
                    const timeStr = c.createdAt ? format(new Date(c.createdAt), 'yyyy-MM-dd HH:mm') : '—'

                    return (
                      <div
                        key={c._id || c.id}
                        onClick={() => navigate(`/admin/complaints/${c._id || c.id}`)}
                        className="py-3 flex items-center justify-between gap-3 hover:bg-neutral-50 px-2 cursor-pointer transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-mono text-xs text-neutral-400">
                              #{(c._id || c.id || '').slice(-6).toUpperCase()}
                            </span>
                            <span className={`px-2 py-0.5 border font-mono text-[9px] uppercase tracking-wider ${statusInfo.bg}`}>
                              {statusInfo.label}
                            </span>
                            {(() => {
                              const pTier = getPriorityTier(c)
                              if (pTier.score === null) return null
                              return (
                                <span className={`px-1.5 py-0.5 border font-mono text-[9px] uppercase tracking-wider ${pTier.badgeClass}`}>
                                  SCORE: {pTier.displayScore} · {pTier.label}
                                </span>
                              )
                            })()}
                          </div>
                          <h4 className="font-serif font-bold text-sm text-neutral-900 truncate">
                            {c.title || c.complaintTitle || 'Unclassified Incident'}
                          </h4>
                        </div>

                        <div className="font-mono text-xs text-neutral-500 text-right flex-shrink-0">
                          <div>{c.citizenName || c.users?.full_name || c.user?.full_name || c.user_name || 'Verified Citizen'}</div>
                          <div className="text-[10px] text-neutral-400">{timeStr}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Quick Tactical Navigation Panels */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'ALL COMPLAINTS REGISTRY', desc: 'Audit, reassign and update incident states', to: '/admin/complaints', tag: 'LEDGER' },
              { label: 'PRIORITY SEQUENCING', desc: 'AI-prioritized operational remediation order', to: '/admin/priority', tag: 'URGENCY' },
              { label: 'GEOSPATIAL CADASTRE', desc: 'Interactive geographic heatmaps & radius audits', to: '/admin/map', tag: 'SPATIAL' },
              { label: 'CITIZEN DIRECTORY', desc: 'Verified citizen roster & activity audit logs', to: '/admin/citizens', tag: 'DIRECTORY' },
            ].map(item => (
              <button
                key={item.to}
                onClick={() => navigate(item.to)}
                className="border border-neutral-300 hover:border-black bg-white p-5 text-left transition-all group flex flex-col justify-between"
              >
                <div>
                  <span className="font-mono text-[10px] uppercase text-neutral-400 tracking-wider block mb-1">
                    MODULE: {item.tag}
                  </span>
                  <h3 className="font-serif font-bold text-sm text-neutral-900 group-hover:underline uppercase">
                    {item.label}
                  </h3>
                  <p className="text-xs text-neutral-500 font-sans mt-1 leading-relaxed">
                    {item.desc}
                  </p>
                </div>
                <span className="font-mono text-xs text-neutral-400 group-hover:text-black mt-4 font-bold flex items-center gap-1">
                  ACCESS CONSOLE →
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
