import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { makeApiCall, apiClient } from '../../services/api'
import toast from 'react-hot-toast'
import {
  HiThumbUp,
  HiLocationMarker,
  HiClock,
  HiRefresh,
  HiExclamationCircle,
  HiSearch,
  HiFilter,
  HiNewspaper,
  HiChevronDown,
  HiEye
} from 'react-icons/hi'
import { formatDistanceToNow } from 'date-fns'
import { getPriorityTier } from '../../utils/priorityUtils'

const STATUS_CONFIG = {
  pending: { label: 'PENDING', bg: 'bg-amber-50 text-amber-800 border-amber-300' },
  in_progress: { label: 'IN PROGRESS', bg: 'bg-blue-50 text-blue-800 border-blue-300' },
  'in-progress': { label: 'IN PROGRESS', bg: 'bg-blue-50 text-blue-800 border-blue-300' },
  resolved: { label: 'RESOLVED', bg: 'bg-emerald-50 text-emerald-800 border-emerald-300' },
  rejected: { label: 'REJECTED', bg: 'bg-rose-50 text-rose-800 border-rose-300' },
}

const CATEGORIES = [
  { id: 'all', label: 'ALL CATEGORIES' },
  { id: 'pothole', label: 'POTHOLE' },
  { id: 'road_waterlogging', label: 'WATERLOGGING' },
  { id: 'garbage_dumping', label: 'GARBAGE DUMP' },
  { id: 'fallen_tree', label: 'FALLEN TREE' },
  { id: 'fallen_electric_pole', label: 'ELECTRIC POLE' },
  { id: 'stray_cattle', label: 'STRAY CATTLE' },
  { id: 'concrete_structure_damage', label: 'STRUCTURAL DAMAGE' },
]

function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  const R = 6371
  const dLat = (lat2 - lat1) * (Math.PI / 180)
  const dLon = (lon2 - lon1) * (Math.PI / 180)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
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
    : 'Recently'

  const statusInfo = STATUS_CONFIG[c.status] || {
    label: (c.status || 'PENDING').toUpperCase(),
    bg: 'bg-neutral-100 text-neutral-800 border-neutral-300'
  }

  const citizenDisplayName = c.citizenName || c.userName || c.users?.full_name || c.user?.full_name || c.user_name || 'Verified Citizen'
  const citizenInitial = citizenDisplayName.charAt(0).toUpperCase()

  return (
    <article
      onClick={() => onDetail(c._id || c.id)}
      className="group bg-white border border-neutral-200 hover:border-black transition-colors duration-150 p-5 cursor-pointer relative flex flex-col justify-between"
    >
      <div>
        {/* Header line: ID + Status + Distance */}
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-neutral-100 mb-4">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-neutral-500 font-semibold tracking-wider">
              #{(c._id || c.id || '').slice(-6).toUpperCase()}
            </span>
            <span className={`font-mono text-[10px] tracking-wider px-2 py-0.5 border ${statusInfo.bg}`}>
              {statusInfo.label}
            </span>
          </div>

          {c.distanceKm !== undefined && c.distanceKm !== 999 && (
            <span className="font-mono text-[11px] text-neutral-600 bg-neutral-100 px-2 py-0.5 border border-neutral-200 flex items-center gap-1">
              <HiLocationMarker className="w-3 h-3 text-neutral-500" />
              {c.distanceKm < 1 ? '< 1 km' : `${c.distanceKm.toFixed(1)} km`}
            </span>
          )}
        </div>

        {/* User Info */}
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-none bg-neutral-900 text-white flex items-center justify-center font-mono text-xs font-bold flex-shrink-0">
            {citizenInitial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-900 truncate">
              {citizenDisplayName}
            </p>
            <div className="flex items-center gap-2 font-mono text-[11px] text-neutral-500 mt-0.5">
              <span className="flex items-center gap-1">
                <HiClock className="w-3 h-3" />
                {time}
              </span>
              {c.location?.address && (
                <>
                  <span>/</span>
                  <span className="truncate max-w-[200px]">{c.location.address}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Title & Description */}
        <h3 className="font-serif font-bold text-neutral-900 text-base leading-snug mb-2 group-hover:underline">
          {c.title || c.complaintTitle || 'Untitled Civic Incident'}
        </h3>
        <p className="text-neutral-600 text-sm leading-relaxed line-clamp-3 mb-4 font-sans">
          {c.description}
        </p>

        {/* Image if present */}
        {c.imageUrl && (
          <div className="mb-4 border border-neutral-200 bg-neutral-50 overflow-hidden max-h-56">
            <img
              src={c.imageUrl}
              alt="Civic evidence"
              className="w-full h-48 object-cover filter contrast-[1.02]"
              onError={(e) => { e.target.style.display = 'none' }}
            />
          </div>
        )}
      </div>

      {/* Metadata & Actions Footer */}
      <div className="pt-3 border-t border-neutral-100 flex items-center justify-between gap-3 text-xs font-mono">
        <div className="flex items-center gap-2 flex-wrap">
          {(c.category || c.issueType) && (
            <span className="border border-neutral-300 px-2 py-0.5 bg-neutral-50 text-neutral-700 tracking-wider uppercase text-[10px]">
              {(c.category || c.issueType).replace(/_/g, ' ')}
            </span>
          )}
          {(() => {
            const pTier = getPriorityTier(c)
            if (pTier.score === null) return null
            return (
              <span className="text-neutral-500 text-[11px] flex items-center gap-1.5">
                PRIORITY: <span className="text-neutral-900 font-bold">{pTier.displayScore}</span>
                <span className={`px-1.5 py-0.5 text-[9px] uppercase tracking-wider font-semibold ${pTier.badgeClass}`}>
                  {pTier.label}
                </span>
              </span>
            )
          })()}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleVote}
            disabled={voting}
            aria-label="Upvote report"
            className="flex items-center gap-1.5 px-2.5 py-1 border border-neutral-300 hover:border-black hover:bg-neutral-900 hover:text-white transition-colors duration-150 disabled:opacity-50 text-neutral-800"
          >
            <HiThumbUp className="w-3.5 h-3.5" />
            <span className="font-bold">{c.upvotes || c.votes || 0}</span>
          </button>
          <span className="text-neutral-400 group-hover:text-black flex items-center gap-1 text-xs uppercase tracking-wider">
            Details →
          </span>
        </div>
      </div>
    </article>
  )
}

export default function ComplaintFeed() {
  const [allComplaints, setAllComplaints] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [userLoc, setUserLoc] = useState(null)
  const [locStatus, setLocStatus] = useState('requesting') // requesting, granted, denied
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [radiusFilter, setRadiusFilter] = useState('3km') // '3km', '10km', 'all'
  const [civicNews, setCivicNews] = useState([])
  const [showNews, setShowNews] = useState(false)

  const navigate = useNavigate()

  const fetchComplaints = async () => {
    try {
      const res = await makeApiCall(apiClient.complaints.all)
      const dataArr = res.data || res.complaints || []
      if (res.success) {
        setAllComplaints(dataArr)
      }
    } catch (err) {
      toast.error('Failed to load civic feed')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // Load sample or real civic news (parity with React Native NewsService)
  useEffect(() => {
    const civicBulletins = [
      {
        id: '1',
        title: 'Municipal Water Main Maintenance Scheduled for Ward 7',
        source: 'Municipal Works Dept',
        time: '2 hours ago',
        tag: 'INFRASTRUCTURE'
      },
      {
        id: '2',
        title: 'Monsoon Preparedness: Storm Drain Desilting in Progress',
        source: 'City Corporation',
        time: '5 hours ago',
        tag: 'DRAINAGE'
      },
      {
        id: '3',
        title: 'Road Surface Restoration on South Avenue Commencing Monday',
        source: 'Urban Roads Bureau',
        time: 'Yesterday',
        tag: 'ROADWORK'
      }
    ]
    setCivicNews(civicBulletins)
  }, [])

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude }
          setUserLoc(loc)
          setLocStatus('granted')
        },
        () => {
          setLocStatus('denied')
        },
        { timeout: 8000 }
      )
    } else {
      setLocStatus('denied')
    }

    fetchComplaints()
  }, [])

  const handleVote = async (id) => {
    try {
      const res = await makeApiCall(apiClient.complaints.vote(), {
        method: 'POST',
        body: JSON.stringify({ complaintId: id }),
      })
      if (res.success) {
        setAllComplaints(prev =>
          prev.map(c => {
            if ((c._id || c.id) !== id) return c
            const voteCount = res?.data?.voteCount
            return {
              ...c,
              upvotes: typeof voteCount === 'number' ? voteCount : (c.upvotes || c.votes || 0) + 1,
              votes: typeof voteCount === 'number' ? voteCount : (c.upvotes || c.votes || 0) + 1,
            }
          })
        )
        toast.success('Vote recorded')
      }
    } catch (err) {
      toast.error(err.message || 'Vote failed')
    }
  }

  const handleRefresh = () => {
    setRefreshing(true)
    fetchComplaints()
  }

  // Computed & filtered list
  const filteredComplaints = useMemo(() => {
    return allComplaints
      .map(c => {
        const lat = c.location?.latitude || c.location_latitude || c.latitude
        const lng = c.location?.longitude || c.location_longitude || c.longitude
        if (!userLoc || !lat || !lng) return { ...c, distanceKm: 999 }
        const dist = getDistanceFromLatLonInKm(userLoc.lat, userLoc.lng, parseFloat(lat), parseFloat(lng))
        return { ...c, distanceKm: dist }
      })
      .filter(c => {
        // Category filter
        if (selectedCategory !== 'all') {
          const cat = (c.category || c.issueType || '').toLowerCase()
          if (cat !== selectedCategory.toLowerCase()) return false
        }
        // Status filter
        if (selectedStatus !== 'all') {
          const st = (c.status || '').toLowerCase()
          if (st !== selectedStatus.toLowerCase()) return false
        }
        // Distance filter
        if (radiusFilter === '3km' && userLoc && locStatus === 'granted') {
          if (c.distanceKm > 3.0) return false
        } else if (radiusFilter === '10km' && userLoc && locStatus === 'granted') {
          if (c.distanceKm > 10.0) return false
        }
        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase()
          const matchTitle = (c.title || c.complaintTitle || '').toLowerCase().includes(q)
          const matchDesc = (c.description || '').toLowerCase().includes(q)
          const matchAddr = (c.location?.address || '').toLowerCase().includes(q)
          if (!matchTitle && !matchDesc && !matchAddr) return false
        }
        return true
      })
      .sort((a, b) => {
        if (userLoc && radiusFilter !== 'all') {
          return a.distanceKm - b.distanceKm
        }
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
      })
  }, [allComplaints, userLoc, locStatus, selectedCategory, selectedStatus, radiusFilter, searchQuery])

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header section */}
      <div className="border-b border-black pb-4 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 font-mono text-xs text-neutral-500 uppercase tracking-widest mb-1">
            <span>URBAN AUDIT</span>
            <span>/</span>
            <span>PUBLIC RECORD</span>
            <span>/</span>
            <span className="text-black font-semibold">FEED</span>
          </div>
          <h1 className="font-serif text-3xl font-bold tracking-tight text-neutral-900 uppercase">
            Civic Incident Ledger
          </h1>
          <p className="text-sm text-neutral-600 mt-1 font-sans max-w-xl">
            Verified citizen reports, active municipal incidents, and proximity dispatch status.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowNews(!showNews)}
            className={`px-3 py-2 text-xs font-mono tracking-wider border transition-colors flex items-center gap-1.5 ${
              showNews ? 'bg-neutral-900 text-white border-black' : 'border-neutral-300 text-neutral-700 hover:border-black'
            }`}
          >
            <HiNewspaper className="w-4 h-4" />
            <span>MUNICIPAL BULLETINS</span>
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 border border-neutral-300 hover:border-black transition-colors disabled:opacity-50"
            title="Refresh Ledger"
          >
            <HiRefresh className={`w-4 h-4 text-neutral-800 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => navigate('/citizen/submit')}
            className="px-4 py-2 bg-black text-white text-xs font-mono font-bold uppercase tracking-wider hover:bg-neutral-800 transition-colors"
          >
            + FILE REPORT
          </button>
        </div>
      </div>

      {/* Municipal Bulletins Banner (collapsible) */}
      {showNews && (
        <div className="border border-neutral-300 bg-neutral-50 p-4 transition-all">
          <div className="flex items-center justify-between mb-3 border-b border-neutral-200 pb-2">
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-neutral-900 flex items-center gap-2">
              <span className="w-2 h-2 bg-neutral-900 inline-block"></span>
              OFFICIAL CIVIC DISPATCHES & ADVISORIES
            </span>
            <span className="font-mono text-[11px] text-neutral-500">LIVE FEED</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {civicNews.map(item => (
              <div key={item.id} className="bg-white border border-neutral-200 p-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-[10px] font-mono text-neutral-500 mb-1">
                    <span className="bg-neutral-100 px-1.5 py-0.5 border border-neutral-200">{item.tag}</span>
                    <span>{item.time}</span>
                  </div>
                  <h4 className="text-xs font-bold text-neutral-900 leading-snug line-clamp-2">
                    {item.title}
                  </h4>
                </div>
                <p className="font-mono text-[10px] text-neutral-500 mt-2 border-t border-neutral-100 pt-1">
                  Issued by: {item.source}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter & Search Toolbar */}
      <div className="border border-neutral-200 bg-white p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search bar */}
          <div className="relative flex-1">
            <HiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Search by keywords, street, or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-neutral-300 text-sm font-sans placeholder-neutral-400 focus:outline-none focus:border-black rounded-none"
            />
          </div>

          {/* Status dropdown */}
          <div className="flex items-center gap-2">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="border border-neutral-300 py-2 px-3 text-xs font-mono uppercase bg-white focus:outline-none focus:border-black rounded-none"
            >
              <option value="all">ALL STATUSES</option>
              <option value="pending">PENDING</option>
              <option value="in_progress">IN PROGRESS</option>
              <option value="resolved">RESOLVED</option>
              <option value="rejected">REJECTED</option>
            </select>

            {/* Radius filter */}
            <select
              value={radiusFilter}
              onChange={(e) => setRadiusFilter(e.target.value)}
              className="border border-neutral-300 py-2 px-3 text-xs font-mono uppercase bg-white focus:outline-none focus:border-black rounded-none"
            >
              <option value="3km">RADIUS: 3 KM</option>
              <option value="10km">RADIUS: 10 KM</option>
              <option value="all">ANY DISTANCE</option>
            </select>
          </div>
        </div>

        {/* Category horizontal scroll bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-1 pb-1 scrollbar-none border-t border-neutral-100">
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1 text-[11px] font-mono tracking-wider uppercase whitespace-nowrap transition-colors border ${
                selectedCategory === cat.id
                  ? 'bg-neutral-900 text-white border-black font-bold'
                  : 'border-neutral-200 text-neutral-600 hover:border-neutral-400 bg-neutral-50'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Active filters status & count */}
      <div className="flex items-center justify-between text-xs font-mono text-neutral-500 px-1">
        <span>
          SHOWING {filteredComplaints.length} INCIDENT{filteredComplaints.length === 1 ? '' : 'S'}
          {locStatus === 'granted' && radiusFilter !== 'all' ? ` WITHIN ${radiusFilter.toUpperCase()}` : ''}
        </span>
        {locStatus === 'granted' ? (
          <span className="text-emerald-700 flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-emerald-600 inline-block"></span>
            GEOLOCATION ACTIVE
          </span>
        ) : (
          <span className="text-neutral-500">CITY-WIDE DISPATCH</span>
        )}
      </div>

      {/* Main Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="border border-neutral-200 p-5 space-y-4 bg-white">
              <div className="flex justify-between items-center">
                <div className="h-4 w-24 bg-neutral-200 animate-pulse"></div>
                <div className="h-4 w-16 bg-neutral-200 animate-pulse"></div>
              </div>
              <div className="h-5 w-3/4 bg-neutral-200 animate-pulse"></div>
              <div className="h-16 w-full bg-neutral-100 animate-pulse"></div>
              <div className="h-4 w-1/2 bg-neutral-200 animate-pulse"></div>
            </div>
          ))}
        </div>
      ) : filteredComplaints.length === 0 ? (
        <div className="border border-dashed border-neutral-300 bg-white p-12 text-center">
          <HiExclamationCircle className="w-10 h-10 text-neutral-400 mx-auto mb-3" />
          <h3 className="font-serif text-lg font-bold text-neutral-900 uppercase">
            No Incidents Found
          </h3>
          <p className="text-sm text-neutral-500 font-sans mt-1 max-w-sm mx-auto">
            No complaints match the selected filter criteria or geographic radius.
          </p>
          <div className="mt-5 flex items-center justify-center gap-3">
            <button
              onClick={() => {
                setSelectedCategory('all')
                setSelectedStatus('all')
                setRadiusFilter('all')
                setSearchQuery('')
              }}
              className="px-4 py-2 border border-neutral-300 text-xs font-mono uppercase hover:border-black"
            >
              RESET FILTERS
            </button>
            <button
              onClick={() => navigate('/citizen/submit')}
              className="px-4 py-2 bg-black text-white text-xs font-mono uppercase hover:bg-neutral-800"
            >
              FILE REPORT
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
