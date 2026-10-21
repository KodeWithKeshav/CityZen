import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Popup, CircleMarker, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet.heat'
import { makeApiCall, apiClient } from '../../services/api'
import toast from 'react-hot-toast'
import 'leaflet/dist/leaflet.css'
import { HiX, HiArrowRight, HiMap, HiChartBar, HiSparkles } from 'react-icons/hi'
import { getPriorityTier } from '../../utils/priorityUtils'
import ExplainAiModal from '../../components/ExplainAiModal'

// Fix default marker icons
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyBqn-8BPXpdcIAnjaEN9iwNC47epZP6Q6w'

const MAP_LAYERS = {
  google: {
    url: `https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&key=${GOOGLE_MAPS_API_KEY}`,
    attribution: '&copy; <a href="https://maps.google.com">Google Maps</a>'
  },
  osm: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }
}

const STATUS_COLORS = {
  pending: '#B45309', // amber-700
  resolved: '#047857', // emerald-700
  in_progress: '#1D4ED8', // blue-700
  'in-progress': '#1D4ED8',
  rejected: '#BE123C', // rose-700
  active: '#1D4ED8'
}

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

function HeatmapLayer({ points, maxZoom = 17, radius = 25, blur = 15, max = 5 }) {
  const map = useMap()
  useEffect(() => {
    if (!map || !points || points.length === 0) return
    const heatData = points.map(p => [
      p.lat || p.latitude,
      p.lng || p.longitude,
      p.weight || 1
    ])
    const heat = L.heatLayer(heatData, { radius, blur, maxZoom, max }).addTo(map)
    return () => map.removeLayer(heat)
  }, [map, points, radius, blur, maxZoom, max])
  return null
}

function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng)
    }
  })
  return null
}

export default function ComplaintMap() {
  const [data, setData] = useState({ points: [], statistics: null })
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [viewMode, setViewMode] = useState('heatmap') // 'heatmap' or 'pins'
  const [selectedZonePoints, setSelectedZonePoints] = useState(null)
  const [explainModalState, setExplainModalState] = useState({ isOpen: false, imageUrl: null, title: '' })
  const navigate = useNavigate()

  useEffect(() => {
    const fetchHeatMap = async () => {
      try {
        const res = await makeApiCall(apiClient.heatMap.data)
        if (res.success && res.data) setData(res.data)
      } catch (err) {
        toast.error('Failed to load spatial map telemetry')
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
    const radiusKm = 2.0
    const nearby = mapped.filter(p => {
      const lat = p.lat || p.latitude
      const lng = p.lng || p.longitude
      const dist = getDistanceFromLatLonInKm(latlng.lat, latlng.lng, lat, lng)
      return dist <= radiusKm
    })
    setSelectedZonePoints(nearby)
  }

  const center = mapped.length > 0
    ? [mapped[0].lat || mapped[0].latitude, mapped[0].lng || mapped[0].longitude]
    : [20.5937, 78.9629]

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] border border-neutral-300 bg-white">
      {/* Top Header & Telemetry Banner */}
      <div className="p-4 border-b border-neutral-300 bg-white z-10">
        <div className="flex items-start justify-between flex-wrap gap-4 mb-4">
          <div>
            <div className="font-mono text-xs text-neutral-500 uppercase tracking-widest mb-0.5">
              GEOSPATIAL INCIDENT TELEMETRY
            </div>
            <h1 className="font-serif text-2xl font-bold text-neutral-900 uppercase">
              Spatial Density Map
            </h1>
            <p className="text-xs text-neutral-600 font-sans mt-0.5">
              Tracking {mapped.length} localized civic incidents. Click any coordinate on the map to audit surrounding 2km zone.
            </p>
          </div>

          <div className="flex border border-neutral-300">
            <button
              onClick={() => { setViewMode('heatmap'); setSelectedZonePoints(null); }}
              className={`px-4 py-1.5 font-mono text-xs uppercase tracking-wider transition-colors ${
                viewMode === 'heatmap'
                  ? 'bg-neutral-900 text-white font-bold'
                  : 'bg-white text-neutral-700 hover:bg-neutral-100'
              }`}
            >
              HEATMAP DENSITY
            </button>
            <button
              onClick={() => { setViewMode('pins'); setSelectedZonePoints(null); }}
              className={`px-4 py-1.5 font-mono text-xs uppercase tracking-wider transition-colors border-l border-neutral-300 ${
                viewMode === 'pins'
                  ? 'bg-neutral-900 text-white font-bold'
                  : 'bg-white text-neutral-700 hover:bg-neutral-100'
              }`}
            >
              PIN VECTORS
            </button>
          </div>
        </div>

        {/* Global Statistics Grid */}
        {data.statistics && (
          <div className="grid grid-cols-3 gap-3 mb-4 font-mono text-xs">
            <div className="border border-neutral-200 p-3 bg-neutral-50">
              <span className="text-[10px] text-neutral-500 uppercase tracking-wider block">
                TOTAL TELEMETRY
              </span>
              <span className="text-xl font-bold text-neutral-900">
                {data.statistics.total}
              </span>
            </div>
            <div className="border border-neutral-200 p-3 bg-neutral-50">
              <span className="text-[10px] text-neutral-500 uppercase tracking-wider block">
                RESOLVED INCIDENTS
              </span>
              <span className="text-xl font-bold text-neutral-900">
                {data.statistics.resolved}
              </span>
            </div>
            <div className="border border-neutral-200 p-3 bg-neutral-50">
              <span className="text-[10px] text-neutral-500 uppercase tracking-wider block">
                RESOLUTION EFFICIENCY
              </span>
              <span className="text-xl font-bold text-neutral-900">
                {data.statistics.resolutionRate}%
              </span>
            </div>
          </div>
        )}

        {/* Filters & Status Legend */}
        <div className="flex items-center justify-between flex-wrap gap-3 font-mono text-xs pt-1">
          <div className="flex gap-1.5 flex-wrap">
            {['all', 'pending', 'resolved'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 border uppercase tracking-wider transition-colors ${
                  filter === f
                    ? 'bg-neutral-900 text-white border-black font-bold'
                    : 'border-neutral-300 text-neutral-700 hover:border-black bg-white'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="flex gap-4 flex-wrap items-center">
            {Object.entries(STATUS_COLORS)
              .filter(([k]) => !k.includes('-') && k !== 'active')
              .map(([status, color]) => (
                <div key={status} className="flex items-center gap-1.5 text-[11px] text-neutral-600 uppercase">
                  <div className="w-2.5 h-2.5" style={{ backgroundColor: color }} />
                  <span>{status.replace(/_/g, ' ')}</span>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Map Body & Zone Drawer */}
      <div className="flex-1 relative z-0 flex overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center w-full h-full font-mono text-xs text-neutral-500">
            INITIALIZING SPATIAL RASTER...
          </div>
        ) : (
          <>
            <div className="flex-1 relative h-full">
              <MapContainer
                center={center}
                zoom={mapped.length > 0 ? 13 : 5}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  attribution={MAP_LAYERS.google.attribution}
                  url={MAP_LAYERS.google.url}
                />

                <MapClickHandler onMapClick={handleMapClick} />

                {viewMode === 'heatmap' && <HeatmapLayer points={mapped} />}

                {viewMode === 'pins' &&
                  mapped.map(c => {
                    const lat = c.lat || c.latitude
                    const lng = c.lng || c.longitude
                    const color = STATUS_COLORS[c.status] || STATUS_COLORS.pending
                    return (
                      <CircleMarker
                        key={c.id}
                        center={[lat, lng]}
                        radius={7}
                        fillColor={color}
                        color="#000000"
                        weight={1.5}
                        opacity={1}
                        fillOpacity={0.9}
                      >
                        <Popup>
                          <div className="font-mono text-xs p-1 max-w-[240px]">
                            {(() => {
                              const pTier = getPriorityTier(c)
                              if (pTier.score === null) return null
                              return (
                                <div className={`text-[10px] font-bold tracking-wider uppercase mb-1 px-1.5 py-0.5 border ${pTier.badgeClass}`}>
                                  {pTier.label} (SCORE: {pTier.displayScore})
                                </div>
                              )
                            })()}
                            <h4 className="font-serif font-bold text-neutral-900 text-sm mb-1">
                              {c.title || c.tooltip?.split('\n')[0]}
                            </h4>
                            <p className="text-neutral-500 font-sans text-xs mb-2 line-clamp-2">
                              {c.location || 'Local coordinate'}
                            </p>
                            {c.imageUrl && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setExplainModalState({
                                    isOpen: true,
                                    imageUrl: c.imageUrl,
                                    title: c.title || c.tooltip?.split('\n')[0] || 'Civic Incident'
                                  })
                                }}
                                className="mb-2 w-full py-1 bg-neutral-900 text-white hover:bg-neutral-800 border border-black font-mono text-[10px] uppercase font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                              >
                                <HiSparkles className="w-3 h-3 text-neutral-300" />
                                EXPLAIN AI (SAM-3)
                              </button>
                            )}
                            <div className="flex items-center justify-between border-t border-neutral-200 pt-2">
                              <span className="uppercase text-[10px] font-bold text-neutral-700">
                                {c.status?.replace(/_/g, ' ')}
                              </span>
                              <button
                                onClick={() => navigate(`/citizen/complaint/${c.id}`)}
                                className="text-neutral-900 font-bold hover:underline text-[11px] flex items-center gap-1"
                              >
                                DOSSIER →
                              </button>
                            </div>
                          </div>
                        </Popup>
                      </CircleMarker>
                    )
                  })}
              </MapContainer>
            </div>

            {/* Side Panel for Clicked Coordinate Zone */}
            {selectedZonePoints && (
              <div className="w-88 border-l border-neutral-300 bg-white flex flex-col h-full z-[1000] shadow-xl">
                <div className="p-4 border-b border-neutral-200 flex justify-between items-center bg-neutral-50 font-mono text-xs">
                  <div>
                    <h3 className="font-bold uppercase tracking-wider text-neutral-900">
                      Audit Perimeter
                    </h3>
                    <p className="text-[11px] text-neutral-500">
                      {selectedZonePoints.length} incident(s) within 2.0 km radius
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedZonePoints(null)}
                    className="p-1.5 border border-neutral-300 hover:border-black transition-colors"
                  >
                    <HiX className="w-4 h-4 text-neutral-700" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {selectedZonePoints.length === 0 ? (
                    <div className="text-center py-12 font-mono text-xs text-neutral-500">
                      NO CONCURRENT INCIDENTS LOCATED IN THIS VICINITY.
                    </div>
                  ) : (
                    selectedZonePoints.map(p => {
                      const color = STATUS_COLORS[p.status] || STATUS_COLORS.pending
                      return (
                        <div
                          key={p.id}
                          onClick={() => navigate(`/citizen/complaint/${p.id}`)}
                          className="p-3 border border-neutral-200 hover:border-black cursor-pointer transition-colors bg-white font-mono text-xs"
                        >
                          <div className="flex justify-between items-start mb-1 gap-2">
                            <h4 className="font-serif font-bold text-neutral-900 line-clamp-1 flex-1 text-sm">
                              {p.title || p.tooltip?.split('\n')[0]}
                            </h4>
                            <span
                              className="text-[10px] font-bold px-1.5 py-0.5 uppercase border"
                              style={{ borderColor: color, color: color }}
                            >
                              {p.status?.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <p className="text-neutral-500 font-sans text-xs line-clamp-2 mt-1">
                            {p.location || 'Coordinate registered'}
                          </p>
                          <div className="mt-2 pt-1 border-t border-neutral-100 flex justify-end">
                            <span className="text-neutral-900 text-[11px] font-bold flex items-center gap-1 hover:underline">
                              VIEW DETAILS <HiArrowRight className="w-3 h-3" />
                            </span>
                          </div>
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

      {/* Explain AI Modal (SAM-3 Vision Diagnostics) */}
      <ExplainAiModal
        isOpen={explainModalState.isOpen}
        onClose={() => setExplainModalState(prev => ({ ...prev, isOpen: false }))}
        imageUrl={explainModalState.imageUrl}
        title={explainModalState.title}
      />
    </div>
  )
}
