import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { useTranslatedText } from '../context/TranslationContext'
import LanguageSwitcher from '../components/LanguageSwitcher'
import {
  HiViewGrid, HiDocumentText, HiExclamationCircle, HiMap,
  HiUsers, HiCog, HiLogout, HiSearch, HiOfficeBuilding,
  HiBell, HiQuestionMarkCircle, HiMenu, HiX
} from 'react-icons/hi'

export default function AdminLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { t } = useTranslation('common')
  const [searchQuery, setSearchQuery] = useState('')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [activePopover, setActivePopover] = useState(null) // 'notifications' | 'help' | null

  const navLinks = [
    { to: '/admin/dashboard', label: t('nav.admin.dashboard'), icon: HiViewGrid },
    { to: '/admin/complaints', label: t('nav.admin.complaints'), icon: HiDocumentText },
    { to: '/admin/priority', label: t('nav.admin.priority'), icon: HiExclamationCircle },
    { to: '/admin/map', label: t('nav.admin.map'), icon: HiMap },
    { to: '/admin/citizens', label: t('nav.admin.citizens'), icon: HiUsers },
    { to: '/admin/workforce', label: t('nav.admin.workforce'), icon: HiOfficeBuilding },
  ]

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    const trimmed = searchQuery.trim()
    navigate(trimmed ? `/admin/complaints?q=${encodeURIComponent(trimmed)}` : '/admin/complaints')
    setMobileNavOpen(false)
  }

  const togglePopover = (name) => {
    setActivePopover((prev) => (prev === name ? null : name))
  }

  const rawName = user?.fullName || user?.full_name || user?.name || ''
  const translatedName = useTranslatedText(rawName)
  const displayName = translatedName || rawName || user?.email || 'Admin'
  const userInitial = (typeof Intl !== 'undefined' && Intl.Segmenter)
    ? (new Intl.Segmenter().segment(displayName.trim() || 'A')[Symbol.iterator]().next().value?.segment || 'A').toUpperCase()
    : displayName.charAt(0).toUpperCase()

  const sidebarContent = (
    <>
      {/* Brand */}
      <div className="px-5 pt-6 pb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2.5 mb-2">
            <img src="/logo.png" alt="CityZen" className="w-8 h-8 object-contain border border-black/10" />
            <h1 className="font-epilogue text-lg font-bold tracking-tight text-on-surface leading-none">
              CITYZEN
            </h1>
          </div>
          <p className="text-label-sm text-primary-400">
            {t('nav.admin.consoleLabel')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setMobileNavOpen(false)}
          aria-label="Close navigation"
          className="md:hidden p-1 text-primary-400 hover:text-on-surface"
        >
          <HiX className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        {navLinks.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={() => setMobileNavOpen(false)}
            className={({ isActive }) =>
              `sidebar-link ${isActive ? 'active' : ''}`
            }
          >
            <Icon className="w-[18px] h-[18px] flex-shrink-0" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Mobile Language Switcher */}
      <div className="px-3 pb-2 sm:hidden">
        <LanguageSwitcher className="w-full" />
      </div>

      {/* Settings */}
      <div className="px-3 pb-2">
        <button
          type="button"
          onClick={() => { setMobileNavOpen(false); navigate('/admin/settings') }}
          className="sidebar-link w-full"
        >
          <HiCog className="w-[18px] h-[18px]" />
          <span>{t('nav.admin.settings')}</span>
        </button>
      </div>

      {/* Logout */}
      <div className="border-t border-black/10 px-3 py-3">
        <button
          type="button"
          onClick={handleLogout}
          className="sidebar-link w-full text-primary-400 hover:text-civic-error"
        >
          <HiLogout className="w-[18px] h-[18px]" />
          <span>{t('nav.admin.signOut')}</span>
        </button>
      </div>
    </>
  )

  return (
    <div className="flex h-screen h-[100dvh] bg-surface-bright overflow-hidden">
      {/* ─── Desktop Sidebar ─── */}
      <aside className="hidden md:flex w-[220px] flex-shrink-0 border-r border-black/10 bg-white flex-col">
        {sidebarContent}
      </aside>

      {/* ─── Mobile Sidebar Drawer ─── */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-black/40"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="relative z-10 w-[260px] max-w-[82vw] bg-white border-r border-black/10 flex flex-col h-full">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* ─── Main Area ─── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top Bar */}
        <header className="h-14 flex-shrink-0 border-b border-black/10 bg-white flex items-center justify-between gap-2 sm:gap-3 px-3 sm:px-4 md:px-6 relative">
          <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
            <button
              type="button"
              onClick={() => { setActivePopover(null); setMobileNavOpen(true) }}
              aria-label="Open navigation"
              className="md:hidden w-8 h-8 flex items-center justify-center border border-black/10 hover:bg-surface-container-high transition-colors flex-shrink-0"
            >
              <HiMenu className="w-4 h-4 text-on-surface" />
            </button>

            {/* Search */}
            <form onSubmit={handleSearchSubmit} className="relative w-full max-w-xs min-w-0">
              <HiSearch className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('nav.search')}
                aria-label={t('nav.search')}
                className="w-full border border-black/10 pl-8 sm:pl-10 pr-2 sm:pr-4 py-1.5 sm:py-2 text-xs sm:text-sm text-on-surface placeholder:text-primary-300 focus:outline-none focus:border-black bg-surface-container-low"
              />
            </form>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-1.5 sm:gap-4 flex-shrink-0">
            <LanguageSwitcher className="hidden sm:block" />
            <button
              type="button"
              onClick={() => togglePopover('notifications')}
              aria-label="Notifications"
              className={`w-8 h-8 flex items-center justify-center border border-black/10 hover:bg-surface-container-high transition-colors ${activePopover === 'notifications' ? 'bg-surface-container-high border-black' : ''}`}
            >
              <HiBell className="w-4 h-4 text-on-surface" />
            </button>
            <button
              type="button"
              onClick={() => togglePopover('help')}
              aria-label="Help"
              className={`w-8 h-8 flex items-center justify-center border border-black/10 hover:bg-surface-container-high transition-colors ${activePopover === 'help' ? 'bg-surface-container-high border-black' : ''}`}
            >
              <HiQuestionMarkCircle className="w-4 h-4 text-on-surface" />
            </button>
            <div
              title={displayName}
              className="w-8 h-8 bg-primary-800 flex items-center justify-center text-white text-xs font-bold border border-black/10"
            >
              {userInitial}
            </div>
          </div>

          {/* Lightweight Header Popovers */}
          {activePopover && (
            <div className="absolute right-3 md:right-6 top-14 mt-1 w-[min(18rem,calc(100vw-1.5rem))] bg-white border border-black z-40 p-4 text-xs">
              <div className="flex items-center justify-between border-b border-black/10 pb-2 mb-3">
                <span className="text-label-sm text-on-surface">
                  {activePopover === 'notifications' && t('popovers.notificationsTitle')}
                  {activePopover === 'help' && t('popovers.helpTitle')}
                </span>
                <button
                  type="button"
                  onClick={() => setActivePopover(null)}
                  aria-label={t('popovers.close')}
                  className="text-primary-400 hover:text-on-surface"
                >
                  <HiX className="w-3.5 h-3.5" />
                </button>
              </div>

              {activePopover === 'notifications' && (
                <div className="space-y-2 text-on-surface-variant">
                  <p>{t('popovers.notificationsDesc')}</p>
                  <button
                    type="button"
                    onClick={() => { setActivePopover(null); navigate('/admin/priority') }}
                    className="btn-secondary w-full py-1.5 text-xs"
                  >
                    {t('nav.admin.priority')}
                  </button>
                </div>
              )}

              {activePopover === 'help' && (
                <div className="space-y-1.5 text-on-surface-variant leading-relaxed">
                  <p><strong className="text-on-surface">{t('nav.admin.priority')}:</strong> {t('popovers.helpPriorityDesc')}</p>
                  <p><strong className="text-on-surface">{t('nav.admin.complaints')}:</strong> {t('popovers.helpComplaintsDesc')}</p>
                  <p><strong className="text-on-surface">{t('nav.admin.map')}:</strong> {t('popovers.helpMapDesc')}</p>
                </div>
              )}

            </div>
          )}
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
