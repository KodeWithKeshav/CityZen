import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { makeApiCall, apiClient } from '../../services/api'
import toast from 'react-hot-toast'
import { HiStar, HiCheckCircle } from 'react-icons/hi'

export default function FeedbackScreen() {
  const { t } = useTranslation('citizen')
  const [form, setForm] = useState({ rating: 0, category: '', message: '' })
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.rating === 0) { toast.error(t('feedback.ratingRequired')); return }
    if (!form.message.trim()) { toast.error(t('feedback.messageRequired')); return }
    setLoading(true)
    try {
      setTimeout(() => {
        setSubmitted(true)
        toast.success(t('feedback.recorded'))
        setLoading(false)
      }, 500)
    } catch (err) {
      toast.error(t('feedback.submissionFailed'))
      setLoading(false)
    }
  }

  if (submitted) return (
    <div className="max-w-xl mx-auto border border-neutral-300 bg-white p-12 text-center my-12">
      <div className="w-12 h-12 bg-black text-white flex items-center justify-center font-mono text-xl font-bold mx-auto mb-4">
        ✓
      </div>
      <h2 className="font-serif text-2xl font-bold text-neutral-900 uppercase">
        {t('feedback.successTitle')}
      </h2>
      <p className="text-sm text-neutral-600 font-sans mt-2 max-w-md mx-auto">
        {t('feedback.successDesc')}
      </p>
      <button
        onClick={() => {
          setSubmitted(false)
          setForm({ rating: 0, category: '', message: '' })
        }}
        className="mt-8 px-6 py-2.5 bg-black text-white font-mono text-xs font-bold uppercase tracking-wider hover:bg-neutral-800"
      >
        {t('feedback.submitAdditional')}
      </button>
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="border-b border-black pb-4">
        <div className="flex items-center gap-2 font-mono text-xs text-neutral-500 uppercase tracking-widest mb-1">
          <span>{t('feedback.breadcrumbOversight')}</span>
          <span>/</span>
          <span>{t('feedback.breadcrumbTelemetry')}</span>
          <span>/</span>
          <span className="text-black font-semibold">{t('feedback.breadcrumbFeedback')}</span>
        </div>
        <h1 className="font-serif text-3xl font-bold tracking-tight text-neutral-900 uppercase">
          {t('feedback.title')}
        </h1>
        <p className="text-sm text-neutral-600 mt-1 font-sans">
          {t('feedback.subtitle')}
        </p>
      </div>

      {/* Form Card */}
      <div className="border border-neutral-200 bg-white p-6 md:p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Rating */}
          <div>
            <label className="block font-mono text-xs uppercase tracking-wider text-neutral-700 mb-2">
              {t('feedback.scoreLabel')}
            </label>
            <div className="flex items-center gap-2 border border-neutral-200 p-4 bg-neutral-50">
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setForm(p => ({ ...p, rating: star }))}
                  className="p-1 hover:scale-110 transition-transform"
                >
                  <HiStar
                    className={`w-8 h-8 transition-colors ${
                      star <= form.rating ? 'text-amber-500' : 'text-neutral-300'
                    }`}
                  />
                </button>
              ))}
              {form.rating > 0 && (
                <span className="font-mono text-xs uppercase tracking-wider text-neutral-800 ml-3 font-bold">
                  {t('feedback.ratingLabels', { returnObjects: true })[form.rating]}
                </span>
              )}
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block font-mono text-xs uppercase tracking-wider text-neutral-700 mb-1">
              {t('feedback.focusVector')}
            </label>
            <select
              value={form.category}
              onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
              className="w-full px-3 py-2 border border-neutral-300 rounded-none text-xs font-mono uppercase bg-white focus:outline-none focus:border-black"
            >
              <option value="">{t('feedback.selectDomain')}</option>
              <option value="app_usability">{t('feedback.domainUsability')}</option>
              <option value="complaint_process">{t('feedback.domainProcess')}</option>
              <option value="response_time">{t('feedback.domainResponseTime')}</option>
              <option value="general">{t('feedback.domainGeneral')}</option>
            </select>
          </div>

          {/* Message */}
          <div>
            <label className="block font-mono text-xs uppercase tracking-wider text-neutral-700 mb-1">
              {t('feedback.remarksLabel')}
            </label>
            <textarea
              value={form.message}
              onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
              placeholder={t('feedback.remarksPlaceholder')}
              className="w-full px-3 py-2 border border-neutral-300 rounded-none text-sm font-sans focus:outline-none focus:border-black h-32 resize-none"
              maxLength={500}
            />
            <div className="text-right font-mono text-[11px] text-neutral-400 mt-1">
              {t('feedback.charsCount', { count: form.message.length })}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-black text-white font-mono text-xs font-bold uppercase tracking-wider hover:bg-neutral-800 disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>{t('feedback.recording')}</span>
              </>
            ) : (
              <span>{t('feedback.submit')}</span>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
