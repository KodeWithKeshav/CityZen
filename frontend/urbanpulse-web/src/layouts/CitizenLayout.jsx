import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { useTranslatedText } from '../context/TranslationContext'
import LanguageSwitcher from '../components/LanguageSwitcher'
import {
  HiViewGrid, HiNewspaper, HiMap, HiDocumentReport,
  HiChat, HiStar, HiChartBar, HiLogout, HiSearch,
  HiBell, HiQuestionMarkCircle, HiPlusCircle, HiMenu, HiX
} from 'react-icons/hi'

export default function CitizenLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { t } = useTranslation('common')
  const [searchQuery, setSearchQuery] = useState('')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)

  const navLinks = [
    { to: '/citizen/dashboard', label: t('nav.citizen.dashboard'), icon: HiViewGrid },
    { to: '/citizen/feed', label: t('nav.citizen.feed'), icon: HiNewspaper },
    { to: '/citizen/map', label: t('nav.citizen.map'), icon: HiMap },
    { to: '/citizen/reports', label: t('nav.citizen.reports'), icon: HiDocumentReport },
    { to: '/citizen/chatbot', label: t('nav.citizen.chatbot'), icon: HiChat },
    { to: '/citizen/feedback', label: t('nav.citizen.feedback'), icon: HiStar },
    { to: '/citizen/transparency', label: t('nav.citizen.transparency'), icon: HiChartBar },
  ]

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    const trimmed = searchQuery.trim()
    navigate(trimmed ? `/citizen/feed?q=${encodeURIComponent(trimmed)}` : '/citizen/feed')
    setMobileNavOpen(false)
  }

  const rawName = user?.fullName || user?.full_name || user?.name || ''
  const translatedName = useTranslatedText(rawName)
  const displayName = translatedName || rawName || user?.email || 'Citizen'
  const userInitial = (typeof Intl !== 'undefined' && Intl.Segmenter)
    ? (new Intl.Segmenter().segment(displayName.trim() || 'C')[Symbol.iterator]().next().value?.segment || 'C').toUpperCase()
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
            {t('nav.citizen.portalLabel')}
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
      <div className="px-3 pb-3 sm:hidden">
        <LanguageSwitcher className="w-full" />
      </div>

      {/* Submit Report CTA */}
      <div className="px-3 pb-3">
        <button
          type="button"
          onClick={() => { setMobileNavOpen(false); navigate('/citizen/submit') }}
          className="btn-primary w-full text-xs py-2.5"
        >
          <HiPlusCircle className="w-4 h-4" />
          {t('nav.citizen.newReport')}
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
          <span>{t('nav.citizen.signOut')}</span>
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
              onClick={() => { setShowNotifications(false); setMobileNavOpen(true) }}
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
              onClick={() => setShowNotifications((prev) => !prev)}
              aria-label="Notifications"
              className={`w-8 h-8 flex items-center justify-center border border-black/10 hover:bg-surface-container-high transition-colors ${showNotifications ? 'bg-surface-container-high border-black' : ''}`}
            >
              <HiBell className="w-4 h-4 text-on-surface" />
            </button>
            <button
              type="button"
              onClick={() => { setShowNotifications(false); navigate('/citizen/chatbot') }}
              aria-label={t('nav.citizen.chatbot')}
              title={t('nav.citizen.chatbot')}
              className="w-8 h-8 flex items-center justify-center border border-black/10 hover:bg-surface-container-high transition-colors"
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

          {showNotifications && (
            <div className="absolute right-3 md:right-6 top-14 mt-1 w-[min(18rem,calc(100vw-1.5rem))] bg-white border border-black z-40 p-4 text-xs">
              <div className="flex items-center justify-between border-b border-black/10 pb-2 mb-3">
                <span className="text-label-sm text-on-surface">{t('popovers.updatesTitle')}</span>
                <button
                  type="button"
                  onClick={() => setShowNotifications(false)}
                  aria-label={t('popovers.close')}
                  className="text-primary-400 hover:text-on-surface"
                >
                  <HiX className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-on-surface-variant mb-3">
                {t('popovers.updatesDesc')}
              </p>
              <button
                type="button"
                onClick={() => { setShowNotifications(false); navigate('/citizen/reports') }}
                className="btn-secondary w-full py-1.5 text-xs"
              >
                {t('nav.citizen.reports')}
              </button>
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
