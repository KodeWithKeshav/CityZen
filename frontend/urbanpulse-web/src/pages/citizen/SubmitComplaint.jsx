// Multi-step wizard v3 - geolocation + privacy levels
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { makeApiCall, apiClient } from '../../services/api'
import toast from 'react-hot-toast'
import { HiCheckCircle, HiArrowRight, HiArrowLeft } from 'react-icons/hi'

const ISSUE_TYPES = [
  { value: 'pothole', label: 'Pothole', desc: 'Road damage' }, { value: 'broken_streetlight', label: 'Streetlight', desc: 'Broken' },
  { value: 'garbage_collection', label: 'Garbage', desc: 'Collection issue' }, { value: 'sewage_overflow', label: 'Sewage', desc: 'Overflow' },
  { value: 'water_main_break', label: 'Water', desc: 'Pipe break' }, { value: 'fire_hazard', label: 'Fire Hazard', desc: 'Danger' },
  { value: 'electrical_danger', label: 'Electrical', desc: 'Wires' }, { value: 'traffic_signal', label: 'Traffic Signal', desc: 'Not working' },
  { value: 'road_damage', label: 'Road Damage', desc: 'General' }, { value: 'illegal_parking', label: 'Parking', desc: 'Obstruction' },
  { value: 'noise_complaint', label: 'Noise', desc: 'Noise pollution' }, { value: 'structural_damage', label: 'Structure', desc: 'Building' },
  { value: 'others', label: 'Other', desc: 'Other issues' },
]
const PRIVACY_LEVELS = [{ value: 'exact', label: 'Exact', desc: '5-10m' }, { value: 'street', label: 'Street-Level', desc: '25m' }, { value: 'area', label: 'Neighborhood', desc: '150m' }]
const STEPS = ['Issue Type', 'Details', 'Location', 'Review']

export default function SubmitComplaint() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [locLoading, setLocLoading] = useState(false)
  const [form, setForm] = useState({ issueType: '', title: '', description: '', priority: 'medium', location: { latitude: '', longitude: '', address: '', privacyLevel: 'street' }, imageUrl: '' })
  const setField = (f, v) => setForm(p => ({ ...p, [f]: v }))
  const setLocField = (f, v) => setForm(p => ({ ...p, location: { ...p.location, [f]: v } }))
  const detectLocation = () => { if (!navigator.geolocation) { toast.error('Not supported'); return } setLocLoading(true); navigator.geolocation.getCurrentPosition(async pos => { const { latitude, longitude } = pos.coords; setLocField('latitude', latitude); setLocField('longitude', longitude); try { const r = await fetch('https://nominatim.openstreetmap.org/reverse?lat='+latitude+'&lon='+longitude+'&format=json'); const d = await r.json(); setLocField('address', d.display_name || latitude+', '+longitude) } catch { setLocField('address', latitude+', '+longitude) } setLocLoading(false); toast.success('Location detected!') }, () => { toast.error('Denied'); setLocLoading(false) }, { enableHighAccuracy: true }) }
  const canNext = () => { if (step===0) return !!form.issueType; if (step===1) return form.title.length>=3 && form.description.length>=10; if (step===2) return !!(form.location.latitude && form.location.longitude); return true }
  const handleSubmit = async () => { setLoading(true); try { await makeApiCall(apiClient.complaints.submit, { method: 'POST', body: JSON.stringify({ title: form.title, description: form.description, category: form.issueType, locationData: { latitude: parseFloat(form.location.latitude), longitude: parseFloat(form.location.longitude), address: form.location.address, privacyLevel: form.location.privacyLevel } }) }); toast.success('Submitted!'); navigate('/citizen/feed') } catch(e) { toast.error(e.message) } finally { setLoading(false) } }
  return <div className='p-4 max-w-2xl mx-auto fade-in'><h1 className='text-xl font-bold'>Submit a Report</h1><p className='text-sm text-gray-500 mb-6'>Help improve your city</p><div className='flex items-center gap-2 mb-8'>{STEPS.map((s,i)=><div key={s} className='flex items-center gap-2 flex-1'><div className={'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold '+(i<step?'bg-primary-700 text-white':i===step?'bg-primary-100 text-primary-700 ring-2 ring-primary-700':'bg-gray-100 text-gray-400')}>{i<step?<HiCheckCircle className='w-5 h-5'/>:i+1}</div></div>)}</div><div className='card min-h-64'>{step===0 && <div className='grid grid-cols-2 sm:grid-cols-3 gap-3'>{ISSUE_TYPES.map(t=><button key={t.value} onClick={()=>setField('issueType',t.value)} className={'p-3 rounded-xl border-2 text-left text-sm '+(form.issueType===t.value?'border-primary-600 bg-primary-50':'border-gray-200')}><div className='font-medium'>{t.label}</div><div className='text-xs text-gray-500'>{t.desc}</div></button>)}</div>}{step===2 && <div className='space-y-4'><h2 className='font-bold'>Set location</h2><div className='grid grid-cols-3 gap-2'>{PRIVACY_LEVELS.map(pl=><button key={pl.value} onClick={()=>setLocField('privacyLevel',pl.value)} className={'p-2.5 rounded-xl border-2 text-sm text-center '+(form.location.privacyLevel===pl.value?'border-primary-600 bg-primary-50':'border-gray-200')}><div className='font-medium text-xs'>{pl.label}</div></button>)}</div><button onClick={detectLocation} disabled={locLoading} className='btn-primary w-full'>Detect My Location</button></div>}</div><div className='flex gap-3 mt-5'>{step>0 && <button onClick={()=>setStep(s=>s-1)} className='btn-secondary flex items-center gap-2'><HiArrowLeft className='w-4 h-4'/> Back</button>}{step<3?<button onClick={()=>setStep(s=>s+1)} disabled={!canNext()} className='btn-primary flex items-center gap-2 ml-auto'>Next <HiArrowRight className='w-4 h-4'/></button>:<button onClick={handleSubmit} disabled={loading} className='btn-primary ml-auto'>Submit Report</button>}</div></div>
}