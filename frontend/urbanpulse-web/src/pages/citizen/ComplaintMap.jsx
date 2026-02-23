import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import { makeApiCall, apiClient } from '../../services/api'
import toast from 'react-hot-toast'
import 'leaflet/dist/leaflet.css'

export default function ComplaintMap() {
  const [points, setPoints] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => { makeApiCall(apiClient.heatMap.data).then(r => { if (r.success && r.data) setPoints(r.data.points || []) }).catch(() => toast.error('Failed to load')).finally(() => setLoading(false)) }, [])
  const center = points.length > 0 ? [points[0].lat, points[0].lng] : [20.5937, 78.9629]
  if (loading) return <div className='flex justify-center p-10'><div className='animate-spin rounded-full h-10 w-10 border-b-2 border-primary-700' /></div>
  return (
    <div className='h-full'>
      <div className='p-4 bg-white border-b'><h1 className='text-xl font-bold'>Complaint Map</h1><p className='text-sm text-gray-500'>{points.length} reports</p></div>
      <MapContainer center={center} zoom={points.length > 0 ? 14 : 5} style={{ height: 'calc(100% - 80px)', width: '100%' }}>
        <TileLayer url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png' />
        {points.map(c => <CircleMarker key={c.id} center={[c.lat || c.latitude, c.lng || c.longitude]} radius={8} fillColor='#3b82f6' color='#3b82f6' fillOpacity={0.7}><Popup><b>{c.title}</b></Popup></CircleMarker>)}
      </MapContainer>
    </div>
  )
}