import { useState, useEffect } from 'react'
import { makeApiCall, apiClient } from '../../services/api'
import toast from 'react-hot-toast'

export default function PriorityQueue() {
  const [queue, setQueue] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => { makeApiCall(apiClient.admin.priorityQueue).then(r => { if (r.success) setQueue(r.data || []) }).catch(() => toast.error('Failed')).finally(() => setLoading(false)) }, [])
  if (loading) return <div className='flex justify-center p-10'><div className='animate-spin rounded-full h-10 w-10 border-b-2 border-primary-700' /></div>
  return <div className='p-6'><h1 className='text-2xl font-bold mb-4'>Priority Queue</h1>{queue.map(c => <div key={c.id} className='card mb-3 border-l-4 border-red-500'><h3 className='font-bold'>{c.title}</h3><span className='text-xs font-bold text-red-600'>Priority: {c.priorityScore}</span></div>)}</div>
}