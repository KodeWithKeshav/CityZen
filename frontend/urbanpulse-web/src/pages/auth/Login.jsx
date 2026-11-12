import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext'
import { makeApiCall, apiClient } from '../../services/api'
import LanguageSwitcher from '../../components/LanguageSwitcher'
import toast from 'react-hot-toast'
import { HiMail, HiLockClosed, HiEye, HiEyeOff, HiArrowRight } from 'react-icons/hi'

export default function Login() {
  const { t } = useTranslation('auth')
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const [maintainSession, setMaintainSession] = useState(true)

  const handleChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    const email = form.email.trim()
    if (!email || !form.password) { toast.error(t('login.fillFields')); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error(t('login.invalidEmail', { defaultValue: 'Please enter a valid email address' }))
      return
    }
    setLoading(true)
    try {
      const res = await makeApiCall(apiClient.auth.login, {
        method: 'POST',
        body: JSON.stringify({ email, password: form.password }),
      })
      const token = res?.data?.token ?? res?.token
      const user = res?.data?.user ?? res?.user
      if (res?.success && token && user) {
        login(token, user)
        toast.success(t('login.welcomeBack', { name: user.fullName || user.full_name || user.name || '' }))

        const userType = user.userType || user.user_type || user.role
        if (userType === 'admin') {
          navigate('/admin/dashboard', { replace: true })
        } else {
          navigate('/citizen/feed', { replace: true })
        }
      } else {
        toast.error(res?.message || t('login.loginFailed'))
      }
    } catch (err) {
      toast.error(err.message || t('login.loginFailed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-bright flex">
      {/* ─── Left: Architectural Image Panel ─── */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-black overflow-hidden">
        {/* Grayscale architectural image via CSS gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-black" />
        {/* Grid overlay */}
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }} />
        {/* Brand overlay */}
        <div className="relative z-10 p-12 flex flex-col justify-between h-full">
          <div>
            <div className="w-14 h-14 bg-white p-2 border border-white/20 mb-4 flex items-center justify-center">
              <img src="/logo.png" alt="CityZen" className="w-full h-full object-contain" />
            </div>
            <h1 className="font-epilogue text-5xl font-bold text-white leading-none mb-4">
              CITY<br />ZEN
            </h1>
            <p className="text-label-sm text-white/60 tracking-widest">
              {t('login.portalLabel')}
            </p>
          </div>
          <div className="space-y-4">
            <div className="bg-white/10 border border-white/20 p-4 max-w-sm">
              <h3 className="font-epilogue font-semibold text-white text-lg mb-1">{t('login.secureAccess')}</h3>
            </div>
            <div className="bg-white/10 border border-white/20 p-4 max-w-sm">
              <p className="text-sm text-white/70 leading-relaxed">
                {t('login.secureAccessDesc')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Right: Login Form ─── */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8 lg:p-16">
        <div className="w-full max-w-md fade-in">
          {/* Mobile brand */}
          <div className="lg:hidden mb-6 sm:mb-8">
            <div className="flex items-center gap-2.5 mb-1">
              <img src="/logo.png" alt="CityZen" className="w-8 h-8 object-contain border border-black/10" />
              <h1 className="font-epilogue text-2xl font-bold text-on-surface">CITYZEN</h1>
            </div>
            <p className="text-label-sm text-primary-400">{t('login.portalLabel')}</p>
          </div>

          {/* Tab toggle */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/10 mb-6 sm:mb-8">
            <div className="flex">
              <div className="px-3 sm:px-4 py-3 text-sm font-semibold text-on-surface border-b-2 border-black whitespace-nowrap">
                {t('login.tabLogin')}
              </div>
              <Link to="/citizen/signup" className="px-3 sm:px-4 py-3 text-sm text-primary-400 hover:text-on-surface transition-colors whitespace-nowrap">
                {t('login.tabRegister')}
              </Link>
            </div>
            <LanguageSwitcher />
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="login-email" className="text-label-sm text-on-surface-variant block mb-2">
                <HiMail className="inline w-3.5 h-3.5 mr-1.5 -mt-0.5" />
                {t('login.emailLabel')}
              </label>
              <input
                id="login-email"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder={t('login.emailPlaceholder')}
                className="input"
                autoComplete="email"
              />
            </div>

            <div>
              <label htmlFor="login-password" className="text-label-sm text-on-surface-variant block mb-2">
                <HiLockClosed className="inline w-3.5 h-3.5 mr-1.5 -mt-0.5" />
                {t('login.passwordLabel')}
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  name="password"
                  type={showPw ? 'text' : 'password'}
                  value={form.password}
                  onChange={handleChange}
                  placeholder="••••••••••••"
                  className="input pr-12"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((prev) => !prev)}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-primary-400 hover:text-on-surface"
                >
                  {showPw ? <HiEyeOff className="w-5 h-5" /> : <HiEye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-sm text-on-surface-variant cursor-pointer">
                <input
                  type="checkbox"
                  checked={maintainSession}
                  onChange={(e) => setMaintainSession(e.target.checked)}
                  className="w-4 h-4 border border-black/20 bg-white accent-black"
                />
                {t('login.maintainSession')}
              </label>
              <button
                type="button"
                onClick={() => toast(t('login.recoverKeyInfo', { defaultValue: 'Please contact your system administrator to reset your access key.' }))}
                className="text-label-sm text-on-surface underline underline-offset-2"
              >
                {t('login.recoverKey')}
              </button>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full py-3.5 flex items-center justify-between">
              <span>{loading ? t('login.authenticating') : t('login.authenticate')}</span>
              {!loading && <HiArrowRight className="w-5 h-5" />}
              {loading && <div className="w-5 h-5 border-2 border-white/30 border-t-white animate-spin" />}
            </button>
          </form>

          <div className="mt-8 flex items-center justify-between text-xs text-primary-400">
            <p>
              <HiLockClosed className="inline w-3 h-3 mr-1 -mt-0.5" />
              {t('login.protectedBy')}
            </p>
          </div>

          <div className="mt-6 pt-6 border-t border-black/10 text-center space-y-2">
            <p className="text-sm text-on-surface-variant">
              {t('login.noAccount')}{' '}
              <Link to="/citizen/signup" className="text-on-surface font-semibold underline underline-offset-2">{t('login.registerCitizen')}</Link>
              {' '}{t('login.or')}{' '}
              <Link to="/admin/signup" className="text-on-surface font-semibold underline underline-offset-2">{t('login.adminLink')}</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
