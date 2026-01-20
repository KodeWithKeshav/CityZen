import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import L from 'leaflet'
import { makeApiCall, apiClient } from '../../services/api'
import toast from 'react-hot-toast'
import 'leaflet/dist/leaflet.css'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const STATUS_COLORS = {
  pending: '#f59e0b',
  resolved: '#22c55e',
  in_progress: '#3b82f6',
  'in-progress': '#3b82f6',
  rejected: '#ef4444',
}

export default function AdminComplaintMap() {
  const [complaints, setComplaints] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const navigate = useNavigate()

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await makeApiCall(apiClient.complaints.all)
        const dataArray = res.complaints || res.data || []
        if (res.success || Array.isArray(dataArray)) setComplaints(dataArray)
      } catch { toast.error('Failed to load map') }
      finally { setLoading(false) }
    }
    fetch()
  }, [])

  const mapped = complaints.filter(c => {
    const lat = c.location_latitude || c.location?.latitude || c.location?.lat
    const lng = c.location_longitude || c.location?.longitude || c.location?.lng
    if (!lat || !lng) return false
    if (filter === 'all') return true
    return c.status === filter || c.status === filter.replace(/_/g, '-')
  })

  const center = mapped.length > 0
    ? [mapped[0].location_latitude || mapped[0].location?.latitude || mapped[0].location?.lat, mapped[0].location_longitude || mapped[0].location?.longitude || mapped[0].location?.lng]
    : [20.5937, 78.9629]

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Complaint Map</h1>
            <p className="text-sm text-gray-500">{mapped.length} complaints plotted</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {['all', 'pending', 'resolved', 'in_progress', 'rejected'].map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all
                  ${filter === f ? 'bg-admin-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {f === 'in_progress' ? 'In Progress' : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-4 mt-3 flex-wrap">
          {Object.entries(STATUS_COLORS).filter(([k]) => !k.includes('-')).map(([s, c]) => (
            <div key={s} className="flex items-center gap-1.5 text-xs text-gray-600">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c }} />
              <span className="capitalize">{s.replace(/_/g,' ')}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 relative">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-admin-700" />
          </div>
        ) : (
          <MapContainer center={center} zoom={mapped.length > 0 ? 12 : 5} style={{ height: '100%', width: '100%' }}>
            <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {mapped.map(c => {
              const lat = c.location_latitude || c.location?.latitude || c.location?.lat
              const lng = c.location_longitude || c.location?.longitude || c.location?.lng
              const color = STATUS_COLORS[c.status] || STATUS_COLORS.pending
              return (
                <CircleMarker key={c._id || c.id} center={[lat, lng]} radius={10}
                  fillColor={color} color={color} weight={2} opacity={1} fillOpacity={0.7}>
                  <Popup>
                    <div className="text-sm min-w-48">
                      <p className="font-bold mb-1">{c.title || c.complaintTitle}</p>
                      <p className="text-xs text-gray-600 mb-1">{c.citizenName}</p>
                      <p className="text-xs text-gray-500 mb-2 line-clamp-2">{c.description}</p>
                      <button onClick={() => navigate(`/admin/complaints/${c._id || c.id}`)}
                        className="text-xs text-admin-700 font-semibold hover:underline">
                        Manage →
                      </button>
                    </div>
                  </Popup>
                </CircleMarker>
              )
            })}
          </MapContainer>
        )}
      </div>
    </div>
  )
}
