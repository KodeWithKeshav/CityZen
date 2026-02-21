import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { makeApiCall, apiClient } from '../../services/api'
import toast from 'react-hot-toast'

export default function ComplaintDetail() {
  const { id } = useParams()
  const [complaint, setComplaint] = useState(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => { makeApiCall(apiClient.complaints.byId(id)).then(r => setComplaint(r.data)).catch(() => toast.error('Failed to load')).finally(() => setLoading(false)) }, [id])
  if (loading) return <div className='flex justify-center p-10'><div className='animate-spin rounded-full h-10 w-10 border-b-2 border-primary-700' /></div>
  if (!complaint) return <p className='p-4 text-gray-400'>Complaint not found.</p>
  return <div className='p-4'><h1 className='text-xl font-bold'>{complaint.title}</h1><p className='text-gray-500 mt-2'>{complaint.description}</p><span className='inline-block mt-3 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700'>{complaint.status}</span></div>
}