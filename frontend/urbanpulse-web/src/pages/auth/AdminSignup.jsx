import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { makeApiCall, apiClient } from '../../services/api'
import toast from 'react-hot-toast'
import { HiMail, HiLockClosed, HiEye, HiEyeOff, HiUser, HiPhone, HiArrowRight, HiShieldCheck } from 'react-icons/hi'

export default function AdminSignup() {
  const { t } = useTranslation('auth')
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '', confirmPassword: '', fullName: '', phoneNumber: '' })
  const [loading, setLoading] = useState(false)
  const [showPw, setShowPw] = useState(false)

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.email || !form.password || !form.fullName || !form.phoneNumber) { toast.error(t('adminSignup.fillRequired')); return }
    if (form.password !== form.confirmPassword) { toast.error(t('adminSignup.passwordMismatch')); return }
    if (form.password.length < 6) { toast.error(t('adminSignup.passwordTooShort')); return }
    setLoading(true)
    try {
      const { confirmPassword, ...data } = form
      const res = await makeApiCall(apiClient.auth.signup, {
        method: 'POST',
        body: JSON.stringify({ ...data, userType: 'admin' }),
      })
      if (res.success) {
        toast.success(t('adminSignup.accountCreated'))
        navigate('/login')
      }
    } catch (err) {
      toast.error(err.message || t('adminSignup.signupFailed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-bright flex">
      {/* ─── Left Panel ─── */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-black overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-gray-950 via-gray-900 to-black" />
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)',
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
          <div className="space-y-4">
            <div className="bg-white/10 border border-white/20 p-4 max-w-sm">
              <h3 className="font-epilogue font-semibold text-white text-lg mb-1">{t('adminSignup.leftTitle')}</h3>
              <p className="text-sm text-white/60">{t('adminSignup.leftDesc')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Right: Form ─── */}
      <div className="flex-1 flex items-center justify-center p-8 lg:p-16">
        <div className="w-full max-w-md fade-in">
          {/* Mobile brand */}
          <div className="lg:hidden mb-6">
            <div className="flex items-center gap-2.5 mb-1">
              <img src="/logo.png" alt="CityZen" className="w-8 h-8 object-contain border border-black/10" />
              <h1 className="font-epilogue text-2xl font-bold text-on-surface">CITYZEN</h1>
            </div>
            <p className="text-label-sm text-primary-400 mt-1">{t('adminSignup.tagline')}</p>
          </div>

          <div className="mb-8">
            <h2 className="font-epilogue text-headline-md text-on-surface mb-2">{t('adminSignup.title')}</h2>
            <p className="text-sm text-on-surface-variant">{t('adminSignup.desc')}</p>
          </div>

          <div className="card p-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              {[
                { icon: HiUser, label: t('adminSignup.fullName'), name: 'fullName', placeholder: t('adminSignup.fullNamePlaceholder') },
                { icon: HiMail, label: t('adminSignup.email'), name: 'email', type: 'email', placeholder: 'admin@example.com' },
                { icon: HiPhone, label: t('adminSignup.phone'), name: 'phoneNumber', placeholder: t('adminSignup.phonePlaceholder') },
              ].map(({ icon: Icon, label, name, type = 'text', placeholder }) => (
                <div key={name}>
                  <label className="text-label-sm text-on-surface-variant block mb-2">
                    <Icon className="inline w-3.5 h-3.5 mr-1.5 -mt-0.5" />
                    {label}
                  </label>
                  <input name={name} type={type} value={form[name]} onChange={handleChange} placeholder={placeholder} className="input" />
                </div>
              ))}

              <div>
                <label className="text-label-sm text-on-surface-variant block mb-2">
                  <HiLockClosed className="inline w-3.5 h-3.5 mr-1.5 -mt-0.5" />
                  {t('adminSignup.password')}
                </label>
                <div className="relative">
                  <input name="password" type={showPw ? 'text' : 'password'} value={form.password} onChange={handleChange} placeholder={t('adminSignup.passwordPlaceholder')} className="input pr-12" />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-4 top-1/2 -translate-y-1/2 text-primary-400 hover:text-on-surface">
                    {showPw ? <HiEyeOff className="w-5 h-5" /> : <HiEye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-label-sm text-on-surface-variant block mb-2">
                  <HiLockClosed className="inline w-3.5 h-3.5 mr-1.5 -mt-0.5" />
                  {t('adminSignup.confirmPassword')}
                </label>
                <input name="confirmPassword" type="password" value={form.confirmPassword} onChange={handleChange} placeholder={t('adminSignup.confirmPasswordPlaceholder')} className="input" />
              </div>

              <button type="submit" disabled={loading} className="btn-primary w-full py-3.5 flex items-center justify-between">
                <span>{loading ? t('adminSignup.verifying') : t('adminSignup.verifyIdentity')}</span>
                {!loading && <HiArrowRight className="w-5 h-5" />}
                {loading && <div className="w-5 h-5 border-2 border-white/30 border-t-white animate-spin" />}
              </button>
            </form>
          </div>

          <div className="mt-6 flex items-center justify-between text-sm text-on-surface-variant">
            <Link to="/login" className="text-on-surface font-semibold underline underline-offset-2">{t('adminSignup.requestAccess')}</Link>
            <span className="flex items-center gap-1.5 text-primary-400">
              <HiShieldCheck className="w-4 h-4" />
              {t('adminSignup.protocolHelp')}
            </span>
          </div>

          <p className="mt-6 text-center text-sm text-on-surface-variant">
            {t('adminSignup.alreadyHaveAccount')}{' '}
            <Link to="/login" className="text-on-surface font-semibold underline underline-offset-2">{t('adminSignup.login')}</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
