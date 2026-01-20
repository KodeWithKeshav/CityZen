import { useState, useEffect } from 'react'
import { makeApiCall, apiClient } from '../../services/api'
import toast from 'react-hot-toast'
import { Bar, Doughnut } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  Title, Tooltip, Legend, ArcElement
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement)

export default function Transparency() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await makeApiCall(apiClient.transparency.data)
        if (res.success) setData(res.data)
      } catch {
        // silently fall back
        try {
          const res = await makeApiCall(apiClient.admin.dashboard)
          if (res.success) setData(res.data)
        } catch (err) {
          toast.error('Failed to load transparency data')
        }
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-700" />
    </div>
  )

  const complaints = data?.complaints || {}
  const total = complaints.total || 0
  const resolved = complaints.resolved || 0
  const pending = complaints.pending || 0
  const inProgress = complaints.inProgress || 0
  const resolutionRate = complaints.resolutionRate || 0

  const doughnutData = {
    labels: ['Resolved', 'Pending', 'In Progress'],
    datasets: [{
      data: [resolved, pending, inProgress],
      backgroundColor: ['#22c55e', '#f59e0b', '#3b82f6'],
      borderWidth: 0,
    }]
  }

  const categoryData = data?.complaintsbyCategory || data?.byCategory || {}
  const catLabels = Object.keys(categoryData)
  const catValues = Object.values(categoryData)

  const barData = {
    labels: catLabels.map(l => l.replace(/_/g, ' ')),
    datasets: [{
      label: 'Complaints',
      data: catValues,
      backgroundColor: '#4ade80',
      borderRadius: 8,
    }]
  }

  return (
    <div className="p-4 max-w-4xl mx-auto fade-in pb-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Transparency Dashboard</h1>
        <p className="text-sm text-gray-500">Real-time government responsiveness data</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Complaints', value: total, color: 'bg-blue-50 text-blue-700', icon: '📋' },
          { label: 'Resolved', value: resolved, color: 'bg-green-50 text-green-700', icon: '✅' },
          { label: 'Pending', value: pending, color: 'bg-amber-50 text-amber-700', icon: '⏳' },
          { label: 'Resolution Rate', value: `${resolutionRate}%`, color: 'bg-purple-50 text-purple-700', icon: '📈' },
        ].map(s => (
          <div key={s.label} className={`card ${s.color}`}>
            <div className="text-2xl mb-1">{s.icon}</div>
            <div className="text-2xl font-bold">{s.value}</div>
            <div className="text-xs font-medium mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid sm:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="font-bold text-gray-800 mb-4">Status Distribution</h3>
          {total > 0 ? (
            <Doughnut data={doughnutData} options={{ plugins: { legend: { position: 'bottom' } } }} />
          ) : <p className="text-gray-400 text-sm text-center py-8">No data available</p>}
        </div>

        <div className="card">
          <h3 className="font-bold text-gray-800 mb-4">Complaints by Category</h3>
          {catLabels.length > 0 ? (
            <Bar data={barData} options={{
              responsive: true,
              plugins: { legend: { display: false } },
              scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
            }} />
          ) : <p className="text-gray-400 text-sm text-center py-8">No category data</p>}
        </div>
      </div>

      {/* Avg resolution */}
      {complaints.avgResolutionDays !== undefined && (
        <div className="card mt-6 bg-gradient-to-r from-primary-50 to-emerald-50">
          <div className="flex items-center gap-4">
            <div className="text-4xl">⚡</div>
            <div>
              <p className="text-2xl font-bold text-primary-700">{complaints.avgResolutionDays || 0} days</p>
              <p className="text-sm text-gray-600">Average resolution time</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
