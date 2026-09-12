import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { makeApiCall, apiClient } from '../../services/api'
import {
  HiPlusCircle, HiNewspaper, HiMap, HiDocumentReport,
  HiChat, HiStar, HiChartBar, HiClock, HiCheckCircle, HiGlobeAlt, HiArrowRight
} from 'react-icons/hi'

const actions = [
  { icon: HiPlusCircle, label: 'New Report', sub: 'Submit environmental concern', to: '/citizen/submit' },
  { icon: HiNewspaper, label: 'Civic Feed', sub: 'Browse all complaints', to: '/citizen/feed' },
  { icon: HiMap, label: 'Spatial Map', sub: 'View area status', to: '/citizen/map' },
  { icon: HiDocumentReport, label: 'My Reports', sub: 'Track your submissions', to: '/citizen/reports' },
  { icon: HiChat, label: 'AI Assistant', sub: 'Get help from AI', to: '/citizen/chatbot' },
  { icon: HiStar, label: 'Feedback', sub: 'Rate our service', to: '/citizen/feedback' },
  { icon: HiChartBar, label: 'Transparency', sub: 'Government metrics', to: '/citizen/transparency' },
]

export default function CitizenDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState({ pending: 0, resolved: 0, total: 0 })

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await makeApiCall(apiClient.complaints.personalReports)
        if (res.success && res.data?.stats) {
          setStats({
            pending: res.data.stats.pending || 0,
            resolved: res.data.stats.resolved || 0,
            total: res.data.stats.totalComplaints || 0
          })
        }
      } catch (err) {
        console.error('Failed to fetch stats', err)
      }
    }
    fetchStats()
  }, [])

  return (
    <div className="p-8 max-w-6xl mx-auto fade-in">
      {/* ─── Header ─── */}
      <div className="mb-stack-md">
        <h1 className="text-headline-lg font-epilogue text-on-surface">
          Hello, {user?.fullName?.split(' ')[0] || 'Citizen'}.
        </h1>
        <p className="text-body-md text-on-surface-variant mt-2">
          Making our city better, one report at a time.
        </p>
      </div>

      {/* ─── Stats Row ─── */}
      <div className="grid grid-cols-3 gap-6 mb-stack-md">
        {[
          { label: 'PENDING', value: stats.pending, icon: HiClock },
          { label: 'RESOLVED', value: stats.resolved, icon: HiCheckCircle },
          { label: 'TOTAL IMPACT', value: stats.total, icon: HiGlobeAlt },
        ].map(s => (
          <div key={s.label} className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <s.icon className="w-5 h-5 text-on-surface" />
              <span className="text-label-sm text-primary-400">{s.label}</span>
            </div>
            <p className="font-epilogue text-4xl font-bold text-on-surface">{s.value}</p>
          </div>
        ))}
      </div>

      {/* ─── Quick Actions ─── */}
      <div className="mb-6">
        <h2 className="text-label-sm text-primary-400 mb-4">QUICK ACTIONS</h2>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {actions.map(({ icon: Icon, label, sub, to }) => (
          <button
            key={to + label}
            onClick={() => navigate(to)}
            className="card text-left hover:bg-surface-container-low transition-colors group p-5"
          >
            <Icon className="w-6 h-6 text-on-surface mb-4" />
            <p className="font-semibold text-sm text-on-surface leading-tight mb-1">{label}</p>
            <p className="text-xs text-on-surface-variant leading-tight">{sub}</p>
            <HiArrowRight className="w-4 h-4 text-primary-300 mt-3 group-hover:text-on-surface transition-colors" />
          </button>
        ))}
      </div>
    </div>
  )
}
