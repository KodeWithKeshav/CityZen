import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { makeApiCall, apiClient } from '../../services/api'
import toast from 'react-hot-toast'
import { HiArrowLeft, HiExclamationCircle, HiDocumentText, HiChevronRight, HiBan, HiCheckCircle, HiTrash } from 'react-icons/hi'
import { formatLocalizedDate, formatLocalizedDateTime } from '../../utils/dateLocale'
import { useTranslatedList, useTranslatedObject } from '../../context/TranslationContext'

export default function CitizenDetails() {
  const { t, i18n } = useTranslation(['admin', 'common'])
  const { id } = useParams()
  const navigate = useNavigate()
  const [citizen, setCitizen] = useState(null)
  const [complaints, setComplaints] = useState([])
  const [loading, setLoading] = useState(true)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const STATUS_CONFIG = {
    pending: { label: t('status.pending'), bg: 'bg-amber-50 text-amber-900 border-amber-300' },
    in_progress: { label: t('status.inProgress'), bg: 'bg-blue-50 text-blue-900 border-blue-300' },
    'in-progress': { label: t('status.inProgress'), bg: 'bg-blue-50 text-blue-900 border-blue-300' },
    resolved: { label: t('status.resolved'), bg: 'bg-emerald-50 text-emerald-900 border-emerald-300' },
    rejected: { label: t('status.rejected'), bg: 'bg-rose-50 text-rose-900 border-rose-300' },
  }

  useEffect(() => {
    let cancelled = false
    const fetchCitizenDetails = async () => {
      setLoading(true)
      setCitizen(null)
      setComplaints([])
      try {
        const res = await makeApiCall(apiClient.admin.citizenById(id))
        if (cancelled) return
        if (res?.success && res?.data) {
          const rawCitizen = res.data.citizen || res.data
          setCitizen({
            ...rawCitizen,
            fullName: rawCitizen.fullName || rawCitizen.full_name,
            phoneNumber: rawCitizen.phoneNumber || rawCitizen.phone_number,
            createdAt: rawCitizen.createdAt || rawCitizen.created_at,
          })
          setComplaints(
            (res.data.complaints || []).map(c => ({
              ...c,
              createdAt: c.createdAt || c.created_at,
            }))
          )
        } else {
          toast.error(res?.message || res?.error || t('citizenDetails.loadFailed'))
        }
      } catch {
        if (!cancelled) toast.error(t('citizenDetails.loadFailed'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchCitizenDetails()
    return () => { cancelled = true }
  }, [id])

  const toggleStatus = async () => {
    if (!citizen) return
    const nextStatus = citizen.status === 'active' ? 'inactive' : 'active'
    setUpdatingStatus(true)
    try {
      const res = await makeApiCall(apiClient.admin.citizenStatus(id), {
        method: 'PUT',
        body: JSON.stringify({ status: nextStatus }),
      })
      if (res?.success) {
        toast.success(t('citizenDetails.statusUpdated'))
        setCitizen(prev => ({ ...prev, status: nextStatus, is_active: nextStatus === 'active' }))
      } else {
        toast.error(res?.message || t('citizenDetails.statusUpdateFailed'))
      }
    } catch (err) {
      toast.error(err.message || t('citizenDetails.statusUpdateFailed'))
    } finally {
      setUpdatingStatus(false)
    }
  }

  const handleDelete = async () => {
    if (!confirmingDelete) {
      setConfirmingDelete(true)
      return
    }
    setDeleting(true)
    try {
      const res = await makeApiCall(apiClient.admin.deleteCitizen(id), { method: 'DELETE' })
      if (res?.success) {
        toast.success(t('citizenDetails.deleted'))
        navigate('/admin/citizens', { replace: true })
      } else {
        toast.error(res?.message || t('citizenDetails.deleteFailed'))
        setConfirmingDelete(false)
      }
    } catch (err) {
      toast.error(err.message || t('citizenDetails.deleteFailed'))
      setConfirmingDelete(false)
    } finally {
      setDeleting(false)
    }
  }

  const translatedCitizen = useTranslatedObject(citizen, ['fullName', 'address'])
  const translatedComplaints = useTranslatedList(complaints, ['title', 'complaintTitle', 'description'])

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-4 font-mono text-xs text-neutral-500 p-4 sm:p-6 lg:p-8 py-12">
        <div className="h-6 w-32 bg-neutral-200 animate-pulse" />
        <div className="border border-neutral-200 p-6 sm:p-8 h-48 bg-white animate-pulse" />
      </div>
    )
  }

  if (!citizen) {
    return (
      <div className="max-w-xl mx-auto p-4 sm:p-6 lg:p-8 my-6 sm:my-12">
        <div className="border border-neutral-300 bg-white p-8 sm:p-12 text-center">
          <HiExclamationCircle className="w-12 h-12 text-neutral-400 mx-auto mb-3" />
          <h2 className="font-serif text-xl font-bold text-neutral-900 uppercase">
            {t('citizenDetails.notFoundTitle')}
          </h2>
          <p className="text-xs text-neutral-500 font-sans mt-1 break-all">
            {t('citizenDetails.notFoundDesc', { id })}
          </p>
          <button
            onClick={() => navigate(-1)}
            className="mt-6 px-4 py-2 bg-black text-white font-mono text-xs uppercase"
          >
            {t('citizenDetails.returnToRoster')}
          </button>
        </div>
      </div>
    )
  }

  const displayCitizen = translatedCitizen || citizen
  const initialStr = (displayCitizen.fullName || 'C').trim()
  const initial = (typeof Intl !== 'undefined' && Intl.Segmenter)
    ? (new Intl.Segmenter().segment(initialStr)[Symbol.iterator]().next().value?.segment || initialStr.charAt(0)).toUpperCase()
    : initialStr.charAt(0).toUpperCase()
  const dateStr = formatLocalizedDateTime(citizen.createdAt, i18n.language) || t('citizenDetails.undated')

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-4 sm:p-6 lg:p-8 pb-12">
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-neutral-700 hover:text-black border-b border-transparent hover:border-black transition-all pb-0.5"
      >
        <HiArrowLeft className="w-4 h-4" />
        <span>{t('citizenDetails.backToRoster')}</span>
      </button>

      {/* Profile Card */}
      <div className="border border-neutral-200 bg-white">
        <div className="p-4 sm:p-6 border-b border-neutral-200 flex flex-col sm:flex-row sm:items-center gap-4 bg-neutral-50">
          <div className="w-14 h-14 bg-black text-white flex items-center justify-center font-mono text-2xl font-bold flex-shrink-0">
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <span className="font-mono text-[10px] text-neutral-500 uppercase tracking-widest block mb-0.5 break-all">
              {t('citizenDetails.profileRecord', { id })}
            </span>
            <h1 className="font-serif text-xl sm:text-2xl font-bold text-neutral-900 uppercase break-words">
              {displayCitizen.fullName || t('citizenDetails.anonymousCitizen')}
            </h1>
            <p className="text-xs font-mono text-neutral-600 mt-0.5 break-all">
              {displayCitizen.email}
            </p>
          </div>
        </div>

        {/* Identity Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border-b border-neutral-200 gap-px bg-neutral-200 font-mono text-xs">
          <div className="p-4 bg-white">
            <span className="text-neutral-500 uppercase text-[10px] block mb-1">{t('citizenDetails.phoneNumber')}</span>
            <span className="font-bold text-neutral-900">{displayCitizen.phoneNumber || t('citizenDetails.unregistered')}</span>
          </div>
          <div className="p-4 bg-white">
            <span className="text-neutral-500 uppercase text-[10px] block mb-1">{t('citizenDetails.residenceWard')}</span>
            <span className="font-bold text-neutral-900 truncate block">
              {displayCitizen.address || t('citizenManagement.wardUnassigned')}
            </span>
          </div>
          <div className="p-4 bg-white">
            <span className="text-neutral-500 uppercase text-[10px] block mb-1">{t('citizenDetails.enrolledDate')}</span>
            <span className="font-bold text-neutral-900">{dateStr}</span>
          </div>
          <div className="p-4 bg-white">
            <span className="text-neutral-500 uppercase text-[10px] block mb-1">{t('citizenDetails.dispatchesFiled')}</span>
            <span className="font-bold text-neutral-900">{t('citizenDetails.submissionsCount', { count: complaints.length })}</span>
          </div>
        </div>

        {/* Account Management */}
        <div className="p-4 sm:p-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs uppercase tracking-wider text-neutral-500">{t('citizenDetails.accountStatus')}:</span>
            <span className={`px-2 py-0.5 border font-mono text-[10px] uppercase tracking-wider font-bold ${
              citizen.status === 'active' ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-neutral-100 border-neutral-300 text-neutral-600'
            }`}>
              {citizen.status === 'active' ? t('citizenDetails.statusActive') : t('citizenDetails.statusInactive')}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={toggleStatus}
              disabled={updatingStatus}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-neutral-300 hover:border-black font-mono text-xs uppercase tracking-wider disabled:opacity-50"
            >
              {citizen.status === 'active' ? <HiBan className="w-3.5 h-3.5" /> : <HiCheckCircle className="w-3.5 h-3.5" />}
              {citizen.status === 'active' ? t('citizenDetails.deactivate') : t('citizenDetails.reactivate')}
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 border font-mono text-xs uppercase tracking-wider disabled:opacity-50 ${
                confirmingDelete ? 'bg-rose-600 text-white border-rose-700' : 'border-rose-300 text-rose-700 hover:bg-rose-50'
              }`}
            >
              <HiTrash className="w-3.5 h-3.5" />
              {confirmingDelete ? t('citizenDetails.confirmDelete') : t('citizenDetails.delete')}
            </button>
            {confirmingDelete && (
              <button
                onClick={() => setConfirmingDelete(false)}
                className="px-3 py-1.5 font-mono text-xs uppercase tracking-wider text-neutral-500 hover:text-black"
              >
                {t('common:mobileNav.cancel')}
              </button>
            )}
          </div>
        </div>
        {confirmingDelete && (
          <div className="px-4 sm:px-6 pb-4 sm:pb-6 -mt-2">
            <p className="text-xs font-sans text-rose-700 bg-rose-50 border border-rose-200 p-2">
              {t('citizenDetails.deleteWarning')}
            </p>
          </div>
        )}
      </div>

      {/* Citizen Complaint Submissions History */}
      <div className="border border-neutral-200 bg-white p-4 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 pb-3 font-mono text-xs">
          <div className="flex items-center gap-2">
            <HiDocumentText className="w-4 h-4 text-neutral-700" />
            <span className="font-bold uppercase tracking-wider text-neutral-900">
              {t('citizenDetails.filingHistory', { count: complaints.length })}
            </span>
          </div>
          <span className="text-neutral-400 text-[10px]">{t('citizenDetails.historicalRecord')}</span>
        </div>

        {complaints.length === 0 ? (
          <div className="text-center py-10 font-mono text-xs text-neutral-400">
            {t('citizenDetails.noDispatchRecords')}
          </div>
        ) : (
          <div className="divide-y divide-neutral-200 font-mono text-xs">
            {translatedComplaints.map(c => {
              const statusKey = (c.status || 'pending').toLowerCase()
              const statusInfo = STATUS_CONFIG[statusKey] || {
                label: (c.status || t('status.pending')).toUpperCase(),
                bg: 'bg-neutral-100 text-neutral-800 border-neutral-300',
              }
              const timeStr = formatLocalizedDate(c.createdAt, {}, i18n.language) || '—'

              return (
                <div
                  key={c._id || c.id}
                  onClick={() => navigate(`/admin/complaints/${c._id || c.id}`)}
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 hover:bg-neutral-50 px-2 cursor-pointer transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-neutral-400 text-[10px]">
                        #{String(c._id || c.id || '').slice(-6).toUpperCase()}
                      </span>
                      <span className={`px-2 py-0.5 border text-[9px] uppercase tracking-wider ${statusInfo.bg}`}>
                        {statusInfo.label}
                      </span>
                    </div>
                    <h4 className="font-serif font-bold text-sm text-neutral-900 truncate">
                      {c.title || c.complaintTitle || t('citizenDetails.unclassifiedHazard')}
                    </h4>
                    <p className="font-sans text-xs text-neutral-500 truncate mt-0.5">
                      {c.description}
                    </p>
                  </div>

                  <div className="flex sm:block items-center justify-between text-left sm:text-right flex-shrink-0 text-neutral-500">
                    <div>{timeStr}</div>
                    <span className="text-neutral-900 font-bold hover:underline inline-flex items-center gap-1 text-[11px] sm:mt-1">
                      {t('citizenDetails.audit')} <HiChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
