import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { HiUser, HiKey, HiAdjustments, HiExclamation } from 'react-icons/hi'
import { makeApiCall, apiClient, authStorage } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import AccessibilitySettings from '../../components/shared/AccessibilitySettings'

const TABS = ['profile', 'password', 'accessibility', 'danger']

export default function Settings() {
  const { t } = useTranslation(['citizen', 'common'])
  const { user, login, logout } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('profile')

  const [profileForm, setProfileForm] = useState({
    fullName: user?.fullName || user?.full_name || '',
    phoneNumber: user?.phoneNumber || user?.phone_number || '',
    address: user?.address || '',
  })
  const [savingProfile, setSavingProfile] = useState(false)

  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [savingPassword, setSavingPassword] = useState(false)

  const [deletePassword, setDeletePassword] = useState('')
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleProfileSubmit = async (e) => {
    e.preventDefault()
    setSavingProfile(true)
    try {
      const res = await makeApiCall(apiClient.auth.profile, {
        method: 'PUT',
        body: JSON.stringify(profileForm),
      })
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
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
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

  const handleDeleteAccount = async () => {
    if (!confirmingDelete) {
      setConfirmingDelete(true)
      return
    }
    if (!deletePassword) {
      toast.error(t('citizen:settings.passwordRequired'))
      return
    }
    setDeleting(true)
    try {
      const res = await makeApiCall(apiClient.auth.deleteAccount, {
        method: 'DELETE',
        body: JSON.stringify({ password: deletePassword }),
      })
      if (res?.success) {
        toast.success(t('citizen:settings.accountDeleted'))
        logout()
        navigate('/login', { replace: true })
      } else {
        toast.error(res?.message || t('citizen:settings.deleteFailed'))
      }
    } catch (err) {
      toast.error(err.message || t('citizen:settings.deleteFailed'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-4 sm:p-6 lg:p-8 pb-12">
      <div className="border-b border-black pb-4">
        <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 uppercase">
          {t('citizen:settings.title')}
        </h1>
        <p className="text-sm text-neutral-600 mt-1 font-sans">{t('citizen:settings.subtitle')}</p>
      </div>

      <div className="flex flex-wrap gap-2 font-mono text-xs uppercase tracking-wider">
        {TABS.map(tKey => (
          <button
            key={tKey}
            onClick={() => setTab(tKey)}
            className={`px-3 py-1.5 border font-bold flex items-center gap-1.5 ${
              tab === tKey ? 'bg-neutral-900 text-white border-black' : 'border-neutral-300 text-neutral-700 hover:border-black'
            } ${tKey === 'danger' ? (tab === tKey ? '!bg-rose-700 !border-rose-800' : '!text-rose-700 !border-rose-300') : ''}`}
          >
            {tKey === 'profile' && <HiUser className="w-3.5 h-3.5" />}
            {tKey === 'password' && <HiKey className="w-3.5 h-3.5" />}
            {tKey === 'accessibility' && <HiAdjustments className="w-3.5 h-3.5" />}
            {tKey === 'danger' && <HiExclamation className="w-3.5 h-3.5" />}
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
            <div>
              <label className="block font-mono text-xs uppercase tracking-wider text-neutral-700 mb-1">{t('citizen:settings.address')}</label>
              <textarea
                value={profileForm.address}
                onChange={e => setProfileForm({ ...profileForm, address: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 text-sm font-sans focus:outline-none focus:border-black h-20 resize-none"
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

        {tab === 'danger' && (
          <div className="space-y-4">
            <div className="border border-rose-300 bg-rose-50 p-4 space-y-3">
              <h3 className="font-serif text-lg font-bold uppercase text-rose-900">{t('citizen:settings.deleteAccount')}</h3>
              <p className="text-xs font-sans text-rose-800">{t('citizen:settings.deleteAccountDesc')}</p>
              {confirmingDelete && (
                <input
                  type="password"
                  placeholder={t('citizen:settings.enterPasswordToConfirm')}
                  value={deletePassword}
                  onChange={e => setDeletePassword(e.target.value)}
                  className="w-full px-3 py-2 border border-rose-300 text-sm font-sans focus:outline-none focus:border-rose-700"
                />
              )}
              <div className="flex gap-2">
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                  className="px-4 py-2 bg-rose-700 text-white font-mono text-xs font-bold uppercase tracking-wider hover:bg-rose-800 disabled:opacity-50"
                >
                  {confirmingDelete ? t('citizen:settings.confirmDeleteAccount') : t('citizen:settings.deleteAccount')}
                </button>
                {confirmingDelete && (
                  <button
                    onClick={() => { setConfirmingDelete(false); setDeletePassword('') }}
                    className="px-4 py-2 font-mono text-xs uppercase tracking-wider text-neutral-600 hover:text-black"
                  >
                    {t('common:mobileNav.cancel')}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
