import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { makeApiCall, apiClient } from '../../services/api'
import {
  HiPlusCircle, HiNewspaper, HiMap, HiChartBar,
  HiDocumentReport, HiChat, HiStar, HiInformationCircle
} from 'react-icons/hi'

const actions = [
  { icon: HiPlusCircle, label: 'New Report', sub: 'Submit environmental concern', to: '/citizen/submit', color: 'from-primary-700 to-primary-500' },
  { icon: HiNewspaper, label: 'Feed', sub: 'Browse all complaints', to: '/citizen/feed', color: 'from-emerald-600 to-teal-500' },
  { icon: HiMap, label: 'Complaint Map', sub: 'View area status', to: '/citizen/map', color: 'from-teal-600 to-cyan-500' },

  { icon: HiDocumentReport, label: 'My Reports', sub: 'Track your submissions', to: '/citizen/reports', color: 'from-amber-500 to-orange-500' },
  { icon: HiChat, label: 'AI Chatbot', sub: 'Get help from AI', to: '/citizen/chatbot', color: 'from-violet-600 to-purple-500' },
  { icon: HiStar, label: 'Feedback', sub: 'Rate our service', to: '/citizen/feedback', color: 'from-pink-500 to-rose-500' },
  { icon: HiInformationCircle, label: 'About', sub: 'Learn more', to: '/citizen/feed', color: 'from-sky-500 to-blue-500' },
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
    <div className="p-6 max-w-4xl mx-auto fade-in">
      {/* Hero */}
      <div className="rounded-3xl bg-gradient-to-br from-primary-800 to-primary-600 text-white p-6 mb-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center text-2xl">🌿</div>
          <div>
            <h1 className="text-2xl font-bold">Hello, {user?.fullName?.split(' ')[0] || 'Citizen'}!</h1>
            <p className="text-primary-200">Making our city greener, one report at a time</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Pending', value: stats.pending, icon: '⏳' },
            { label: 'Resolved', value: stats.resolved, icon: '✅' },
            { label: 'Impact', value: stats.total, icon: '🌍' },
          ].map(s => (
            <div key={s.label} className="bg-white/10 rounded-xl p-3 text-center">
              <div className="text-xl">{s.icon}</div>
              <div className="font-bold text-xl">{s.value}</div>
              <div className="text-primary-200 text-xs">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick actions grid */}
      <h2 className="text-lg font-bold text-gray-800 mb-4">Quick Actions</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {actions.map(({ icon: Icon, label, sub, to, color }) => (
          <button
            key={to + label}
            onClick={() => navigate(to)}
            className="rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 active:scale-95"
          >
            <div className={`bg-gradient-to-br ${color} p-5 text-white`}>
              <Icon className="w-7 h-7 mb-2" />
              <p className="font-bold text-sm leading-tight">{label}</p>
              <p className="text-white/70 text-xs mt-0.5 leading-tight">{sub}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
