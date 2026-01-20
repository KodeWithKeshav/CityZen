import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { makeApiCall, apiClient } from '../../services/api'
import toast from 'react-hot-toast'
import { HiMail, HiLockClosed, HiEye, HiEyeOff, HiUser, HiPhone, HiArrowLeft } from 'react-icons/hi'

export default function AdminSignup() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '', confirmPassword: '', fullName: '', phoneNumber: '' })
  const [loading, setLoading] = useState(false)
  const [showPw, setShowPw] = useState(false)

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.email || !form.password || !form.fullName || !form.phoneNumber) { toast.error('Please fill all required fields'); return }
    if (form.password !== form.confirmPassword) { toast.error('Passwords do not match'); return }
    if (form.password.length < 6) { toast.error('Password must be at least 6 characters'); return }
    setLoading(true)
    try {
      const { confirmPassword, ...data } = form
      const res = await makeApiCall(apiClient.auth.signup, {
        method: 'POST',
        body: JSON.stringify({ ...data, userType: 'admin' }),
      })
      if (res.success) {
        toast.success('Admin account created! Please login.')
        navigate('/login')
      }
    } catch (err) {
      toast.error(err.message || 'Signup failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-admin-800 to-admin-600 flex items-center justify-center p-4 py-8">
      <div className="w-full max-w-md fade-in">
        <div className="card">
          <div className="flex items-center gap-3 mb-6">
            <Link to="/login" className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
              <HiArrowLeft className="w-5 h-5 text-gray-600" />
            </Link>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Create Admin Account</h2>
              <p className="text-gray-500 text-sm">Register as a UrbanPulse admin</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {[
              { icon: HiUser, label: 'Full Name *', name: 'fullName', placeholder: 'Admin full name' },
              { icon: HiMail, label: 'Email Address *', name: 'email', type: 'email', placeholder: 'admin@example.com' },
              { icon: HiPhone, label: 'Phone Number *', name: 'phoneNumber', placeholder: '+91 9876543210' },
            ].map(({ icon: Icon, label, name, type = 'text', placeholder }) => (
              <div key={name}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                <div className="relative">
                  <Icon className="absolute left-3 top-3.5 text-gray-400 w-5 h-5" />
                  <input name={name} type={type} value={form[name]} onChange={handleChange} placeholder={placeholder} className="input-admin pl-10" />
                </div>
              </div>
            ))}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
              <div className="relative">
                <HiLockClosed className="absolute left-3 top-3.5 text-gray-400 w-5 h-5" />
                <input name="password" type={showPw ? 'text' : 'password'} value={form.password} onChange={handleChange} placeholder="Min 6 characters" className="input-admin pl-10 pr-10" />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-3.5 text-gray-400">
                  {showPw ? <HiEyeOff className="w-5 h-5" /> : <HiEye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password *</label>
              <div className="relative">
                <HiLockClosed className="absolute left-3 top-3.5 text-gray-400 w-5 h-5" />
                <input name="confirmPassword" type="password" value={form.confirmPassword} onChange={handleChange} placeholder="Repeat password" className="input-admin pl-10" />
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-admin w-full flex items-center justify-center gap-2">
              {loading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" /> : 'Create Admin Account'}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-gray-600">
            Already have an account?{' '}
            <Link to="/login" className="text-admin-600 font-semibold hover:underline">Login</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

