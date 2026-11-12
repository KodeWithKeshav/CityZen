import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { HiPlus, HiOfficeBuilding, HiTruck } from 'react-icons/hi'
import { makeApiCall, apiClient } from '../../services/api'

const TABS = ['departments', 'contractors']

/**
 * Basic CRUD directory for the municipal workforce (departments and
 * contractors) that the admin Complaint Workflow panel assigns complaints
 * to. See database/create_municipal_workforce_tables.sql for the schema
 * and routes/adminMinimal.js for the backing endpoints.
 *
 * Deliberately no officer directory here -- department + contractor is
 * enough for this workflow, kept simple on purpose.
 */
export default function DepartmentsAndStaff() {
  const { t } = useTranslation('admin')
  const [tab, setTab] = useState('departments')
  const [loading, setLoading] = useState(true)
  const [departments, setDepartments] = useState([])
  const [contractors, setContractors] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [dRes, cRes] = await Promise.all([
        makeApiCall(apiClient.admin.departments),
        makeApiCall(apiClient.admin.contractors),
      ])
      if (dRes?.success) setDepartments(dRes.data || [])
      if (cRes?.success) setContractors(cRes.data || [])
    } catch (err) {
      toast.error(err.message || t('workforce.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => { loadAll() }, [loadAll])

  const openForm = () => { setForm({}); setShowForm(true) }

  const handleCreate = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      let res
      if (tab === 'departments') {
        res = await makeApiCall(apiClient.admin.departments, { method: 'POST', body: JSON.stringify({ name: form.name }) })
      } else {
        res = await makeApiCall(apiClient.admin.contractors, {
          method: 'POST',
          body: JSON.stringify({
            name: form.name,
            specialization: form.specialization || null,
            phone: form.phone || null,
            email: form.email || null,
          }),
        })
      }
      if (res?.success) {
        toast.success(t('workforce.created'))
        setShowForm(false)
        loadAll()
      } else {
        toast.error(res?.message || t('workforce.createFailed'))
      }
    } catch (err) {
      toast.error(err.message || t('workforce.createFailed'))
    } finally {
      setSaving(false)
    }
  }

  const toggleContractorStatus = async (contractor) => {
    const nextStatus = contractor.status === 'active' ? 'inactive' : 'active'
    const res = await makeApiCall(apiClient.admin.contractorStatus(contractor.id), { method: 'PUT', body: JSON.stringify({ status: nextStatus }) })
    if (res?.success) { toast.success(t('workforce.statusUpdated')); loadAll() }
    else toast.error(res?.message || t('workforce.updateFailed'))
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 p-4 sm:p-6 lg:p-8 pb-12">
      <div className="border-b border-black pb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 uppercase">
            {t('workforce.title')}
          </h1>
          <p className="text-sm text-neutral-600 mt-1 font-sans">{t('workforce.subtitle')}</p>
        </div>
        <button
          onClick={openForm}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-black text-white font-mono text-xs font-bold uppercase tracking-wider hover:bg-neutral-800"
        >
          <HiPlus className="w-4 h-4" /> {t(`workforce.add.${tab}`)}
        </button>
      </div>

      <div className="flex gap-2 font-mono text-xs uppercase tracking-wider">
        {TABS.map(tKey => (
          <button
            key={tKey}
            onClick={() => setTab(tKey)}
            className={`px-3 py-1.5 border font-bold ${tab === tKey ? 'bg-neutral-900 text-white border-black' : 'border-neutral-300 text-neutral-700 hover:border-black'}`}
          >
            {t(`workforce.tabs.${tKey}`)}
          </button>
        ))}
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="border border-black bg-white p-4 space-y-3">
          {tab === 'departments' && (
            <input required placeholder={t('workforce.fields.name')} value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border border-neutral-300 text-sm" />
          )}
          {tab === 'contractors' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input required placeholder={t('workforce.fields.name')} value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} className="px-3 py-2 border border-neutral-300 text-sm" />
              <input placeholder={t('workforce.fields.specialization')} value={form.specialization || ''} onChange={e => setForm({ ...form, specialization: e.target.value })} className="px-3 py-2 border border-neutral-300 text-sm" />
              <input placeholder={t('workforce.fields.phone')} value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} className="px-3 py-2 border border-neutral-300 text-sm" />
              <input placeholder={t('workforce.fields.email')} value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })} className="px-3 py-2 border border-neutral-300 text-sm" />
            </div>
          )}
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="px-4 py-2 bg-black text-white font-mono text-xs font-bold uppercase tracking-wider disabled:opacity-50">
              {saving ? t('workforce.saving') : t('workforce.save')}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border border-neutral-300 font-mono text-xs uppercase tracking-wider">
              {t('workforce.cancel')}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="border border-neutral-200 p-8 text-center font-mono text-xs text-neutral-500 bg-white">{t('workforce.loading')}</div>
      ) : (
        <div className="border border-neutral-200 bg-white divide-y divide-neutral-200">
          {tab === 'departments' && departments.map(d => (
            <div key={d.id} className="p-3 flex items-center gap-3 font-mono text-xs">
              <HiOfficeBuilding className="w-4 h-4 text-neutral-500" />
              <span className="font-bold text-neutral-900 font-sans text-sm">{d.name}</span>
            </div>
          ))}
          {tab === 'contractors' && contractors.map(c => (
            <div key={c.id} className="p-3 flex flex-wrap items-center justify-between gap-3 font-mono text-xs">
              <div className="flex items-center gap-3">
                <HiTruck className="w-5 h-5 text-neutral-500" />
                <div>
                  <div className="font-bold text-neutral-900 font-sans text-sm">{c.name}</div>
                  <div className="text-neutral-500">{c.specialization || '—'}</div>
                </div>
              </div>
              <button
                onClick={() => toggleContractorStatus(c)}
                className={`px-2 py-1 border font-bold uppercase ${c.status === 'active' ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : 'border-neutral-300 bg-neutral-50 text-neutral-600'}`}
              >
                {t(`workforce.status.${c.status}`)}
              </button>
            </div>
          ))}
          {((tab === 'departments' && departments.length === 0) ||
            (tab === 'contractors' && contractors.length === 0)) && (
            <div className="p-8 text-center font-mono text-xs text-neutral-500">{t('workforce.empty')}</div>
          )}
        </div>
      )}
    </div>
  )
}
