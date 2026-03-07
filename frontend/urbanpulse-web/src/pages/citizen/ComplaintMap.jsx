// v2 - heatmap mode + pin mode toggle
import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Popup, CircleMarker, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet.heat'
import { makeApiCall, apiClient } from '../../services/api'
import toast from 'react-hot-toast'
import 'leaflet/dist/leaflet.css'

const STATUS_COLORS = { pending: '#f59e0b', resolved: '#22c55e', in_progress: '#3b82f6', rejected: '#ef4444' }

function HeatmapLayer({ points }) {
  const map = useMap()
  useEffect(() => { if (!map || !points.length) return; const data = points.map(p => [p.lat||p.latitude, p.lng||p.longitude, 1]); const heat = L.heatLayer(data, { radius: 25, blur: 15 }).addTo(map); return () => map.removeLayer(heat) }, [map, points])
  return null
}

export default function ComplaintMap() {
  const [data, setData] = useState({ points: [], statistics: null })
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState('heatmap')
  const navigate = useNavigate()
  useEffect(() => { makeApiCall(apiClient.heatMap.data).then(r => { if (r.success && r.data) setData(r.data) }).catch(() => toast.error('Failed')).finally(() => setLoading(false)) }, [])
  const mapped = useMemo(() => (data.points || []).filter(c => (c.lat||c.latitude) && (c.lng||c.longitude)), [data.points])
  const center = mapped.length > 0 ? [mapped[0].lat||mapped[0].latitude, mapped[0].lng||mapped[0].longitude] : [20.5937, 78.9629]
  if (loading) return <div className='flex justify-center p-10'><div className='animate-spin rounded-full h-10 w-10 border-b-2 border-primary-700' /></div>
  return (
    <div className='flex flex-col h-full'>
      <div className='p-4 bg-white border-b z-10'><h1 className='text-xl font-bold'>Spatial Heatmap Analytics</h1><p className='text-sm text-gray-500'>{mapped.length} reports</p>
      <div className='flex bg-gray-100 p-1 rounded-full mt-3'><button onClick={()=>setViewMode('heatmap')} className={'px-4 py-1.5 rounded-full text-xs font-bold '+(viewMode==='heatmap'?'bg-primary-600 text-white':'text-gray-600')}>Heatmap</button><button onClick={()=>setViewMode('pins')} className={'px-4 py-1.5 rounded-full text-xs font-bold '+(viewMode==='pins'?'bg-primary-600 text-white':'text-gray-600')}>Pins</button></div></div>
      <div className='flex-1'><MapContainer center={center} zoom={mapped.length>0?14:5} style={{height:'100%',width:'100%'}}><TileLayer url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png' />{viewMode==='heatmap' && <HeatmapLayer points={mapped} />}{viewMode==='pins' && mapped.map(c => { const lat=c.lat||c.latitude; const lng=c.lng||c.longitude; const color=STATUS_COLORS[c.status]||'#f59e0b'; return <CircleMarker key={c.id} center={[lat,lng]} radius={8} fillColor={color} color={color} fillOpacity={0.8}><Popup><b>{c.title}</b><br/><button onClick={()=>navigate('/citizen/complaint/'+c.id)} className='text-xs text-primary-700 font-bold'>Details</button></Popup></CircleMarker> })}</MapContainer></div>
    </div>
  )
}