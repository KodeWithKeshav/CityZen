import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { makeApiCall, apiClient } from '../../services/api'
import toast from 'react-hot-toast'
import { HiMail, HiLockClosed, HiEye, HiEyeOff, HiArrowLeft } from 'react-icons/hi'

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
    <div className="min-h-screen bg-gradient-to-br from-primary-800 to-primary-600 flex items-center justify-center p-4">
      <div className="w-full max-w-md fade-in">
        <div className="card">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <Link to="/" className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
              <HiArrowLeft className="w-5 h-5 text-gray-600" />
            </Link>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Sign In</h2>
              <p className="text-gray-500 text-sm">Sign in to your UrbanPulse account</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
              <div className="relative">
                <HiMail className="absolute left-3 top-3.5 text-gray-400 w-5 h-5" />
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="you@example.com"
                  className="input pl-10"
                  autoComplete="email"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <div className="relative">
                <HiLockClosed className="absolute left-3 top-3.5 text-gray-400 w-5 h-5" />
                <input
                  name="password"
                  type={showPw ? 'text' : 'password'}
                  value={form.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className="input pl-10 pr-10"
                  autoComplete="current-password"
                />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600">
                  {showPw ? <HiEyeOff className="w-5 h-5" /> : <HiEye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
              {loading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" /> : 'Login'}
            </button>
          </form>

          <div className="mt-6 text-center space-y-2">
            <p className="text-sm text-gray-600">
              Don't have an account?{' '}
              <Link to="/citizen/signup" className="text-primary-700 font-semibold hover:underline">Register as Citizen</Link>
              {' '}or{' '}
              <Link to="/admin/signup" className="text-blue-600 font-semibold hover:underline">Admin</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
