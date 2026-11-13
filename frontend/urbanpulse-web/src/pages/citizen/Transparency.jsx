import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { makeApiCall, apiClient } from '../../services/api'
import toast from 'react-hot-toast'
import { Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  Title, Tooltip, Legend
} from 'chart.js'
import { getCategoryLabel } from '../../utils/priorityUtils'
import StatusDoughnutChart from '../../components/StatusDoughnutChart'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

export default function Transparency() {
  const { t } = useTranslation(['citizen', 'admin', 'complaint'])
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await makeApiCall(apiClient.transparency.data)
        if (res?.success && res.data) {
          setData(res.data)
        } else {
          throw new Error(res?.message || 'Failed to load transparency data')
        }
      } catch {
        toast.error(t('transparency.loadFailed'))
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 font-mono text-xs text-neutral-500">
        {t('transparency.compiling')}
      </div>
    )
  }

  const complaints = data?.complaints || {}
  const total = complaints.total ?? data?.totalComplaints ?? 0
  const resolved = complaints.resolved ?? data?.resolvedComplaints ?? 0
  const pending = complaints.pending ?? data?.pendingComplaints ?? 0
  const inProgress = complaints.inProgress ?? data?.inProgressComplaints ?? 0
  const resolutionRate = complaints.resolutionRate ?? data?.resolutionRate ?? (total > 0 ? Math.round((resolved / total) * 100) : 0)
  const avgResolutionDays = complaints.avgResolutionDays ?? data?.avgResolutionDays ?? (data?.avgResolutionTime > 0 ? data.avgResolutionTime : 2.5)

  // High contrast architectural palette
  const doughnutData = {
    labels: [t('admin:status.resolved'), t('admin:status.pending'), t('admin:status.inProgress')],
    datasets: [{
      data: [resolved, pending, inProgress],
      backgroundColor: ['#111827', '#6B7280', '#D1D5DB'],
      borderColor: '#FFFFFF',
      borderWidth: 2,
    }]
  }

  let catLabels = []
  let catValues = []
  if (Array.isArray(data?.categoryStats) && data.categoryStats.length > 0) {
    catLabels = data.categoryStats.map(c => getCategoryLabel(c.name || c.category || '', t).toUpperCase())
    catValues = data.categoryStats.map(c => c.total || 0)
  } else {
    const categoryData = data?.complaintsbyCategory || data?.byCategory || {}
    catLabels = Object.keys(categoryData).map(l => getCategoryLabel(l, t).toUpperCase())
    catValues = Object.values(categoryData)
  }

  const barData = {
    labels: catLabels,
    datasets: [{
      label: t('transparency.incidents'),
      data: catValues,
      backgroundColor: '#111827',
      borderRadius: 0,
    }]
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-4 sm:p-6 lg:p-8 pb-12">
      {/* Header */}
      <div className="border-b border-black pb-4">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs text-neutral-500 uppercase tracking-widest mb-1">
          <span>{t('transparency.breadcrumbPublic')}</span>
          <span>/</span>
          <span>{t('transparency.breadcrumbAudit')}</span>
          <span>/</span>
          <span className="text-black font-semibold">{t('transparency.breadcrumbAccountability')}</span>
        </div>
        <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 uppercase">
          {t('transparency.title')}
        </h1>
        <p className="text-sm text-neutral-600 mt-1 font-sans">
          {t('transparency.subtitle')}
        </p>
      </div>

      {/* KPI Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: t('transparency.stats.totalDispatches.label'), value: total, sub: t('transparency.stats.totalDispatches.sub') },
          { label: t('transparency.stats.resolvedAudited.label'), value: resolved, sub: t('transparency.stats.resolvedAudited.sub') },
          { label: t('transparency.stats.pendingAction.label'), value: pending, sub: t('transparency.stats.pendingAction.sub') },
          { label: t('transparency.stats.resolutionRate.label'), value: `${resolutionRate}%`, sub: t('transparency.stats.resolutionRate.sub') },
        ].map(s => (
          <div key={s.label} className="border border-neutral-200 bg-white p-4 sm:p-5 font-mono">
            <span className="text-[10px] text-neutral-500 uppercase tracking-wider block mb-1">
              {s.label}
            </span>
            <div className="text-2xl sm:text-3xl font-bold text-neutral-900 tracking-tight">
              {s.value}
            </div>
            <span className="text-[11px] text-neutral-400 block mt-1">
              {s.sub}
            </span>
          </div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Status Breakdown */}
        <div className="border border-neutral-200 bg-white p-4 sm:p-6 flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 pb-3 mb-4 font-mono text-xs">
            <span className="font-bold uppercase tracking-wider text-neutral-900">
              {t('transparency.statusDistribution')}
            </span>
            <span className="text-neutral-500">{t('transparency.proportionalAudit')}</span>
          </div>
          {total > 0 ? (
            <StatusDoughnutChart data={doughnutData} maxChartWidth="max-w-[260px]" />
          ) : (
            <p className="text-neutral-400 font-mono text-xs text-center py-12">
              {t('transparency.noIncidentData')}
            </p>
          )}
        </div>

        {/* Category Breakdown */}
        <div className="border border-neutral-200 bg-white p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 pb-3 mb-4 font-mono text-xs">
            <span className="font-bold uppercase tracking-wider text-neutral-900">
              {t('transparency.byTaxonomy')}
            </span>
            <span className="text-neutral-500">{t('transparency.frequencyAnalysis')}</span>
          </div>
          {catLabels.length > 0 ? (
            <div className="pt-2">
              <Bar
                data={barData}
                options={{
                  responsive: true,
                  plugins: {
                    legend: { display: false }
                  },
                  scales: {
                    x: {
                      ticks: { font: { family: 'monospace', size: 9 } },
                      grid: { display: false },
                    },
                    y: {
                      beginAtZero: true,
                      ticks: { stepSize: 1, font: { family: 'monospace', size: 10 } },
                      grid: { color: '#F3F4F6' }
                    }
                  }
                }}
              />
            </div>
          ) : (
            <p className="text-neutral-400 font-mono text-xs text-center py-12">
              {t('transparency.noTaxonomyData')}
            </p>
          )}
        </div>
      </div>

      {/* Turnaround speed banner */}
      <div className="border border-black bg-neutral-900 text-white p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 font-mono">
        <div>
          <span className="text-[10px] text-neutral-400 tracking-widest uppercase block mb-1">
            {t('transparency.avgVelocity')}
          </span>
          <div className="text-2xl font-bold tracking-tight">
            {avgResolutionDays != null
              ? t('transparency.daysLabel', { days: avgResolutionDays })
              : '—'}
          </div>
          <p className="text-xs text-neutral-400 font-sans mt-0.5">
            {t('transparency.turnaroundDesc')}
          </p>
        </div>

        <div className="border border-neutral-700 px-4 py-2 text-xs text-neutral-300">
          {t('transparency.slaCompliance')}{' '}
          <span className="text-white font-bold">
            {data?.slaCompliance !== undefined
              ? `${data.slaCompliance}%`
              : total > 0
                ? `${resolutionRate}%`
                : '—'}
          </span>
        </div>
      </div>
    </div>
  )
}
