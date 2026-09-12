import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import L from 'leaflet'
import { makeApiCall, apiClient } from '../../services/api'
import toast from 'react-hot-toast'
import 'leaflet/dist/leaflet.css'
import { HiArrowRight, HiSparkles } from 'react-icons/hi'
import { getPriorityTier } from '../../utils/priorityUtils'
import ExplainAiModal from '../../components/ExplainAiModal'

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
}

export default function AdminComplaintMap() {
  const [complaints, setComplaints] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [explainModalState, setExplainModalState] = useState({ isOpen: false, imageUrl: null, title: '' })
  const navigate = useNavigate()

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await makeApiCall(apiClient.complaints.all)
        const dataArray = res.complaints || res.data || []
        if (res.success || Array.isArray(dataArray)) setComplaints(dataArray)
      } catch {
        toast.error('Failed to load spatial cadastre')
      } finally {
        setLoading(false)
      }
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
    ? [
        mapped[0].location_latitude || mapped[0].location?.latitude || mapped[0].location?.lat,
        mapped[0].location_longitude || mapped[0].location?.longitude || mapped[0].location?.lng
      ]
    : [20.5937, 78.9629]

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] border border-neutral-300 bg-white">
      {/* Top Controls Bar */}
      <div className="p-4 border-b border-neutral-300 bg-white z-10">
        <div className="flex items-start justify-between flex-wrap gap-4 mb-3">
          <div>
            <div className="font-mono text-xs text-neutral-500 uppercase tracking-widest mb-0.5">
              MUNICIPAL GIS CADASTRE
            </div>
            <h1 className="font-serif text-2xl font-bold text-neutral-900 uppercase">
              Incident Spatial Distribution
            </h1>
            <p className="text-xs text-neutral-600 font-sans mt-0.5">
              Geographic coordinates plotted for <strong className="text-black">{mapped.length}</strong> active civic dispatches.
            </p>
          </div>

          <div className="flex gap-1.5 flex-wrap font-mono text-xs">
            {['all', 'pending', 'resolved', 'in_progress', 'rejected'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 border uppercase tracking-wider transition-colors ${
                  filter === f
                    ? 'bg-neutral-900 text-white border-black font-bold'
                    : 'border-neutral-300 text-neutral-700 hover:border-black bg-white'
                }`}
              >
                {f.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-4 flex-wrap items-center font-mono text-xs border-t border-neutral-100 pt-2">
          <span className="text-neutral-400 text-[10px] uppercase">STATUS VECTORS:</span>
          {Object.entries(STATUS_COLORS)
            .filter(([k]) => !k.includes('-'))
            .map(([s, c]) => (
              <div key={s} className="flex items-center gap-1.5 text-[11px] text-neutral-600 uppercase">
                <div className="w-2.5 h-2.5" style={{ backgroundColor: c }} />
                <span>{s.replace(/_/g, ' ')}</span>
              </div>
            ))}
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative z-0">
        {loading ? (
          <div className="flex items-center justify-center h-full font-mono text-xs text-neutral-500">
            INITIALIZING MUNICIPAL RASTER...
          </div>
        ) : (
          <MapContainer
            center={center}
            zoom={mapped.length > 0 ? 12 : 5}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution={MAP_LAYERS.google.attribution}
              url={MAP_LAYERS.google.url}
            />
            {mapped.map(c => {
              const lat = c.location_latitude || c.location?.latitude || c.location?.lat
              const lng = c.location_longitude || c.location?.longitude || c.location?.lng
              const color = STATUS_COLORS[c.status] || STATUS_COLORS.pending
              return (
                <CircleMarker
                  key={c._id || c.id}
                  center={[lat, lng]}
                  radius={8}
                  fillColor={color}
                  color="#000000"
                  weight={1.5}
                  opacity={1}
                  fillOpacity={0.85}
                >
                  <Popup>
                    <div className="font-mono text-xs p-1 max-w-[240px]">
                      <span className="text-neutral-400 text-[10px] block mb-1">
                        DOSSIER #{(c._id || c.id || '').slice(-6).toUpperCase()}
                      </span>
                      {(() => {
                        const pTier = getPriorityTier(c)
                        if (pTier.score === null) return null
                        return (
                          <div className={`text-[10px] font-bold tracking-wider uppercase mb-1 px-1.5 py-0.5 border ${pTier.badgeClass}`}>
                            {pTier.label} (SCORE: {pTier.displayScore})
                          </div>
                        )
                      })()}
                      <h4 className="font-serif font-bold text-neutral-900 text-sm mb-1 leading-snug">
                        {c.title || c.complaintTitle || 'Civic Incident'}
                      </h4>
                      <p className="text-neutral-500 font-sans text-xs mb-2 line-clamp-2">
                        {c.description}
                      </p>
                      {(() => {
                        const img = c.imageUrl || (Array.isArray(c.image_urls) ? c.image_urls[0] : null)
                        if (!img) return null
                        return (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setExplainModalState({
                                isOpen: true,
                                imageUrl: img,
                                title: c.title || c.complaintTitle || 'Civic Incident'
                              })
                            }}
                            className="mb-2 w-full py-1 bg-neutral-900 text-white hover:bg-neutral-800 border border-black font-mono text-[10px] uppercase font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                          >
                            <HiSparkles className="w-3 h-3 text-neutral-300" />
                            EXPLAIN AI (SAM-3)
                          </button>
                        )
                      })()}
                      <div className="flex items-center justify-between border-t border-neutral-200 pt-2">
                        <span className="uppercase text-[10px] font-bold text-neutral-700">
                          {c.status?.replace(/_/g, ' ')}
                        </span>
                        <button
                          onClick={() => navigate(`/admin/complaints/${c._id || c.id}`)}
                          className="text-neutral-900 font-bold hover:underline text-[11px] flex items-center gap-1"
                        >
                          AUDIT DOSSIER <HiArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </Popup>
                </CircleMarker>
              )
            })}
          </MapContainer>
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
