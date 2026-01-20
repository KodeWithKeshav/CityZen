import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { makeApiCall, apiClient } from '../../services/api'
import toast from 'react-hot-toast'
import { HiMail, HiLockClosed, HiEye, HiEyeOff, HiUser, HiPhone, HiLocationMarker, HiArrowLeft } from 'react-icons/hi'

export default function CitizenSignup() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '', confirmPassword: '', fullName: '', phoneNumber: '', address: '' })
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
        body: JSON.stringify({ ...data, userType: 'citizen' }),
      })
      if (res.success) {
        toast.success('Account created! Please login.')
        navigate('/login')
      }
    } catch (err) {
      toast.error(err.message || 'Signup failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-800 to-primary-600 flex items-center justify-center p-4 py-8">
      <div className="w-full max-w-md fade-in">
        <div className="card">
          <div className="flex items-center gap-3 mb-6">
            <Link to="/login" className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
              <HiArrowLeft className="w-5 h-5 text-gray-600" />
            </Link>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Create Account</h2>
              <p className="text-gray-500 text-sm">Join UrbanPulse as a citizen</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field icon={HiUser} label="Full Name *" name="fullName" value={form.fullName} onChange={handleChange} placeholder="Your full name" />
            <Field icon={HiMail} label="Email Address *" name="email" type="email" value={form.email} onChange={handleChange} placeholder="you@example.com" />
            <Field icon={HiPhone} label="Phone Number *" name="phoneNumber" value={form.phoneNumber} onChange={handleChange} placeholder="+91 9876543210" />
            <Field icon={HiLocationMarker} label="Address" name="address" value={form.address} onChange={handleChange} placeholder="Your address (optional)" />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
              <div className="relative">
                <HiLockClosed className="absolute left-3 top-3.5 text-gray-400 w-5 h-5" />
                <input name="password" type={showPw ? 'text' : 'password'} value={form.password} onChange={handleChange} placeholder="Min 6 characters" className="input pl-10 pr-10" />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-3.5 text-gray-400">
                  {showPw ? <HiEyeOff className="w-5 h-5" /> : <HiEye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            <Field icon={HiLockClosed} label="Confirm Password *" name="confirmPassword" type="password" value={form.confirmPassword} onChange={handleChange} placeholder="Repeat password" />

            <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
              {loading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" /> : 'Create Account'}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-gray-600">
            Already have an account?{' '}
            <Link to="/login" className="text-primary-700 font-semibold hover:underline">Login</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

function Field({ icon: Icon, label, name, type = 'text', value, onChange, placeholder }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="relative">
        <Icon className="absolute left-3 top-3.5 text-gray-400 w-5 h-5" />
        <input name={name} type={type} value={value} onChange={onChange} placeholder={placeholder} className="input pl-10" />
      </div>
    </div>
  )
}

