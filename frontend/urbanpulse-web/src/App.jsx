import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Welcome from './pages/auth/Welcome'
import Login from './pages/auth/Login'
import CitizenSignup from './pages/auth/CitizenSignup'
import AdminSignup from './pages/auth/AdminSignup'
import CitizenLayout from './layouts/CitizenLayout'
import AdminLayout from './layouts/AdminLayout'

const CitizenRoute = ({ children }) => {
  const { user, loading } = useAuth()
  if (loading) return <div className='flex items-center justify-center h-screen'><div className='animate-spin rounded-full h-10 w-10 border-b-2 border-primary-700' /></div>
  if (!user || user.userType !== 'citizen') return <Navigate to='/login' replace />
  return children
}

const AdminRoute = ({ children }) => {
  const { user, loading } = useAuth()
  if (loading) return <div className='flex items-center justify-center h-screen'><div className='animate-spin rounded-full h-10 w-10 border-b-2 border-admin-700' /></div>
  if (!user || user.userType !== 'admin') return <Navigate to='/login' replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path='/' element={<Welcome />} />
      <Route path='/login' element={<Login />} />
      <Route path='/citizen/signup' element={<CitizenSignup />} />
      <Route path='/admin/signup' element={<AdminSignup />} />
      <Route path='/citizen' element={<CitizenRoute><CitizenLayout /></CitizenRoute>} />
      <Route path='/admin' element={<AdminRoute><AdminLayout /></AdminRoute>} />
      <Route path='*' element={<Navigate to='/' replace />} />
    </Routes>
  )
}