import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { makeApiCall, apiClient } from '../../services/api'
import toast from 'react-hot-toast'

export default function AdminComplaints() {
  const [complaints, setComplaints] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  useEffect(() => { makeApiCall(apiClient.admin.complaints).then(r => { if (r.success) setComplaints(r.data || []) }).catch(() => toast.error('Failed')).finally(() => setLoading(false)) }, [])
  if (loading) return <div className='flex justify-center p-10'><div className='animate-spin rounded-full h-10 w-10 border-b-2 border-primary-700' /></div>
  return <div className='p-6'><h1 className='text-2xl font-bold mb-4'>All Complaints</h1><div className='space-y-3'>{complaints.map(c => <div key={c.id} onClick={() => navigate('/admin/complaints/' + c.id)} className='card cursor-pointer hover:shadow-lg'><h3 className='font-bold'>{c.title}</h3><p className='text-sm text-gray-500'>{c.status}</p></div>)}</div></div>
}