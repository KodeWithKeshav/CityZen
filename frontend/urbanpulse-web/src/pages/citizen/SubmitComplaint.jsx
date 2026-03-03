// Multi-step wizard v2 - adding stepper UI
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { makeApiCall, apiClient } from '../../services/api'
import toast from 'react-hot-toast'
import { HiCheckCircle, HiArrowRight, HiArrowLeft } from 'react-icons/hi'

const ISSUE_TYPES = [
  { value: 'pothole', label: 'Pothole', desc: 'Road damage' },
  { value: 'broken_streetlight', label: 'Streetlight', desc: 'Broken / not working' },
  { value: 'garbage_collection', label: 'Garbage', desc: 'Collection issue' },
  { value: 'sewage_overflow', label: 'Sewage', desc: 'Overflow/blockage' },
  { value: 'water_main_break', label: 'Water', desc: 'Pipe break' },
  { value: 'fire_hazard', label: 'Fire Hazard', desc: 'Dangerous situation' },
  { value: 'others', label: 'Other', desc: 'Other issues' },
]

const STEPS = ['Issue Type', 'Details', 'Location', 'Review']

export default function SubmitComplaint() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ issueType: '', title: '', description: '', priority: 'medium', location: { latitude: '', longitude: '', address: '' } })
  const setField = (f, v) => setForm(p => ({ ...p, [f]: v }))
  const canNext = () => { if (step===0) return !!form.issueType; if (step===1) return form.title.length>=3; if (step===2) return !!(form.location.latitude && form.location.longitude); return true }
  const handleSubmit = async () => { setLoading(true); try { await makeApiCall(apiClient.complaints.submit, { method: 'POST', body: JSON.stringify(form) }); toast.success('Submitted!'); navigate('/citizen/feed') } catch(e) { toast.error(e.message) } finally { setLoading(false) } }
  return (
    <div className='p-4 max-w-2xl mx-auto'>
      <h1 className='text-xl font-bold mb-2'>Submit a Report</h1>
      <div className='flex items-center gap-2 mb-8'>{STEPS.map((s,i)=><div key={s} className='flex items-center gap-2 flex-1'><div className={'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ' + (i<step?'bg-primary-700 text-white':i===step?'bg-primary-100 text-primary-700 ring-2 ring-primary-700':'bg-gray-100 text-gray-400')}>{i<step?<HiCheckCircle className='w-5 h-5'/>:i+1}</div></div>)}</div>
      <div className='card min-h-64'>{step===0 && <div className='grid grid-cols-2 gap-3'>{ISSUE_TYPES.map(t=><button key={t.value} onClick={()=>setField('issueType',t.value)} className={'p-3 rounded-xl border-2 text-left '+(form.issueType===t.value?'border-primary-600 bg-primary-50':'border-gray-200')}><div className='font-medium'>{t.label}</div><div className='text-xs text-gray-500'>{t.desc}</div></button>)}</div>}</div>
      <div className='flex gap-3 mt-5'>{step>0 && <button onClick={()=>setStep(s=>s-1)} className='btn-secondary'><HiArrowLeft /> Back</button>}{step<3?<button onClick={()=>setStep(s=>s+1)} disabled={!canNext()} className='btn-primary ml-auto'>Next <HiArrowRight /></button>:<button onClick={handleSubmit} disabled={loading} className='btn-primary ml-auto'>Submit</button>}</div>
    </div>
  )
}