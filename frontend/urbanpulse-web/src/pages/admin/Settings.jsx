import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { HiUser, HiKey, HiAdjustments } from 'react-icons/hi'
import { makeApiCall, apiClient, authStorage } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import AccessibilitySettings from '../../components/shared/AccessibilitySettings'

const TABS = ['profile', 'password', 'accessibility']

export default function AdminSettings() {
  const { t } = useTranslation(['admin', 'citizen', 'common'])
  const { user, login } = useAuth()
  const [tab, setTab] = useState('profile')

  const [profileForm, setProfileForm] = useState({
    fullName: user?.fullName || user?.full_name || '',
    phoneNumber: user?.phoneNumber || user?.phone_number || '',
  })
  const [savingProfile, setSavingProfile] = useState(false)

  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [savingPassword, setSavingPassword] = useState(false)

  const handleProfileSubmit = async (e) => {
    e.preventDefault()
    setSavingProfile(true)
    try {
      const res = await makeApiCall(apiClient.auth.profile, { method: 'PUT', body: JSON.stringify(profileForm) })
      if (res?.success) {
        toast.success(t('citizen:settings.profileUpdated'))
        const token = authStorage.getToken()
        login(token, { ...user, ...res.data.user })
      } else {
        toast.error(res?.message || t('citizen:settings.updateFailed'))
      }
    } catch (err) {
      toast.error(err.message || t('citizen:settings.updateFailed'))
    } finally {
      setSavingProfile(false)
    }
  }

  const handlePasswordSubmit = async (e) => {
    e.preventDefault()
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error(t('citizen:settings.passwordMismatch'))
      return
    }
    setSavingPassword(true)
    try {
      const res = await makeApiCall(apiClient.auth.password, {
        method: 'PUT',
        body: JSON.stringify({ currentPassword: passwordForm.currentPassword, newPassword: passwordForm.newPassword }),
      })
      if (res?.success) {
        toast.success(t('citizen:settings.passwordUpdated'))
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      } else {
        toast.error(res?.message || t('citizen:settings.updateFailed'))
      }
    } catch (err) {
      toast.error(err.message || t('citizen:settings.updateFailed'))
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-4 sm:p-6 lg:p-8 pb-12">
      <div className="border-b border-black pb-4">
        <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 uppercase">
          {t('nav.admin.settings')}
        </h1>
      </div>

      <div className="flex flex-wrap gap-2 font-mono text-xs uppercase tracking-wider">
        {TABS.map(tKey => (
          <button
            key={tKey}
            onClick={() => setTab(tKey)}
            className={`px-3 py-1.5 border font-bold flex items-center gap-1.5 ${
              tab === tKey ? 'bg-neutral-900 text-white border-black' : 'border-neutral-300 text-neutral-700 hover:border-black'
            }`}
          >
            {tKey === 'profile' && <HiUser className="w-3.5 h-3.5" />}
            {tKey === 'password' && <HiKey className="w-3.5 h-3.5" />}
            {tKey === 'accessibility' && <HiAdjustments className="w-3.5 h-3.5" />}
            {t(`citizen:settings.tabs.${tKey}`)}
          </button>
        ))}
      </div>

      <div className="border border-black bg-white p-4 sm:p-6 md:p-8">
        {tab === 'profile' && (
          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <div>
              <label className="block font-mono text-xs uppercase tracking-wider text-neutral-700 mb-1">{t('citizen:settings.fullName')}</label>
              <input
                value={profileForm.fullName}
                onChange={e => setProfileForm({ ...profileForm, fullName: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 text-sm font-sans focus:outline-none focus:border-black"
              />
            </div>
            <div>
              <label className="block font-mono text-xs uppercase tracking-wider text-neutral-700 mb-1">{t('citizen:settings.phoneNumber')}</label>
              <input
                value={profileForm.phoneNumber}
                onChange={e => setProfileForm({ ...profileForm, phoneNumber: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 text-sm font-sans focus:outline-none focus:border-black"
              />
            </div>
            <button type="submit" disabled={savingProfile} className="btn-primary">
              {savingProfile ? t('citizen:settings.saving') : t('citizen:settings.saveChanges')}
            </button>
          </form>
        )}

        {tab === 'password' && (
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <label className="block font-mono text-xs uppercase tracking-wider text-neutral-700 mb-1">{t('citizen:settings.currentPassword')}</label>
              <input
                type="password"
                required
                value={passwordForm.currentPassword}
                onChange={e => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 text-sm font-sans focus:outline-none focus:border-black"
              />
            </div>
            <div>
              <label className="block font-mono text-xs uppercase tracking-wider text-neutral-700 mb-1">{t('citizen:settings.newPassword')}</label>
              <input
                type="password"
                required
                minLength={6}
                value={passwordForm.newPassword}
                onChange={e => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 text-sm font-sans focus:outline-none focus:border-black"
              />
            </div>
            <div>
              <label className="block font-mono text-xs uppercase tracking-wider text-neutral-700 mb-1">{t('citizen:settings.confirmPassword')}</label>
              <input
                type="password"
                required
                minLength={6}
                value={passwordForm.confirmPassword}
                onChange={e => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 text-sm font-sans focus:outline-none focus:border-black"
              />
            </div>
            <button type="submit" disabled={savingPassword} className="btn-primary">
              {savingPassword ? t('citizen:settings.saving') : t('citizen:settings.changePassword')}
            </button>
          </form>
        )}

        {tab === 'accessibility' && <AccessibilitySettings />}
      </div>
    </div>
  )
}
