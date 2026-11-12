import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { HiCheckCircle, HiExclamationCircle, HiUpload } from 'react-icons/hi'
import { makeApiCall, apiClient } from '../../services/api'
import { formatLocalizedDateTime } from '../../utils/dateLocale'

const STAGE_STATUSES = ['pending', 'in_progress', 'completed', 'cancelled']

// stage.stage_name from the backend is a stable key (initial_review /
// assessment / resolution), not display text -- resolve it through this
// map into a translated name instead of rendering the key (or English
// text) verbatim, so the stage heading actually changes with the
// selected language.
const stageNameKey = (stageName) => `complaintWorkflow.stageNames.${stageName}`

/**
 * Replaces the old flat 4-status-button "Admin Action Box" with the real
 * 3-stage municipal workflow (Initial Review -> Assessment -> Resolution)
 * that routes/adminMinimal.js already implements against the
 * complaint_workflow table -- department/contractor assignment, cost
 * estimate, SLA deadline, escalation, and resolution-proof photo upload.
 * See database/create_municipal_workforce_tables.sql for the schema this
 * depends on. (Officer assignment was deliberately left out -- department +
 * contractor is enough for this workflow; keeps the panel simple.)
 */
export default function ComplaintWorkflowPanel({ complaintId }) {
  const { t, i18n } = useTranslation('admin')
  const [loading, setLoading] = useState(true)
  const [workflow, setWorkflow] = useState(null)
  const [stages, setStages] = useState([])
  const [departments, setDepartments] = useState([])
  const [contractors, setContractors] = useState([])
  const [drafts, setDrafts] = useState({})
  const [savingStage, setSavingStage] = useState(null)
  const [uploadingStage, setUploadingStage] = useState(null)

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      // allSettled, not all: departments/contractors are secondary (just
      // populate dropdowns) and a department/contractor table that isn't
      // migrated yet shouldn't block the core workflow panel from
      // rendering, or surface an error toast of its own -- the dropdowns
      // simply come up empty until the migration
      // (database/create_municipal_workforce_tables.sql) is applied.
      const [detailsRes, deptRes, contractorsRes] = await Promise.allSettled([
        makeApiCall(apiClient.admin.workflowDetails(complaintId)),
        makeApiCall(apiClient.admin.departments),
        makeApiCall(apiClient.admin.contractors),
      ])

      const details = detailsRes.status === 'fulfilled' ? detailsRes.value : null
      if (details?.success && details.data) {
        setWorkflow(details.data.workflow_data || null)
        const loadedStages = details.data.complaint_stages || []
        setStages(loadedStages)
        const initialDrafts = {}
        loadedStages.forEach(s => {
          initialDrafts[s.id] = {
            status: s.stage_status || 'pending',
            notes: s.notes || '',
            contractorId: s.assigned_contractor_id || '',
            estimatedCost: s.estimated_cost ?? '',
            departmentId: details.data.workflow_data?.department_id || '',
            photos: Array.isArray(s.completion_photos) ? s.completion_photos : [],
          }
        })
        setDrafts(initialDrafts)
      } else {
        toast.error(detailsRes.reason?.message || details?.message || t('complaintWorkflow.loadFailed'))
      }

      if (deptRes.status === 'fulfilled' && deptRes.value?.success) setDepartments(deptRes.value.data || [])
      if (contractorsRes.status === 'fulfilled' && contractorsRes.value?.success) setContractors(contractorsRes.value.data || [])
    } finally {
      setLoading(false)
    }
  }, [complaintId, t])

  // Deliberately keyed on complaintId alone, not on loadAll's identity --
  // loadAll is recreated whenever the i18n `t` function's reference
  // changes (e.g. once translations finish loading), which would
  // otherwise refire this effect and double up the data load / any error
  // toast.
  useEffect(() => {
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complaintId])

  const setDraftField = (stageId, field, value) => {
    setDrafts(prev => ({ ...prev, [stageId]: { ...prev[stageId], [field]: value } }))
  }

  const saveStage = async (stageId) => {
    const draft = drafts[stageId] || {}
    setSavingStage(stageId)
    try {
      const body = {
        status: draft.status,
        notes: draft.notes,
      }
      if (stageId === 1) {
        body.department_id = draft.departmentId || null
      } else if (stageId === 2) {
        body.assigned_contractor_id = draft.contractorId || null
        body.estimated_cost = draft.estimatedCost === '' ? null : draft.estimatedCost
        body.department_id = draft.departmentId || null
      } else if (stageId === 3) {
        body.assigned_contractor_id = draft.contractorId || null
        body.completion_photos = draft.photos || []
      }

      const res = await makeApiCall(apiClient.admin.workflowStage(complaintId, stageId), {
        method: 'PUT',
        body: JSON.stringify(body),
      })

      if (res?.success) {
        const updatedStageName = stages.find(s => s.id === stageId)?.stage_name
        toast.success(t('complaintWorkflow.stageUpdated', { stage: updatedStageName ? t(stageNameKey(updatedStageName)) : '' }))
        loadAll()
      } else {
        toast.error(res?.message || t('complaintWorkflow.updateFailed'))
      }
    } catch (err) {
      toast.error(err.message || t('complaintWorkflow.updateFailed'))
    } finally {
      setSavingStage(null)
    }
  }

  const handlePhotoUpload = async (stageId, file) => {
    if (!file) return
    setUploadingStage(stageId)
    try {
      const CLOUDINARY_URL = import.meta.env.VITE_CLOUDINARY_URL || 'https://api.cloudinary.com/v1_1/dsvc9y4rq/image/upload'
      const CLOUDINARY_PRESET = import.meta.env.VITE_CLOUDINARY_PRESET || 'damage'
      const data = new FormData()
      data.append('file', file)
      data.append('upload_preset', CLOUDINARY_PRESET)
      const uploadController = new AbortController()
      const uploadTimeoutId = setTimeout(() => uploadController.abort(), 60000)
      let cloudRes
      try {
        cloudRes = await fetch(CLOUDINARY_URL, { method: 'POST', body: data, signal: uploadController.signal })
      } catch (uploadErr) {
        if (uploadErr.name === 'AbortError') {
          throw new Error('Upload timed out. Please check your connection and try again.')
        }
        throw uploadErr
      } finally {
        clearTimeout(uploadTimeoutId)
      }
      const cloudResult = await cloudRes.json().catch(() => ({}))
      if (!cloudRes.ok || !cloudResult.secure_url) {
        throw new Error(cloudResult?.error?.message || 'Upload failed')
      }
      setDrafts(prev => ({
        ...prev,
        [stageId]: { ...prev[stageId], photos: [...(prev[stageId]?.photos || []), cloudResult.secure_url] },
      }))
      toast.success(t('complaintWorkflow.photoUploaded'))
    } catch (err) {
      toast.error(err.message || t('complaintWorkflow.photoUploadFailed'))
    } finally {
      setUploadingStage(null)
    }
  }

  const escalate = async () => {
    try {
      const res = await makeApiCall(apiClient.admin.escalate(complaintId), { method: 'POST' })
      if (res?.success) {
        toast.success(res.message)
        loadAll()
      } else {
        toast.error(res?.message || t('complaintWorkflow.escalateFailed'))
      }
    } catch (err) {
      toast.error(err.message || t('complaintWorkflow.escalateFailed'))
    }
  }

  if (loading) {
    return (
      <div className="border border-black bg-white p-6 space-y-3 font-mono text-xs text-neutral-500">
        <div className="h-4 w-48 bg-neutral-200 animate-pulse" />
        <div className="h-24 bg-neutral-100 animate-pulse" />
      </div>
    )
  }

  const slaDeadline = workflow?.sla_deadline ? new Date(workflow.sla_deadline) : null
  const isOverdue = slaDeadline ? slaDeadline.getTime() < Date.now() : false
  const escalationLevel = workflow?.escalation_level || 0

  return (
    <div className="border border-black bg-white p-4 sm:p-6 md:p-8 space-y-6">
      <div className="border-b border-neutral-200 pb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-serif text-lg font-bold uppercase text-neutral-900">
            {t('complaintWorkflow.title')}
          </h3>
          <p className="text-xs font-mono text-neutral-500 mt-0.5">
            {t('complaintWorkflow.subtitle')}
          </p>
        </div>
        {slaDeadline && (
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1.5 border font-mono text-xs font-bold uppercase tracking-wider ${
              isOverdue ? 'bg-rose-50 border-rose-300 text-rose-900' : 'bg-emerald-50 border-emerald-300 text-emerald-900'
            }`}>
              {isOverdue ? t('complaintWorkflow.overdue') : t('complaintWorkflow.slaBy')}: {formatLocalizedDateTime(slaDeadline.toISOString(), i18n.language)}
            </span>
            {isOverdue && (
              <button
                type="button"
                onClick={escalate}
                className="px-3 py-1.5 border border-black bg-black text-white hover:bg-neutral-800 font-mono text-xs font-bold uppercase tracking-wider"
              >
                {t('complaintWorkflow.escalate')}{escalationLevel > 0 ? ` (${t('complaintWorkflow.level')} ${escalationLevel})` : ''}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="space-y-5">
        {stages.map(stage => {
          const draft = drafts[stage.id] || {}
          const isSaving = savingStage === stage.id
          const isUploading = uploadingStage === stage.id

          return (
            <div key={stage.id} className="border border-neutral-200">
              <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-neutral-50 border-b border-neutral-200">
                <span className="font-serif font-bold text-sm text-neutral-900">
                  {t('complaintWorkflow.stageLabel', { n: stage.stage_order })}: {t(stageNameKey(stage.stage_name))}
                </span>
                {draft.status === 'completed' && <HiCheckCircle className="w-5 h-5 text-emerald-600" />}
              </div>

              <div className="p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 font-mono text-xs">
                  <div>
                    <label className="block text-[10px] uppercase text-neutral-500 mb-1">{t('complaintWorkflow.status')}</label>
                    <select
                      value={draft.status}
                      onChange={e => setDraftField(stage.id, 'status', e.target.value)}
                      className="w-full px-2 py-1.5 border border-neutral-300 bg-white focus:outline-none focus:border-black"
                    >
                      {STAGE_STATUSES.map(s => (
                        <option key={s} value={s}>{t(`complaintWorkflow.statusOptions.${s}`)}</option>
                      ))}
                    </select>
                  </div>

                  {stage.id === 1 && (
                    <div>
                      <label className="block text-[10px] uppercase text-neutral-500 mb-1">{t('complaintWorkflow.department')}</label>
                      <select
                        value={draft.departmentId}
                        onChange={e => setDraftField(stage.id, 'departmentId', e.target.value)}
                        className="w-full px-2 py-1.5 border border-neutral-300 bg-white focus:outline-none focus:border-black"
                      >
                        <option value="">{t('complaintWorkflow.unassigned')}</option>
                        {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </div>
                  )}

                  {(stage.id === 2 || stage.id === 3) && (
                    <div>
                      <label className="block text-[10px] uppercase text-neutral-500 mb-1">{t('complaintWorkflow.contractor')}</label>
                      <select
                        value={draft.contractorId}
                        onChange={e => setDraftField(stage.id, 'contractorId', e.target.value)}
                        className="w-full px-2 py-1.5 border border-neutral-300 bg-white focus:outline-none focus:border-black"
                      >
                        <option value="">{t('complaintWorkflow.unassigned')}</option>
                        {contractors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                  )}

                  {stage.id === 2 && (
                    <div>
                      <label className="block text-[10px] uppercase text-neutral-500 mb-1">{t('complaintWorkflow.estimatedCost')}</label>
                      <input
                        type="number"
                        min="0"
                        value={draft.estimatedCost}
                        onChange={e => setDraftField(stage.id, 'estimatedCost', e.target.value)}
                        placeholder="₹"
                        className="w-full px-2 py-1.5 border border-neutral-300 focus:outline-none focus:border-black"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] uppercase text-neutral-500 mb-1 font-mono">{t('complaintWorkflow.notes')}</label>
                  <textarea
                    value={draft.notes}
                    onChange={e => setDraftField(stage.id, 'notes', e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-300 text-xs font-mono focus:outline-none focus:border-black h-20 resize-none"
                    placeholder={t('complaintWorkflow.notesPlaceholder')}
                  />
                </div>

                {stage.id === 3 && (
                  <div>
                    <label className="block text-[10px] uppercase text-neutral-500 mb-1.5 font-mono">
                      {t('complaintWorkflow.resolutionProof')}
                    </label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {(draft.photos || []).map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noreferrer" className="block w-16 h-16 border border-neutral-300 overflow-hidden">
                          <img src={url} alt="" className="w-full h-full object-cover" />
                        </a>
                      ))}
                    </div>
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-neutral-300 hover:border-black font-mono text-[11px] uppercase tracking-wider cursor-pointer">
                      <HiUpload className="w-3.5 h-3.5" />
                      {isUploading ? t('complaintWorkflow.uploading') : t('complaintWorkflow.uploadPhoto')}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={isUploading}
                        onChange={e => handlePhotoUpload(stage.id, e.target.files?.[0])}
                      />
                    </label>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => saveStage(stage.id)}
                  disabled={isSaving}
                  className="px-4 py-2 bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-50 font-mono text-xs font-bold uppercase tracking-wider"
                >
                  {isSaving ? t('complaintWorkflow.saving') : t('complaintWorkflow.saveStage')}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {stages.length === 0 && (
        <div className="flex items-center gap-2 text-xs font-mono text-neutral-500">
          <HiExclamationCircle className="w-4 h-4" />
          {t('complaintWorkflow.noWorkflow')}
        </div>
      )}
    </div>
  )
}
