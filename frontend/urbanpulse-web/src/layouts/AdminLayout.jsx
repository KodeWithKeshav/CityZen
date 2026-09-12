import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  HiViewGrid, HiDocumentText, HiExclamationCircle, HiMap,
  HiUsers, HiCog, HiLogout, HiSearch,
  HiBell, HiQuestionMarkCircle
} from 'react-icons/hi'

const navLinks = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: HiViewGrid },
  { to: '/admin/complaints', label: 'All Complaints', icon: HiDocumentText },
  { to: '/admin/priority', label: 'Priority Queue', icon: HiExclamationCircle },
  { to: '/admin/map', label: 'Complaint Map', icon: HiMap },
  { to: '/admin/citizens', label: 'Citizens', icon: HiUsers },
]

export default function AdminLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-surface-bright overflow-hidden">
      {/* ─── Sidebar ─── */}
      <aside className="w-[220px] flex-shrink-0 border-r border-black/10 bg-white flex flex-col">
        {/* Brand */}
        <div className="px-5 pt-6 pb-6">
          <div className="flex items-center gap-2.5 mb-2">
            <img src="/logo.png" alt="CityZen" className="w-8 h-8 object-contain border border-black/10" />
            <h1 className="font-epilogue text-lg font-bold tracking-tight text-on-surface leading-none">
              CITYZEN
            </h1>
          </div>
          <p className="text-label-sm text-primary-400">
            ADMIN CONSOLE
          </p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
          {navLinks.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? 'active' : ''}`
              }
            >
              <Icon className="w-[18px] h-[18px] flex-shrink-0" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Settings */}
        <div className="px-3 pb-2">
          <button className="sidebar-link w-full">
            <HiCog className="w-[18px] h-[18px]" />
            <span>Settings</span>
          </button>
        </div>

        {/* Logout */}
        <div className="border-t border-black/10 px-3 py-3">
          <button
            onClick={handleLogout}
            className="sidebar-link w-full text-primary-400 hover:text-civic-error"
          >
            <HiLogout className="w-[18px] h-[18px]" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* ─── Main Area ─── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="h-14 flex-shrink-0 border-b border-black/10 bg-white flex items-center justify-between px-6">
          {/* Search */}
          <div className="relative w-80">
            <HiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-400" />
            <input
              type="text"
              placeholder="Search..."
              className="w-full border border-black/10 pl-10 pr-4 py-2 text-sm text-on-surface placeholder:text-primary-300 focus:outline-none focus:border-black bg-surface-container-low"
            />
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-4">
            <button className="w-8 h-8 flex items-center justify-center border border-black/10 hover:bg-surface-container-high transition-colors">
              <HiBell className="w-4 h-4 text-on-surface" />
            </button>
            <button className="w-8 h-8 flex items-center justify-center border border-black/10 hover:bg-surface-container-high transition-colors">
              <HiQuestionMarkCircle className="w-4 h-4 text-on-surface" />
            </button>
            <div className="w-8 h-8 bg-primary-800 flex items-center justify-center text-white text-xs font-bold border border-black/10">
              {user?.fullName?.charAt(0)?.toUpperCase() || 'A'}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
