import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { makeApiCall, apiClient } from '../../services/api'
import toast from 'react-hot-toast'
import { HiMail, HiLockClosed, HiEye, HiEyeOff, HiArrowRight } from 'react-icons/hi'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [showPw, setShowPw] = useState(false)

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.email || !form.password) { toast.error('Please fill in all fields'); return }
    setLoading(true)
    try {
      const res = await makeApiCall(apiClient.auth.login, {
        method: 'POST',
        body: JSON.stringify(form),
      })
      if (res.success) {
        login(res.data.token, res.data.user)
        toast.success(`Welcome back, ${res.data.user.fullName || ''}!`)
        
        if (res.data.user.userType === 'admin') {
          navigate('/admin/dashboard', { replace: true })
        } else {
          navigate('/citizen/feed', { replace: true })
        }
      }
    } catch (err) {
      toast.error(err.message || 'Login failed')
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
              INSTITUTIONAL PORTAL
            </p>
          </div>
          <div className="space-y-4">
            <div className="bg-white/10 border border-white/20 p-4 max-w-sm">
              <h3 className="font-epilogue font-semibold text-white text-lg mb-1">Secure Citizen Access</h3>
            </div>
            <div className="bg-white/10 border border-white/20 p-4 max-w-sm">
              <p className="text-sm text-white/70 leading-relaxed">
                Institutional portal for secure identity verification and civic engagement. Restricted access.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Right: Login Form ─── */}
      <div className="flex-1 flex items-center justify-center p-8 lg:p-16">
        <div className="w-full max-w-md fade-in">
          {/* Mobile brand */}
          <div className="lg:hidden mb-8">
            <div className="flex items-center gap-2.5 mb-1">
              <img src="/logo.png" alt="CityZen" className="w-8 h-8 object-contain border border-black/10" />
              <h1 className="font-epilogue text-2xl font-bold text-on-surface">CITYZEN</h1>
            </div>
            <p className="text-label-sm text-primary-400">INSTITUTIONAL PORTAL</p>
          </div>

          {/* Tab toggle */}
          <div className="flex border-b border-black/10 mb-8">
            <div className="px-4 py-3 text-sm font-semibold text-on-surface border-b-2 border-black">
              LOGIN
            </div>
            <Link to="/citizen/signup" className="px-4 py-3 text-sm text-primary-400 hover:text-on-surface transition-colors">
              REGISTER
            </Link>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="text-label-sm text-on-surface-variant block mb-2">
                <HiMail className="inline w-3.5 h-3.5 mr-1.5 -mt-0.5" />
                CITIZEN ID / EMAIL
              </label>
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="Enter your credentials"
                className="input"
                autoComplete="email"
              />
            </div>

            <div>
              <label className="text-label-sm text-on-surface-variant block mb-2">
                <HiLockClosed className="inline w-3.5 h-3.5 mr-1.5 -mt-0.5" />
                ACCESS KEY
              </label>
              <div className="relative">
                <input
                  name="password"
                  type={showPw ? 'text' : 'password'}
                  value={form.password}
                  onChange={handleChange}
                  placeholder="••••••••••••"
                  className="input pr-12"
                  autoComplete="current-password"
                />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-4 top-1/2 -translate-y-1/2 text-primary-400 hover:text-on-surface">
                  {showPw ? <HiEyeOff className="w-5 h-5" /> : <HiEye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-on-surface-variant cursor-pointer">
                <input type="checkbox" className="w-4 h-4 border border-black/20 bg-white accent-black" />
                Maintain Session
              </label>
              <button type="button" className="text-label-sm text-on-surface underline underline-offset-2">
                RECOVER KEY
              </button>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full py-3.5 flex items-center justify-between">
              <span>{loading ? 'AUTHENTICATING...' : 'AUTHENTICATE SESSION'}</span>
              {!loading && <HiArrowRight className="w-5 h-5" />}
              {loading && <div className="w-5 h-5 border-2 border-white/30 border-t-white animate-spin" />}
            </button>
          </form>

          <div className="mt-8 flex items-center justify-between text-xs text-primary-400">
            <p>
              <HiLockClosed className="inline w-3 h-3 mr-1 -mt-0.5" />
              Protected by Civic Protocol 256-bit encryption
            </p>
          </div>

          <div className="mt-6 pt-6 border-t border-black/10 text-center space-y-2">
            <p className="text-sm text-on-surface-variant">
              Don't have an account?{' '}
              <Link to="/citizen/signup" className="text-on-surface font-semibold underline underline-offset-2">Register as Citizen</Link>
              {' '}or{' '}
              <Link to="/admin/signup" className="text-on-surface font-semibold underline underline-offset-2">Admin</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
