import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext'

import Welcome from './pages/auth/Welcome'
import Login from './pages/auth/Login'
import CitizenSignup from './pages/auth/CitizenSignup'
import AdminSignup from './pages/auth/AdminSignup'

import CitizenLayout from './layouts/CitizenLayout'
import CitizenDashboard from './pages/citizen/CitizenDashboard'
import ComplaintFeed from './pages/citizen/ComplaintFeed'
import SubmitComplaint from './pages/citizen/SubmitComplaint'
import ComplaintMap from './pages/citizen/ComplaintMap'
import PersonalReports from './pages/citizen/PersonalReports'
import ComplaintDetail from './pages/citizen/ComplaintDetail'
import Chatbot from './pages/citizen/Chatbot'
import FeedbackScreen from './pages/citizen/FeedbackScreen'
import Transparency from './pages/citizen/Transparency'

import AdminLayout from './layouts/AdminLayout'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminComplaints from './pages/admin/AdminComplaints'
import AdminComplaintDetail from './pages/admin/AdminComplaintDetail'
import PriorityQueue from './pages/admin/PriorityQueue'
import AdminComplaintMap from './pages/admin/AdminComplaintMap'
import CitizenManagement from './pages/admin/CitizenManagement'
import CitizenDetails from './pages/admin/CitizenDetails'

const getUserType = (user) => user?.userType || user?.role

function FullScreenLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-700" />
    </div>
  )
}

function PublicOnly() {
  const { user, loading } = useAuth()

  if (loading) return <FullScreenLoader />
  if (!user) return <Outlet />

  return getUserType(user) === 'admin'
    ? <Navigate to="/admin/dashboard" replace />
    : <Navigate to="/citizen/feed" replace />
}

function RequireAuth({ allowedType }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <FullScreenLoader />
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />

  const userType = getUserType(user)
  if (allowedType && userType !== allowedType) {
    return userType === 'admin'
      ? <Navigate to="/admin/dashboard" replace />
      : <Navigate to="/citizen/feed" replace />
  }

  return <Outlet />
}

export default function App() {
  return (
    <Routes>
      <Route element={<PublicOnly />}>
        <Route path="/" element={<Welcome />} />
        <Route path="/login" element={<Login />} />
        <Route path="/citizen/signup" element={<CitizenSignup />} />
        <Route path="/admin/signup" element={<AdminSignup />} />
      </Route>

      <Route element={<RequireAuth allowedType="citizen" />}>
        <Route path="/citizen" element={<CitizenLayout />}>
          <Route index element={<Navigate to="feed" replace />} />
          <Route path="feed" element={<ComplaintFeed />} />
          <Route path="dashboard" element={<CitizenDashboard />} />
          <Route path="submit" element={<SubmitComplaint />} />
          <Route path="map" element={<ComplaintMap />} />
          <Route path="reports" element={<PersonalReports />} />
          <Route path="complaint/:id" element={<ComplaintDetail />} />
          <Route path="chatbot" element={<Chatbot />} />
          <Route path="feedback" element={<FeedbackScreen />} />
          <Route path="transparency" element={<Transparency />} />
        </Route>
      </Route>

      <Route element={<RequireAuth allowedType="admin" />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="complaints" element={<AdminComplaints />} />
          <Route path="complaints/:id" element={<AdminComplaintDetail />} />
          <Route path="priority" element={<PriorityQueue />} />
          <Route path="map" element={<AdminComplaintMap />} />
          <Route path="citizens" element={<CitizenManagement />} />
          <Route path="citizens/:id" element={<CitizenDetails />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}