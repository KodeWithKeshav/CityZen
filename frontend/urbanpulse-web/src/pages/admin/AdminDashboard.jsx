import { useState, useEffect } from 'react'
import { makeApiCall, apiClient } from '../../services/api'
import toast from 'react-hot-toast'

export default function AdminDashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => { makeApiCall(apiClient.admin.dashboard).then(r => { if (r.success) setStats(r.data) }).catch(() => toast.error('Failed to load')).finally(() => setLoading(false)) }, [])
  if (loading) return <div className='flex justify-center p-10'><div className='animate-spin rounded-full h-10 w-10 border-b-2 border-primary-700' /></div>
  return (
    <div className='p-6'>
      <h1 className='text-2xl font-bold mb-6'>Admin Dashboard</h1>
      <div className='grid grid-cols-3 gap-4'>
        <div className='card'><p className='text-sm text-gray-500'>Total Complaints</p><p className='text-3xl font-bold'>{stats?.totalComplaints || 0}</p></div>
        <div className='card'><p className='text-sm text-gray-500'>Pending</p><p className='text-3xl font-bold text-amber-600'>{stats?.pendingComplaints || 0}</p></div>
        <div className='card'><p className='text-sm text-gray-500'>Resolved</p><p className='text-3xl font-bold text-green-600'>{stats?.resolvedComplaints || 0}</p></div>
      </div>
    </div>
  )
}