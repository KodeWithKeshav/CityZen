import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { makeApiCall, apiClient } from '../../services/api'
import toast from 'react-hot-toast'

const ISSUE_TYPES = [
  { value: 'pothole', label: 'Pothole' }, { value: 'broken_streetlight', label: 'Streetlight' },
  { value: 'garbage_collection', label: 'Garbage' }, { value: 'sewage_overflow', label: 'Sewage' },
  { value: 'water_main_break', label: 'Water' }, { value: 'others', label: 'Other' },
]

export default function SubmitComplaint() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ issueType: '', title: '', description: '', priority: 'medium' })
  const [loading, setLoading] = useState(false)
  const setField = (f, v) => setForm(p => ({ ...p, [f]: v }))

  const handleSubmit = async () => {
    setLoading(true)
    try {
      await makeApiCall(apiClient.complaints.submit, { method: 'POST', body: JSON.stringify(form) })
      toast.success('Submitted!'); navigate('/citizen/feed')
    } catch (e) { toast.error(e.message) } finally { setLoading(false) }
  }

  return (
    <div className='p-4 max-w-2xl mx-auto'>
      <h1 className='text-xl font-bold mb-4'>Submit a Report</h1>
      <select value={form.issueType} onChange={e => setField('issueType', e.target.value)} className='input mb-3'>
        <option value=''>Select issue type</option>
        {ISSUE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
      </select>
      <input value={form.title} onChange={e => setField('title', e.target.value)} placeholder='Title' className='input mb-3' />
      <textarea value={form.description} onChange={e => setField('description', e.target.value)} placeholder='Description' className='input mb-3 h-28' />
      <button onClick={handleSubmit} disabled={loading} className='btn-primary w-full'>{loading ? 'Submitting...' : 'Submit'}</button>
    </div>
  )
}