import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { makeApiCall, apiClient } from '../../services/api'
import toast from 'react-hot-toast'
import { HiThumbUp, HiLocationMarker, HiClock, HiRefresh, HiExclamationCircle } from 'react-icons/hi'
import { formatDistanceToNow } from 'date-fns'

const STATUS_STYLES = {
  pending:     'badge-pending',
  resolved:    'badge-resolved',
  in_progress: 'badge-inprogress',
  rejected:    'badge-rejected',
  'in-progress':'badge-inprogress',
}

// Haversine distance formula
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
  return R * c; 
}

function ComplaintCard({ c, onVote, onDetail }) {
  const [voting, setVoting] = useState(false)

  const handleVote = async (e) => {
    e.stopPropagation()
    setVoting(true)
    await onVote(c._id || c.id)
    setVoting(false)
  }

  const time = c.createdAt
    ? formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })
    : ''

  return (
    <div
      className="card hover:shadow-md transition-all duration-200 cursor-pointer fade-in relative"
      onClick={() => onDetail(c._id || c.id)}
    >
      {/* Distance Badge */}
      {c.distanceKm !== undefined && c.distanceKm !== 999 && (
        <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm text-primary-700 text-xs font-bold px-2 py-1 rounded-lg border border-primary-100 shadow-sm z-10">
          📍 {c.distanceKm < 1 ? '< 1' : c.distanceKm.toFixed(1)} km away
        </div>
      )}

      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center font-bold text-primary-700 flex-shrink-0 text-sm">
          {c.citizenName?.charAt(0)?.toUpperCase() || c.userName?.charAt(0)?.toUpperCase() || '?'}
        </div>
        <div className="flex-1 min-w-0 pr-16">
          <p className="font-semibold text-gray-800 text-sm truncate">{c.citizenName || c.userName || 'Anonymous'}</p>
          <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-0.5">
            <HiClock className="w-3.5 h-3.5" />
            {time}
            {c.location?.address && (
              <>
                <span>·</span>
                <HiLocationMarker className="w-3.5 h-3.5" />
                <span className="truncate max-w-[120px]">{c.location.address}</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="mb-3">
        <span className={`badge ${STATUS_STYLES[c.status] || 'badge-pending'} capitalize flex-shrink-0`}>
          {(c.status || 'pending').replace(/_/g, ' ')}
        </span>
      </div>

      {/* Content */}
      <h3 className="font-bold text-gray-900 mb-1 text-sm leading-tight">{c.title || c.complaintTitle}</h3>
      <p className="text-gray-600 text-sm line-clamp-2 mb-3">{c.description}</p>

      {/* Category */}
      {(c.category || c.issueType) && (
        <span className="inline-block bg-primary-50 text-primary-700 text-xs px-2.5 py-1 rounded-full font-medium mb-3">
          {(c.category || c.issueType)?.replace(/_/g, ' ')}
        </span>
      )}

      {/* Image */}
      {c.imageUrl && (
        <img
          src={c.imageUrl}
          alt="complaint"
          className="w-full h-48 object-cover rounded-xl mb-3"
          onError={(e) => { e.target.style.display = 'none' }}
        />
      )}

      {/* Footer */}
      <div className="flex items-center gap-4 pt-2 border-t border-gray-100">
        <button
          onClick={handleVote}
          disabled={voting}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary-600 transition-colors disabled:opacity-50"
        >
          <HiThumbUp className="w-4 h-4" />
          <span>{c.upvotes || c.votes || 0} votes</span>
        </button>
        <span className="text-xs text-gray-400">
          Priority: <span className="font-medium text-gray-600">{c.priorityScore ? Math.round(c.priorityScore) : '—'}</span>
        </span>
        {c.aiAnalysis?.sentiment && (
          <span className="text-xs text-gray-400 ml-auto">
            Sentiment: <span className="font-medium">{c.aiAnalysis.sentiment}</span>
          </span>
        )}
      </div>
    </div>
  )
}

export default function ComplaintFeed() {
  const [allComplaints, setAllComplaints] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [userLoc, setUserLoc] = useState(null)
  const [locStatus, setLocStatus] = useState('requesting') // requesting, granted, denied
  const navigate = useNavigate()

  const fetchComplaints = async () => {
    try {
      const res = await makeApiCall(apiClient.complaints.all)
      const dataArr = res.data || res.complaints || []
      if (res.success) {
        setAllComplaints(dataArr)
      }
    } catch (err) {
      toast.error('Failed to load complaints')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // Derive distance properties on the fly to prevent stale closures
  const filteredComplaints = useMemo(() => {
    if (!userLoc || locStatus === 'denied') {
      return allComplaints
    }
    return allComplaints.map(c => {
      const lat = c.location?.latitude || c.location_latitude || c.latitude
      const lng = c.location?.longitude || c.location_longitude || c.longitude
      if (!lat || !lng) return { ...c, distanceKm: 999 }
      const dist = getDistanceFromLatLonInKm(userLoc.lat, userLoc.lng, parseFloat(lat), parseFloat(lng))
      return { ...c, distanceKm: dist }
    }).filter(c => c.distanceKm <= 3.0)
      .sort((a, b) => a.distanceKm - b.distanceKm)
  }, [allComplaints, userLoc, locStatus])

  useEffect(() => {
    // 1. Request location first
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude }
          setUserLoc(loc)
          setLocStatus('granted')
        },
        () => {
          setLocStatus('denied')
          toast.error('Location denied. Displaying all complaints.')
        }
      )
    } else {
      setLocStatus('denied')
    }

    // 2. Fetch data
    fetchComplaints()
  }, [])


  const handleVote = async (id) => {
    try {
      const res = await makeApiCall(apiClient.complaints.vote(id), { method: 'POST' })
      if (res.success) {
        setAllComplaints(prev =>
          prev.map(c => (c._id || c.id) === id ? { ...c, upvotes: (c.upvotes || 0) + 1 } : c)
        )
        toast.success('Vote registered!')
      }
    } catch (err) {
      toast.error(err.message || 'Could not vote')
    }
  }

  const handleRefresh = () => {
    setRefreshing(true)
    fetchComplaints()
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Complaint Feed</h1>
          <p className="text-sm text-gray-500">
            {locStatus === 'granted' 
              ? `${filteredComplaints.length} reports within 3km of you`
              : `${filteredComplaints.length} reports from your city`}
          </p>
        </div>
        <button onClick={handleRefresh} disabled={refreshing} className="p-2 rounded-xl hover:bg-gray-100 transition-colors disabled:opacity-50">
          <HiRefresh className={`w-5 h-5 text-gray-600 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1,2,3].map(i => (
            <div key={i} className="card">
              <div className="flex gap-3 mb-3">
                <div className="w-10 h-10 rounded-full skeleton" />
                <div className="flex-1">
                  <div className="h-4 skeleton rounded mb-2 w-1/3" />
                  <div className="h-3 skeleton rounded w-1/4" />
                </div>
              </div>
              <div className="h-4 skeleton rounded mb-2 w-3/4" />
              <div className="h-3 skeleton rounded mb-2" />
              <div className="h-3 skeleton rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : filteredComplaints.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <HiExclamationCircle className="w-12 h-12 mb-3" />
          <p className="font-medium">No complaints found</p>
          <p className="text-sm mt-1">Be the first to submit a report</p>
          <button onClick={() => navigate('/citizen/submit')} className="btn-primary mt-4">Submit a Report</button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredComplaints.map(c => (
            <ComplaintCard
              key={c._id || c.id}
              c={c}
              onVote={handleVote}
              onDetail={(id) => navigate(`/citizen/complaint/${id}`)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
