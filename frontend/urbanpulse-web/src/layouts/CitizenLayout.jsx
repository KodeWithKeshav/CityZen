import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import {
  HiHome, HiNewspaper, HiPlusCircle, HiMap, HiChartBar,
  HiDocumentReport, HiChat, HiStar, HiLogout, HiMenu, HiX
} from 'react-icons/hi'
import { useState } from 'react'

const navItems = [
  { to: '/citizen/feed',         icon: HiNewspaper,       label: 'Feed' },
  { to: '/citizen/dashboard',    icon: HiHome,            label: 'Dashboard' },
  { to: '/citizen/submit',       icon: HiPlusCircle,      label: 'Report' },
  { to: '/citizen/map',          icon: HiMap,             label: 'Map' },
  { to: '/citizen/reports',      icon: HiDocumentReport,  label: 'My Reports' },

  { to: '/citizen/chatbot',      icon: HiChat,            label: 'AI Chat' },
  { to: '/citizen/feedback',     icon: HiStar,            label: 'Feedback' },
]

export default function CitizenLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleLogout = () => {
    logout()
    toast.success('Logged out successfully')
    navigate('/')
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-20 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed md:static inset-y-0 left-0 z-30
        w-64 bg-white border-r border-gray-200 flex flex-col
        transform transition-transform duration-300
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-100">
          <div className="w-9 h-9 bg-primary-700 rounded-xl flex items-center justify-center text-white text-lg">🏙️</div>
          <div>
            <h1 className="font-bold text-gray-900 text-base leading-none">UrbanPulse</h1>
            <p className="text-xs text-primary-600 font-medium mt-0.5">Citizen Portal</p>
          </div>
        </div>

        {/* User info */}
        <div className="px-4 py-3 mx-3 my-3 bg-primary-50 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary-200 rounded-full flex items-center justify-center font-bold text-primary-800 text-sm">
              {user?.fullName?.charAt(0)?.toUpperCase() || 'C'}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-gray-800 text-sm truncate">{user?.fullName || 'Citizen'}</p>
              <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 overflow-y-auto">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 mb-2">Navigation</p>
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `sidebar-link mb-1 ${isActive ? 'active' : ''}`
              }
              onClick={() => setSidebarOpen(false)}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div className="p-3 border-t border-gray-100">
          <button
            onClick={handleLogout}
            className="sidebar-link w-full text-red-500 hover:text-red-600 hover:bg-red-50"
          >
            <HiLogout className="w-5 h-5" />
            <span className="text-sm">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar (mobile) */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200">
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg hover:bg-gray-100">
            <HiMenu className="w-6 h-6 text-gray-700" />
          </button>
          <span className="font-bold text-primary-700">UrbanPulse</span>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

