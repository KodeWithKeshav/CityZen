import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { makeApiCall, apiClient } from '../../services/api'
import LanguageSwitcher from '../../components/LanguageSwitcher'
import toast from 'react-hot-toast'
import { HiMail, HiLockClosed, HiEye, HiEyeOff, HiUser, HiPhone, HiLocationMarker, HiArrowRight } from 'react-icons/hi'

export default function CitizenSignup() {
  const { t } = useTranslation('auth')
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '', confirmPassword: '', fullName: '', phoneNumber: '', address: '' })
  const [loading, setLoading] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const [showConfirmPw, setShowConfirmPw] = useState(false)

  const handleChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    const email = form.email.trim()
    const fullName = form.fullName.trim()
    const phoneNumber = form.phoneNumber.trim()
    const address = form.address.trim()

    if (!email || !form.password || !fullName || !phoneNumber) { toast.error(t('citizenSignup.fillRequired')); return }
    if (fullName.length < 2) {
      toast.error(t('citizenSignup.nameTooShort', { defaultValue: 'Full name must be at least 2 characters' }))
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error(t('citizenSignup.invalidEmail', { defaultValue: 'Please enter a valid email address' }))
      return
    }
    if (phoneNumber.length < 10 || phoneNumber.replace(/\D/g, '').length < 10) {
      toast.error(t('citizenSignup.invalidPhone', { defaultValue: 'Phone number must be at least 10 digits' }))
      return
    }
    if (form.password !== form.confirmPassword) { toast.error(t('citizenSignup.passwordMismatch')); return }
    if (form.password.length < 6) { toast.error(t('citizenSignup.passwordTooShort')); return }
    setLoading(true)
    try {
      const res = await makeApiCall(apiClient.auth.signup, {
        method: 'POST',
        body: JSON.stringify({
          email,
          password: form.password,
          fullName,
          phoneNumber,
          ...(address ? { address } : {}),
          userType: 'citizen',
        }),
      })
      if (res?.success) {
        toast.success(t('citizenSignup.accountCreated'))
        navigate('/login')
      } else {
        toast.error(res?.message || t('citizenSignup.signupFailed'))
      }
    } catch (err) {
      toast.error(err.message || t('citizenSignup.signupFailed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-bright flex">
      {/* ─── Left Panel ─── */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-black overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-gray-800 via-gray-900 to-black" />
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }} />
        <div className="relative z-10 p-12 flex flex-col justify-between h-full">
          <div>
            <div className="w-14 h-14 bg-white p-2 border border-white/20 mb-4 flex items-center justify-center">
              <img src="/logo.png" alt="CityZen" className="w-full h-full object-contain" />
            </div>
            <h1 className="font-epilogue text-5xl font-bold text-white leading-none mb-4">CITY<br />ZEN</h1>
            <p className="text-label-sm text-white/60 tracking-widest">{t('login.portalLabel')}</p>
          </div>
          <div className="bg-white/10 border border-white/20 p-4 max-w-sm">
            <p className="text-sm text-white/70 leading-relaxed">
              {t('citizenSignup.leftDesc')}
            </p>
          </div>
        </div>
      </div>

      {/* ─── Right: Form ─── */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8 lg:p-16">
        <div className="w-full max-w-md fade-in">
          {/* Mobile brand */}
          <div className="lg:hidden mb-8">
            <div className="flex items-center gap-2.5 mb-1">
              <img src="/logo.png" alt="CityZen" className="w-8 h-8 object-contain border border-black/10" />
              <h1 className="font-epilogue text-2xl font-bold text-on-surface">CITYZEN</h1>
            </div>
            <p className="text-label-sm text-primary-400">{t('citizenSignup.tagline')}</p>
          </div>

          {/* Tab toggle */}
          <div className="flex items-center justify-between border-b border-black/10 mb-8">
            <div className="flex">
              <Link to="/login" className="px-4 py-3 text-sm text-primary-400 hover:text-on-surface transition-colors">
                {t('citizenSignup.tabLogin')}
              </Link>
              <div className="px-4 py-3 text-sm font-semibold text-on-surface border-b-2 border-black">
                {t('citizenSignup.tabRegister')}
              </div>
            </div>
            <LanguageSwitcher />
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <Field icon={HiUser} label={t('citizenSignup.fullName')} name="fullName" value={form.fullName} onChange={handleChange} placeholder={t('citizenSignup.fullNamePlaceholder')} autoComplete="name" />
            <Field icon={HiMail} label={t('citizenSignup.email')} name="email" type="email" value={form.email} onChange={handleChange} placeholder="you@example.com" autoComplete="email" />
            <Field icon={HiPhone} label={t('citizenSignup.phone')} name="phoneNumber" type="tel" value={form.phoneNumber} onChange={handleChange} placeholder={t('citizenSignup.phonePlaceholder')} autoComplete="tel" />
            <Field icon={HiLocationMarker} label={t('citizenSignup.address')} name="address" value={form.address} onChange={handleChange} placeholder={t('citizenSignup.addressPlaceholder')} autoComplete="street-address" />

            <div>
              <label htmlFor="citizen-password" className="text-label-sm text-on-surface-variant block mb-2">
                <HiLockClosed className="inline w-3.5 h-3.5 mr-1.5 -mt-0.5" />
                {t('citizenSignup.password')}
              </label>
              <div className="relative">
                <input id="citizen-password" name="password" type={showPw ? 'text' : 'password'} value={form.password} onChange={handleChange} placeholder={t('citizenSignup.passwordPlaceholder')} className="input pr-12" autoComplete="new-password" />
                <button type="button" onClick={() => setShowPw((prev) => !prev)} aria-label={showPw ? 'Hide password' : 'Show password'} className="absolute right-4 top-1/2 -translate-y-1/2 text-primary-400 hover:text-on-surface">
                  {showPw ? <HiEyeOff className="w-5 h-5" /> : <HiEye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            <div>
              <label htmlFor="citizen-confirmPassword" className="text-label-sm text-on-surface-variant block mb-2">
                <HiLockClosed className="inline w-3.5 h-3.5 mr-1.5 -mt-0.5" />
                {t('citizenSignup.confirmPassword')}
              </label>
              <div className="relative">
                <input id="citizen-confirmPassword" name="confirmPassword" type={showConfirmPw ? 'text' : 'password'} value={form.confirmPassword} onChange={handleChange} placeholder={t('citizenSignup.confirmPasswordPlaceholder')} className="input pr-12" autoComplete="new-password" />
                <button type="button" onClick={() => setShowConfirmPw((prev) => !prev)} aria-label={showConfirmPw ? 'Hide confirm password' : 'Show confirm password'} className="absolute right-4 top-1/2 -translate-y-1/2 text-primary-400 hover:text-on-surface">
                  {showConfirmPw ? <HiEyeOff className="w-5 h-5" /> : <HiEye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full py-3.5 flex items-center justify-between">
              <span>{loading ? t('citizenSignup.creating') : t('citizenSignup.createAccount')}</span>
              {!loading && <HiArrowRight className="w-5 h-5" />}
              {loading && <div className="w-5 h-5 border-2 border-white/30 border-t-white animate-spin" />}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-on-surface-variant">
            {t('citizenSignup.alreadyHaveAccount')}{' '}
            <Link to="/login" className="text-on-surface font-semibold underline underline-offset-2">{t('citizenSignup.login')}</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

function Field({ icon: Icon, label, name, type = 'text', value, onChange, placeholder, autoComplete }) {
  const inputId = `citizen-${name}`
  return (
    <div>
      <label htmlFor={inputId} className="text-label-sm text-on-surface-variant block mb-2">
        <Icon className="inline w-3.5 h-3.5 mr-1.5 -mt-0.5" />
        {label}
      </label>
      <input id={inputId} name={name} type={type} value={value} onChange={onChange} placeholder={placeholder} autoComplete={autoComplete} className="input" />
    </div>
  )
}
