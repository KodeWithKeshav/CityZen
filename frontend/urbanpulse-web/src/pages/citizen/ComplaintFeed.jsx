import { useState, useEffect } from 'react'
import { makeApiCall, apiClient } from '../../services/api'
import toast from 'react-hot-toast'

export default function ComplaintFeed() {
  const [complaints, setComplaints] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => { makeApiCall(apiClient.complaints.all).then(r => { if (r.success) setComplaints(r.data || []) }).catch(() => toast.error('Failed to load feed')).finally(() => setLoading(false)) }, [])
  if (loading) return <div className='flex justify-center p-10'><div className='animate-spin rounded-full h-10 w-10 border-b-2 border-primary-700' /></div>
  return (
    <div className='p-4'>
      <h1 className='text-xl font-bold mb-4'>Complaint Feed</h1>
      <p className='text-gray-500 text-sm mb-6'>Browse civic issues reported in your area</p>
      {complaints.length === 0 ? <p className='text-gray-400'>No complaints yet.</p> : complaints.map(c => (<div key={c.id} className='card mb-3'><h3 className='font-bold'>{c.title}</h3><p className='text-sm text-gray-500'>{c.category}</p></div>))}
    </div>
  )
}