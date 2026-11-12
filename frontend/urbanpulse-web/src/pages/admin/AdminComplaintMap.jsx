import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet'
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

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''

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

const ACTIVE_TILE_LAYER = GOOGLE_MAPS_API_KEY ? MAP_LAYERS.google : MAP_LAYERS.osm

const STATUS_COLORS = {
  pending: '#B45309', // amber-700
  resolved: '#047857', // emerald-700
  in_progress: '#1D4ED8', // blue-700
  'in-progress': '#1D4ED8',
  rejected: '#BE123C', // rose-700
}

function getCoordinates(c) {
  const rawLat = c?.location_latitude ?? c?.latitude ?? c?.location?.latitude ?? c?.location?.lat
  const rawLng = c?.location_longitude ?? c?.longitude ?? c?.location?.longitude ?? c?.location?.lng
  if (rawLat === null || rawLat === undefined || rawLat === '' || rawLng === null || rawLng === undefined || rawLng === '') {
    return null
  }
  const lat = Number(rawLat)
  const lng = Number(rawLng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) {
    return null
  }
  return [lat, lng]
}

function MapAutoCenter({ coordsList }) {
  const map = useMap()
  useEffect(() => {
    if (!coordsList || coordsList.length === 0) return
    if (coordsList.length === 1) {
      map.setView(coordsList[0], 13, { animate: true })
    } else {
      const bounds = L.latLngBounds(coordsList)
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14, animate: true })
      }
    }
  }, [map, coordsList])
  return null
}

export default function AdminComplaintMap() {
  const { t } = useTranslation('admin')
  const [complaints, setComplaints] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [explainModalState, setExplainModalState] = useState({ isOpen: false, imageUrl: null, title: '', category: undefined })
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false
    const fetchComplaints = async () => {
      try {
        const res = await makeApiCall(apiClient.complaints.all)
        if (cancelled) return
        const dataArray = res?.complaints || res?.data
        if (res?.success && Array.isArray(dataArray)) {
          setComplaints(dataArray)
        } else {
          toast.error(res?.message || res?.error || t('complaintMap.loadFailed'))
        }
      } catch {
        if (!cancelled) toast.error(t('complaintMap.loadFailed'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchComplaints()
    return () => { cancelled = true }
  }, [])

  const mapped = useMemo(() => {
    const normalizedFilter = filter.toLowerCase()
    const hyphenFilter = normalizedFilter.replace(/_/g, '-')
    return complaints
      .map(c => ({ complaint: c, coords: getCoordinates(c) }))
      .filter(({ complaint: c, coords }) => {
        if (!coords) return false
        if (normalizedFilter === 'all') return true
        const st = (c.status || '').toLowerCase()
        return st === normalizedFilter || st === hyphenFilter
      })
  }, [complaints, filter])

  const coordsList = useMemo(() => mapped.map(m => m.coords), [mapped])

  const center = coordsList.length > 0 ? coordsList[0] : [20.5937, 78.9629]

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] border border-neutral-300 bg-white">
      {/* Top Controls Bar */}
      <div className="p-4 border-b border-neutral-300 bg-white z-10">
        <div className="flex items-start justify-between flex-wrap gap-4 mb-3">
          <div>
            <div className="font-mono text-xs text-neutral-500 uppercase tracking-widest mb-0.5">
              {t('complaintMap.gisCadastre')}
            </div>
            <h1 className="font-serif text-2xl font-bold text-neutral-900 uppercase">
              {t('complaintMap.title')}
            </h1>
            <p className="text-xs text-neutral-600 font-sans mt-0.5">
              {t('complaintMap.subtitle', { count: mapped.length })}
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
          <span className="text-neutral-400 text-[10px] uppercase">{t('complaintMap.statusVectors')}</span>
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
            {t('complaintMap.initializing')}
          </div>
        ) : (
          <MapContainer
            center={center}
            zoom={mapped.length > 0 ? 12 : 5}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution={ACTIVE_TILE_LAYER.attribution}
              url={ACTIVE_TILE_LAYER.url}
            />
            <MapAutoCenter coordsList={coordsList} />
            {mapped.map(({ complaint: c, coords }) => {
              const statusKey = (c.status || 'pending').toLowerCase()
              const color = STATUS_COLORS[statusKey] || STATUS_COLORS.pending
              return (
                <CircleMarker
                  key={c._id || c.id}
                  center={coords}
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
                        {t('complaintMap.dossierLabel', { id: String(c._id || c.id || '').slice(-6).toUpperCase() })}
                      </span>
                      {(() => {
                        const pTier = getPriorityTier(c)
                        if (pTier.score === null) return null
                        return (
                          <div className={`text-[10px] font-bold tracking-wider uppercase mb-1 px-1.5 py-0.5 border ${pTier.badgeClass}`}>
                            {t('complaintMap.scoreLabel', { tier: pTier.label, score: pTier.displayScore })}
                          </div>
                        )
                      })()}
                      <h4 className="font-serif font-bold text-neutral-900 text-sm mb-1 leading-snug">
                        {c.title || c.complaintTitle || t('complaintMap.civicIncident')}
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
                                title: c.title || c.complaintTitle || t('complaintMap.civicIncident'),
                                category: c.category || c.issueType
                              })
                            }}
                            className="mb-2 w-full py-1 bg-neutral-900 text-white hover:bg-neutral-800 border border-black font-mono text-[10px] uppercase font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                          >
                            <HiSparkles className="w-3 h-3 text-neutral-300" />
                            {t('complaintMap.explainAi')}
                          </button>
                        )
                      })()}
                      <div className="flex items-center justify-between border-t border-neutral-200 pt-2">
                        <span className="uppercase text-[10px] font-bold text-neutral-700">
                          {(c.status || 'pending').replace(/_/g, ' ')}
                        </span>
                        <button
                          type="button"
                          onClick={() => navigate(`/admin/complaints/${c._id || c.id}`)}
                          className="text-neutral-900 font-bold hover:underline text-[11px] flex items-center gap-1"
                        >
                          {t('complaintMap.auditDossier')} <HiArrowRight className="w-3 h-3" />
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
        category={explainModalState.category}
      />
    </div>
  )
}
