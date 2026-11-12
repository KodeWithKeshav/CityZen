import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { makeApiCall, apiClient } from '../../services/api'
import toast from 'react-hot-toast'
import { HiSearch, HiRefresh, HiDocumentText, HiChevronRight } from 'react-icons/hi'
import { formatLocalizedDate } from '../../utils/dateLocale'
import { getPriorityTier, getCategoryLabel } from '../../utils/priorityUtils'
import { useTranslatedList } from '../../context/TranslationContext'

export default function AdminComplaints() {
  const { t, i18n } = useTranslation(['admin', 'complaint', 'common'])
  const [complaints, setComplaints] = useState([])
  const [filtered, setFiltered] = useState([])

  const STATUS_CONFIG = {
    pending: { label: t('status.pending'), bg: 'bg-amber-50 text-amber-900 border-amber-300' },
    in_progress: { label: t('status.inProgress'), bg: 'bg-blue-50 text-blue-900 border-blue-300' },
    'in-progress': { label: t('status.inProgress'), bg: 'bg-blue-50 text-blue-900 border-blue-300' },
    resolved: { label: t('status.resolved'), bg: 'bg-emerald-50 text-emerald-900 border-emerald-300' },
    rejected: { label: t('status.rejected'), bg: 'bg-rose-50 text-rose-900 border-rose-300' },
  }
  const [searchParams] = useSearchParams()
  const urlQuery = searchParams.get('q') || ''
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(urlQuery)
  const [statusFilter, setStatusFilter] = useState('all')
  const [flaggedOnly, setFlaggedOnly] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    setSearch(urlQuery)
  }, [urlQuery])

  const fetchComplaints = async () => {
    setLoading(true)
    try {
      const res = await makeApiCall(apiClient.complaints.all)
      const dataArray = res?.complaints || res?.data
      if (res?.success && Array.isArray(dataArray)) {
        setComplaints(dataArray)
        setFiltered(dataArray)
      } else {
        toast.error(res?.message || res?.error || t('complaintsRegistry.loadFailed'))
      }
    } catch {
      toast.error(t('complaintsRegistry.loadFailed'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchComplaints()
  }, [])

  useEffect(() => {
    let list = complaints
    if (statusFilter !== 'all') {
      const normalizedFilter = statusFilter.toLowerCase()
      const hyphenFilter = normalizedFilter.replace(/_/g, '-')
      list = list.filter(c => {
        const st = (c.status || '').toLowerCase()
        return st === normalizedFilter || st === hyphenFilter
      })
    }
    if (flaggedOnly) {
      list = list.filter(c => Boolean(c.content_flagged))
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(c => {
        const citizen = c.citizenName || c.users?.full_name || c.user?.full_name || c.user_name || c.full_name || ''
        const address = c.location_address || c.location?.address || ''
        return (
          (c.title || c.complaintTitle || '').toLowerCase().includes(q) ||
          citizen.toLowerCase().includes(q) ||
          (c.description || '').toLowerCase().includes(q) ||
          address.toLowerCase().includes(q) ||
          String(c._id || c.id || '').toLowerCase().includes(q)
        )
      })
    }
    setFiltered(list)
  }, [search, statusFilter, flaggedOnly, complaints])

  const normalizedFiltered = useMemo(
    () =>
      filtered.map(c => ({
        ...c,
        citizenName: c.citizenName || c.users?.full_name || c.user?.full_name || c.user_name || c.full_name || '',
      })),
    [filtered]
  )

  const translatedFiltered = useTranslatedList(normalizedFiltered, [
    'title',
    'complaintTitle',
    'description',
    'location_address',
    'content_flag_reason',
    'citizenName',
  ])

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-4 sm:p-6 lg:p-8 pb-12">
      {/* Header */}
      <div className="border-b border-black pb-4 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs text-neutral-500 uppercase tracking-widest mb-1">
            <span>{t('complaintsRegistry.breadcrumbArchive')}</span>
            <span>/</span>
            <span>{t('complaintsRegistry.breadcrumbSubmissions')}</span>
            <span>/</span>
            <span className="text-black font-semibold">{t('complaintsRegistry.breadcrumbCadastre')}</span>
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 uppercase">
            {t('complaintsRegistry.title')}
          </h1>
          <p className="text-sm text-neutral-600 mt-1 font-sans">
            {t('complaintsRegistry.subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchComplaints}
            disabled={loading}
            className="p-2 border border-neutral-300 hover:border-black transition-colors disabled:opacity-50"
            title={t('complaintsRegistry.refreshTooltip')}
          >
            <HiRefresh className={`w-4 h-4 text-neutral-800 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="border border-neutral-200 bg-white p-4 space-y-3">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <HiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 w-4 h-4" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('complaintsRegistry.searchPlaceholder')}
              className="w-full pl-9 pr-3 py-2 border border-neutral-300 rounded-none text-xs font-mono placeholder-neutral-400 focus:outline-none focus:border-black"
            />
          </div>

          <div className="flex gap-1.5 flex-wrap font-mono text-xs">
            {['all', 'pending', 'in_progress', 'resolved', 'rejected'].map(f => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`px-3 py-2 border uppercase tracking-wider transition-colors ${statusFilter === f
                  ? 'bg-neutral-900 text-white border-black font-bold'
                  : 'border-neutral-300 text-neutral-700 hover:border-black bg-white'
                  }`}
              >
                {t(`common:statusFilters.${f}`)}
              </button>
            ))}
            <button
              onClick={() => setFlaggedOnly(v => !v)}
              className={`px-3 py-2 border uppercase tracking-wider transition-colors ${flaggedOnly
                ? 'bg-rose-600 text-white border-rose-700 font-bold'
                : 'border-neutral-300 text-neutral-700 hover:border-black bg-white'
                }`}
            >
              {t('complaintsRegistry.flagged')}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap justify-between items-center gap-2 text-xs font-mono text-neutral-500 pt-1 border-t border-neutral-100">
          <span>
            {t('complaintsRegistry.matchingRecords')}{' '}
            <strong className="text-black">{filtered.length}</strong>{' '}
            {t('complaintsRegistry.of')} {complaints.length}
          </span>
          <span>
            {t('complaintsRegistry.statusFilter')}{' '}
            <strong className="text-black uppercase">{t(`common:statusFilters.${statusFilter}`)}</strong>
          </span>
        </div>
      </div>

      {/* Main Table / Ledger */}
      {loading ? (
        <div className="border border-neutral-200 p-8 text-center font-mono text-xs text-neutral-500 bg-white">
          {t('complaintsRegistry.loading')}
        </div>
      ) : filtered.length === 0 ? (
        <div className="border border-dashed border-neutral-300 bg-white p-12 text-center">
          <HiDocumentText className="w-10 h-10 text-neutral-400 mx-auto mb-3" />
          <h3 className="font-serif text-lg font-bold text-neutral-900 uppercase">
            {t('complaintsRegistry.noRecordsTitle')}
          </h3>
          <p className="text-xs text-neutral-500 font-sans mt-1">
            {t('complaintsRegistry.noRecordsDesc')}
          </p>
        </div>
      ) : (
        <>
          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
            {translatedFiltered.map(c => {
              const statusKey = (c.status || 'pending').toLowerCase()
              const statusInfo = STATUS_CONFIG[statusKey] || {
                label: (c.status || t('status.pending')).toUpperCase(),
                bg: 'bg-neutral-100 text-neutral-800 border-neutral-300',
              }
              const rawDate = c.createdAt || c.created_at
              const dateStr = formatLocalizedDate(rawDate, {}, i18n.language) || '—'
              const pTier = getPriorityTier(c, t)
              const categoryLabel = getCategoryLabel(c.category || c.issueType, t) || t('complaintsRegistry.unclassifiedIncident')

              return (
                <div
                  key={c._id || c.id}
                  onClick={() => navigate(`/admin/complaints/${c._id || c.id}`)}
                  className="border border-neutral-200 hover:border-black bg-white p-4 space-y-2.5 cursor-pointer transition-colors"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5 font-mono text-xs">
                      <span className="font-bold text-neutral-500">
                        #{String(c._id || c.id || '').slice(-6).toUpperCase()}
                      </span>
                      <span className={`px-2 py-0.5 border text-[10px] uppercase tracking-wider ${statusInfo.bg}`}>
                        {statusInfo.label}
                      </span>
                      {c.content_flagged && (
                        <span className="px-1.5 py-0.5 border border-rose-300 bg-rose-50 text-rose-900 text-[9px] uppercase tracking-wider">
                          {t('complaintsRegistry.flagged')}
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-[11px] text-neutral-500">{dateStr}</span>
                  </div>

                  <div>
                    <h3 className="font-serif font-bold text-sm text-neutral-900">
                      {c.title || c.complaintTitle || t('complaintsRegistry.unclassifiedIncident')}
                    </h3>
                    {c.description && (
                      <p className="font-sans text-xs text-neutral-500 line-clamp-2 mt-0.5">
                        {c.description}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-neutral-100 font-mono text-[11px]">
                    <div className="flex flex-wrap items-center gap-2 text-neutral-600">
                      <span>{c.citizenName || c.users?.full_name || c.user?.full_name || c.user_name || t('verifiedCitizen')}</span>
                      <span className="px-1.5 py-0.5 border border-neutral-200 bg-neutral-50 text-[10px] uppercase">
                        {categoryLabel}
                      </span>
                      <span className="font-bold text-neutral-800 uppercase">
                        {pTier.label}{pTier.score !== null ? ` (${pTier.displayScore})` : ''}
                      </span>
                    </div>
                    <span className="text-black font-bold inline-flex items-center gap-1">
                      {t('complaintsRegistry.audit')} <HiChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block border border-neutral-200 bg-white overflow-x-auto">
            <table className="w-full text-left font-mono text-xs border-collapse">
              <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="p-3 border-r border-neutral-200">{t('complaintsRegistry.table.id')}</th>
                  <th className="p-3 border-r border-neutral-200">{t('complaintsRegistry.table.incident')}</th>
                  <th className="p-3 border-r border-neutral-200">{t('complaintsRegistry.table.citizen')}</th>
                  <th className="p-3 border-r border-neutral-200">{t('complaintsRegistry.table.category')}</th>
                  <th className="p-3 border-r border-neutral-200">{t('complaintsRegistry.table.severity')}</th>
                  <th className="p-3 border-r border-neutral-200">{t('complaintsRegistry.table.status')}</th>
                  <th className="p-3 border-r border-neutral-200">{t('complaintsRegistry.filedOn')}</th>
                  <th className="p-3 text-right">{t('complaintsRegistry.table.action')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 text-neutral-800">
                {translatedFiltered.map(c => {
                  const statusKey = (c.status || 'pending').toLowerCase()
                  const statusInfo = STATUS_CONFIG[statusKey] || {
                    label: (c.status || t('status.pending')).toUpperCase(),
                    bg: 'bg-neutral-100 text-neutral-800 border-neutral-300',
                  }
                  const rawDate = c.createdAt || c.created_at
                  const dateStr = formatLocalizedDate(rawDate, {}, i18n.language) || '—'
                  const categoryLabel = getCategoryLabel(c.category || c.issueType, t) || t('complaintsRegistry.unclassifiedIncident')

                  return (
                    <tr
                      key={c._id || c.id}
                      onClick={() => navigate(`/admin/complaints/${c._id || c.id}`)}
                      className="hover:bg-neutral-50 cursor-pointer transition-colors"
                    >
                      <td className="p-3 border-r border-neutral-200 font-bold text-neutral-500 whitespace-nowrap">
                        #{String(c._id || c.id || '').slice(-6).toUpperCase()}
                      </td>
                      <td className="p-3 border-r border-neutral-200 max-w-xs">
                        <div className="flex items-center gap-1.5">
                          <div className="font-serif font-bold text-sm text-neutral-900 truncate">
                            {c.title || c.complaintTitle || t('complaintsRegistry.unclassifiedIncident')}
                          </div>
                          {c.content_flagged && (
                            <span
                              className="px-1.5 py-0.5 border border-rose-300 bg-rose-50 text-rose-900 text-[9px] uppercase tracking-wider flex-shrink-0"
                              title={c.content_flag_reason || t('complaintsRegistry.flaggedTooltip')}
                            >
                              {t('complaintsRegistry.flagged')}
                            </span>
                          )}
                        </div>
                        <div className="font-sans text-xs text-neutral-500 truncate mt-0.5">
                          {c.description}
                        </div>
                      </td>
                      <td className="p-3 border-r border-neutral-200 whitespace-nowrap">
                        {c.citizenName || c.users?.full_name || c.user?.full_name || c.user_name || t('verifiedCitizen')}
                      </td>
                      <td className="p-3 border-r border-neutral-200 whitespace-nowrap">
                        <span className="px-1.5 py-0.5 border border-neutral-200 bg-neutral-50 text-[10px] uppercase">
                          {categoryLabel}
                        </span>
                      </td>
                      <td className="p-3 border-r border-neutral-200 whitespace-nowrap">
                        {(() => {
                          const pTier = getPriorityTier(c, t)
                          return (
                            <div>
                              <span className="font-bold uppercase block text-xs">{pTier.label}</span>
                              {pTier.score !== null && (
                                <span className="text-neutral-500 text-[10px] block">
                                  {t('complaintsRegistry.scorePrefix', { score: pTier.displayScore })}
                                </span>
                              )}
                            </div>
                          )
                        })()}
                      </td>
                      <td className="p-3 border-r border-neutral-200 whitespace-nowrap">
                        <span className={`px-2 py-0.5 border text-[10px] uppercase tracking-wider ${statusInfo.bg}`}>
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="p-3 border-r border-neutral-200 whitespace-nowrap text-neutral-500">
                        {dateStr}
                      </td>
                      <td className="p-3 text-right whitespace-nowrap font-bold">
                        <span className="text-black hover:underline inline-flex items-center gap-1 text-[11px]">
                          {t('complaintsRegistry.audit')} <HiChevronRight className="w-3.5 h-3.5" />
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
