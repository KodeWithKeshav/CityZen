// AdminLayout - Sidebar navigation for administrative panel
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import {
  HiViewGrid, HiDocumentText, HiMap, HiSortDescending,
  HiUsers, HiLogout, HiMenu
} from 'react-icons/hi'
import { useState } from 'react'

const navItems = [
  { to: '/admin/dashboard',   icon: HiViewGrid,       label: 'Dashboard' },
  { to: '/admin/complaints',  icon: HiDocumentText,   label: 'Complaints' },
  { to: '/admin/priority',    icon: HiSortDescending, label: 'Priority Queue' },
  { to: '/admin/map',         icon: HiMap,            label: 'Complaint Map' },
  { to: '/admin/citizens',    icon: HiUsers,          label: 'Citizens' },
]

export default function AdminLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleLogout = () => {
    logout()
    toast.success('Logged out')
    navigate('/')
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-20 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`
        fixed md:static inset-y-0 left-0 z-30
        w-64 bg-white border-r border-gray-200 flex flex-col
        transform transition-transform duration-300
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-100">
          <div className="w-9 h-9 bg-admin-700 rounded-xl flex items-center justify-center text-white text-sm font-bold">AP</div>
          <div>
            <h1 className="font-bold text-gray-900 text-base leading-none">UrbanPulse</h1>
            <p className="text-xs text-admin-600 font-medium mt-0.5">Admin Panel</p>
          </div>
        </div>

        <div className="px-4 py-3 mx-3 my-3 bg-blue-50 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-admin-200 rounded-full flex items-center justify-center font-bold text-admin-800 text-sm">
              {user?.fullName?.charAt(0)?.toUpperCase() || 'A'}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-gray-800 text-sm truncate">{user?.fullName || 'Admin'}</p>
              <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 overflow-y-auto">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 mb-2">Navigation</p>
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `sidebar-link mb-1 ${isActive ? 'bg-blue-50 text-admin-700 font-semibold' : ''}`
              }
              onClick={() => setSidebarOpen(false)}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{label}</span>
            </NavLink>
          ))}
        </nav>

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

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="md:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200">
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg hover:bg-gray-100">
            <HiMenu className="w-6 h-6 text-gray-700" />
          </button>
          <span className="font-bold text-admin-700">UrbanPulse Admin</span>
        </header>
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

