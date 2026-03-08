// Spatial analytics component for UrbanPulse
import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Popup, CircleMarker, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet.heat'
import { makeApiCall, apiClient } from '../../services/api'
import toast from 'react-hot-toast'
import 'leaflet/dist/leaflet.css'

// Fix default marker icons
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
  active: '#3b82f6'
}

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

// Wrapper component to add the Heatmap Layer
function HeatmapLayer({ points, maxZoom = 17, radius = 25, blur = 15, max = 5 }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !points || points.length === 0) return;
    const heatData = points.map(p => [
      p.lat || p.latitude,
      p.lng || p.longitude,
      p.weight || 1
    ]);
    const heat = L.heatLayer(heatData, { radius, blur, maxZoom, max }).addTo(map);
    return () => map.removeLayer(heat);
  }, [map, points, radius, blur, maxZoom, max]);
  return null;
}

// Component to handle Map Clicks
function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng);
    }
  });
  return null;
}

export default function ComplaintMap() {
  const [data, setData] = useState({ points: [], statistics: null })
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [viewMode, setViewMode] = useState('heatmap') // 'heatmap' or 'pins'
  const [selectedZonePoints, setSelectedZonePoints] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    const fetchHeatMap = async () => {
      try {
        const res = await makeApiCall(apiClient.heatMap.data)
        if (res.success && res.data) setData(res.data)
      } catch (err) {
        toast.error('Failed to load map data')
      } finally {
        setLoading(false)
      }
    }
    fetchHeatMap()
  }, [])

  const mapped = useMemo(() => {
    return (data.points || []).filter(c => {
      const lat = c.lat || c.latitude
      const lng = c.lng || c.longitude
      if (!lat || !lng) return false
      if (filter === 'all') return true
      return c.status === filter || c.status === filter.replace(/_/g, '-') || c.markerType === filter
    })
  }, [data.points, filter])

  const handleMapClick = (latlng) => {
    // Collect points within a 2km radius
    const radiusKm = 2.0;
    const nearby = mapped.filter(p => {
       const lat = p.lat || p.latitude;
       const lng = p.lng || p.longitude;
       const dist = getDistanceFromLatLonInKm(latlng.lat, latlng.lng, lat, lng);
       return dist <= radiusKm;
    });
    setSelectedZonePoints(nearby);
  }

  // Center on first complaint or default to India center
  const center = mapped.length > 0
    ? [mapped[0].lat || mapped[0].latitude, mapped[0].lng || mapped[0].longitude]
    : [20.5937, 78.9629]

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="p-4 bg-white border-b border-gray-200 z-10 relative">
        <div className="flex items-start justify-between flex-wrap gap-4 mb-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900 mb-1">Spatial Heatmap Analytics</h1>
            <p className="text-sm text-gray-500">Visualizing {mapped.length} localized civic issues. <span className="font-medium text-primary-600">Click anywhere to see nearby zones!</span></p>
          </div>
          <div className="flex bg-gray-100 p-1 rounded-full">
            <button
              onClick={() => { setViewMode('heatmap'); setSelectedZonePoints(null); }}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                viewMode === 'heatmap' ? 'bg-primary-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Heatmap Mode
            </button>
            <button
              onClick={() => { setViewMode('pins'); setSelectedZonePoints(null); }}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                viewMode === 'pins' ? 'bg-primary-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Pin Mode
            </button>
          </div>
        </div>

        {/* Global Statistics */}
        {data.statistics && (
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-blue-50/50 rounded-xl p-3 border border-blue-100">
              <p className="text-xs text-blue-600 font-medium mb-1 tracking-wide uppercase">Total Reports</p>
              <p className="text-2xl font-black text-blue-950">{data.statistics.total}</p>
            </div>
            <div className="bg-emerald-50/50 rounded-xl p-3 border border-emerald-100">
              <p className="text-xs text-emerald-600 font-medium mb-1 tracking-wide uppercase">Resolved</p>
              <p className="text-2xl font-black text-emerald-950">{data.statistics.resolved}</p>
            </div>
            <div className="bg-amber-50/50 rounded-xl p-3 border border-amber-100">
              <p className="text-xs text-amber-600 font-medium mb-1 tracking-wide uppercase">Resolution Rate</p>
              <p className="text-2xl font-black text-amber-950">{data.statistics.resolutionRate}%</p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex gap-2 flex-wrap">
            {['all', 'pending', 'resolved'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all
                  ${filter === f ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          <div className="flex gap-4 flex-wrap">
            {Object.entries(STATUS_COLORS).filter(([k]) => !k.includes('-') && k !== 'active').map(([status, color]) => (
              <div key={status} className="flex items-center gap-1.5 text-xs text-gray-600 font-medium">
                <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: color }} />
                <span className="capitalize">{status.replace(/_/g, ' ')}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Map Content Container */}
      <div className="flex-1 relative z-0 flex overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center w-full h-full">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-700" />
          </div>
        ) : (
          <>
            <div className="flex-1 relative h-full">
              <MapContainer center={center} zoom={mapped.length > 0 ? 14 : 5} style={{ height: '100%', width: '100%' }}>
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                
                <MapClickHandler onMapClick={handleMapClick} />

                {viewMode === 'heatmap' && <HeatmapLayer points={mapped} />}

                {viewMode === 'pins' && mapped.map((c) => {
                  const lat = c.lat || c.latitude
                  const lng = c.lng || c.longitude
                  const color = STATUS_COLORS[c.status] || STATUS_COLORS.pending
                  return (
                    <CircleMarker
                      key={c.id}
                      center={[lat, lng]}
                      radius={8}
                      fillColor={color}
                      color={color}
                      weight={2}
                      opacity={1}
                      fillOpacity={0.8}
                    >
                      <Popup className="rounded-2xl">
                        <div className="text-sm min-w-[220px]">
                          {c.priorityScore >= 80 && (
                            <div className="text-[10px] font-black tracking-widest text-red-600 uppercase mb-2 bg-red-50 p-1.5 rounded-lg inline-block">
                              CRITICAL PRIORITY
                            </div>
                          )}
                          <p className="font-bold text-gray-900 mb-1">{c.title || c.tooltip?.split('\n')[0]}</p>
                          <p className="text-gray-500 text-xs mb-3 line-clamp-2">{c.location}</p>
                          <div className="flex items-center justify-between">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold capitalize`}
                              style={{ background: color + '20', color }}>
                              {c.status?.replace(/_/g, ' ')}
                            </span>
                            <button
                              onClick={() => navigate(`/citizen/complaint/${c.id}`)}
                              className="text-xs text-primary-700 font-bold hover:underline"
                            >
                              Details â†’
                            </button>
                          </div>
                        </div>
                      </Popup>
                    </CircleMarker>
                  )
                })}
              </MapContainer>
            </div>

            {/* Side Panel for Clicked Zone */}
            {selectedZonePoints && (
              <div className="w-80 bg-white border-l border-gray-200 shadow-2xl flex flex-col h-full z-[1000] relative">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                  <div>
                    <h3 className="font-bold text-gray-900 leading-tight">Selected Zone</h3>
                    <p className="text-xs text-gray-500">{selectedZonePoints.length} reports within 2km</p>
                  </div>
                  <button onClick={() => setSelectedZonePoints(null)} className="w-8 h-8 flex items-center justify-center hover:bg-gray-200 rounded-full text-gray-500 transition-colors">
                    âœ•
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-3 pb-20 space-y-2">
                  {selectedZonePoints.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center opacity-50">
                      <p className="text-sm font-medium text-gray-900">No dense issues locally</p>
                      <p className="text-xs text-gray-500 mt-1">Try clicking closer to a glowing hotspot.</p>
                    </div>
                  ) : (
                    selectedZonePoints.map(p => {
                      const color = STATUS_COLORS[p.status] || STATUS_COLORS.pending;
                      return (
                        <div key={p.id} onClick={() => navigate(`/citizen/complaint/${p.id}`)} className="p-3 bg-white border border-gray-100 rounded-xl hover:border-primary-300 hover:shadow-md cursor-pointer transition-all">
                          <div className="flex justify-between items-start mb-1.5 gap-2">
                            <p className="font-bold text-sm text-gray-900 line-clamp-1 flex-1">{p.title || p.tooltip?.split('\n')[0]}</p>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md capitalize whitespace-nowrap" style={{ background: color + '15', color }}>
                              {p.status.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{p.location || 'Unknown location'}</p>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
