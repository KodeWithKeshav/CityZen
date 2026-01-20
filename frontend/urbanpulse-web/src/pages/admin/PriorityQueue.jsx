import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { makeApiCall, apiClient } from '../../services/api'
import toast from 'react-hot-toast'
import { HiRefresh, HiExclamationCircle } from 'react-icons/hi'

export default function PriorityQueue() {
  const [queue, setQueue] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const fetchQueue = async () => {
    setLoading(true)
    try {
      // Try priority queue endpoint, fall back to all complaints sorted by priority
      let res
      try {
        res = await makeApiCall(apiClient.admin.priorityQueue)
      } catch {
        res = await makeApiCall(apiClient.complaints.all)
      }
      const data = res.data?.complaints || res.data || []
      // Sort by priorityScore descending
      const sorted = [...data].sort((a, b) => (b.priorityScore || b.priority_score || 0) - (a.priorityScore || a.priority_score || 0))
      setQueue(sorted)
    } catch (err) {
      toast.error('Failed to load priority queue')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchQueue() }, [])

  const getPriorityColor = (score) => {
    if (score >= 80) return { bg: 'bg-red-100', text: 'text-red-700', bar: 'bg-red-500', label: 'Critical' }
    if (score >= 60) return { bg: 'bg-orange-100', text: 'text-orange-700', bar: 'bg-orange-500', label: 'High' }
    if (score >= 40) return { bg: 'bg-yellow-100', text: 'text-yellow-700', bar: 'bg-yellow-500', label: 'Medium' }
    return { bg: 'bg-green-100', text: 'text-green-700', bar: 'bg-green-500', label: 'Low' }
  }

  return (
    <div className="p-4 max-w-4xl mx-auto pb-8 fade-in">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">🎯 Priority Queue</h1>
          <p className="text-sm text-gray-500">Complaints ranked by AI priority score</p>
        </div>
        <button onClick={fetchQueue} className="p-2.5 rounded-xl hover:bg-gray-100">
          <HiRefresh className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3,4,5].map(i => <div key={i} className="h-20 skeleton rounded-2xl" />)}
        </div>
      ) : queue.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-gray-400">
          <HiExclamationCircle className="w-12 h-12 mb-3" />
          <p>No complaints in queue</p>
        </div>
      ) : (
        <div className="space-y-3">
          {queue.map((c, idx) => {
            const score = c.priorityScore ? Math.round(c.priorityScore) : 0
            const pc = getPriorityColor(score)
            return (
              <div
                key={c._id || c.id}
                onClick={() => navigate(`/admin/complaints/${c._id || c.id}`)}
                className="card hover:shadow-md transition-all cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  {/* Rank */}
                  <div className={`w-10 h-10 rounded-xl ${pc.bg} flex items-center justify-center flex-shrink-0`}>
                    <span className={`font-bold text-sm ${pc.text}`}>#{idx + 1}</span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-gray-800 text-sm truncate">{c.title || c.complaintTitle}</p>
                      <span className={`badge flex-shrink-0 text-xs ${pc.bg} ${pc.text}`}>{pc.label}</span>
                    </div>
                    <p className="text-xs text-gray-500 mb-2">{c.citizenName || 'Unknown'} · {(c.category || c.issueType || '').replace(/_/g,' ')}</p>

                    {/* Priority bar */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full ${pc.bar} rounded-full`} style={{ width: `${Math.min(score, 100)}%` }} />
                      </div>
                      <span className={`text-xs font-bold ${pc.text} flex-shrink-0`}>{score}</span>
                    </div>
                  </div>

                  {/* Votes */}
                  <div className="flex-shrink-0 text-center">
                    <p className="font-bold text-gray-800">{c.upvotes || c.votes || 0}</p>
                    <p className="text-xs text-gray-400">votes</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
