// SubmitComplaint - Multi-step wizard: issue type -> photo validation -> description -> location -> review
// Both the photo (must match the selected issue) and the description (must
// match the selected/detected issue) are hard-validated by the backend —
// there is no "submit anyway" override for a mismatched photo or text.
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { makeApiCall, apiClient } from '../../services/api'
import toast from 'react-hot-toast'
import { HiCheckCircle, HiArrowRight, HiArrowLeft, HiExclamation, HiXCircle } from 'react-icons/hi'

// Kept in sync with the civic issue classes the CityZen SAM3 image workflow
// can detect and classify (services/imageAnalysisService.js CIVIC_ISSUE_LABELS
// on the backend).
const ISSUE_TYPES = [
  { value: 'pothole', label: 'Pothole', desc: 'Road damage' },
  { value: 'fallen_tree', label: 'Fallen Tree', desc: 'Blocking a road' },
  { value: 'garbage_dumping', label: 'Garbage Dumping', desc: 'Illegal dumping' },
  { value: 'stray_cattle', label: 'Stray Cattle', desc: 'Blocking a road' },
  { value: 'fallen_electric_pole', label: 'Fallen Electric Pole', desc: 'Downed pole or line' },
  { value: 'concrete_structure_damage', label: 'Structural Damage', desc: 'Cracked or broken concrete' },
  { value: 'road_waterlogging', label: 'Road Waterlogging', desc: 'Flooded roadway' },
  { value: 'others', label: 'Other', desc: 'Other issues' },
]

const PRIVACY_LEVELS = [
  { value: 'exact', label: 'Exact', desc: '+/-5-10m precision' },
  { value: 'street', label: 'Street-Level', desc: '+/-25m precision' },
  { value: 'area', label: 'Neighborhood', desc: '+/-150m precision' },
]

const STEPS = ['Issue Type', 'Photo', 'Details', 'Location', 'Review']

const DESCRIPTION_MIN_LENGTH_FOR_ANALYSIS = 15

export default function SubmitComplaint() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [locLoading, setLocLoading] = useState(false)
  const [form, setForm] = useState({
    issueType: '',
    title: '',
    description: '',
    priority: 'medium',
    location: { latitude: '', longitude: '', address: '', privacyLevel: 'street' },
    imageUrl: '',
    aiConfidence: null,
    imagePrimaryClass: null,
  })

  const setField = (field, val) => setForm(p => ({ ...p, [field]: val }))
  const setLocField = (field, val) => setForm(p => ({ ...p, location: { ...p.location, [field]: val } }))

  // Photo step state
  const [validatingImage, setValidatingImage] = useState(false)
  const [imageValidated, setImageValidated] = useState(false) // true only once the photo matches form.issueType
  const [imageError, setImageError] = useState(null)
  const [photoSkipped, setPhotoSkipped] = useState(false)

  // Text authenticity/correctness + sentiment analysis for the description,
  // checked against the selected/detected issue category.
  const [contentAnalysis, setContentAnalysis] = useState(null)
  const [analyzingText, setAnalyzingText] = useState(false)
  const analysisTimer = useRef(null)

  const resetImageState = () => {
    setField('imageUrl', '')
    setField('aiConfidence', null)
    setField('imagePrimaryClass', null)
    setImageValidated(false)
    setImageError(null)
  }

  // If the issue type changes after a photo was already validated against
  // the old type, the match no longer holds — force re-validation.
  const changeIssueType = (value) => {
    setField('issueType', value)
    if (imageValidated || imageError) resetImageState()
    setPhotoSkipped(false)
    setContentAnalysis(null)
  }

  const handleImageUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (!form.issueType) {
      toast.error('Select an issue type first')
      return
    }

    setValidatingImage(true)
    setImageError(null)
    setImageValidated(false)
    try {
      // 1. Upload to Cloudinary
      const CLOUDINARY_URL = 'https://api.cloudinary.com/v1_1/dsvc9y4rq/image/upload'
      const data = new FormData()
      data.append('file', file)
      data.append('upload_preset', 'damage')
      const cloudRes = await fetch(CLOUDINARY_URL, { method: 'POST', body: data })
      const cloudResult = await cloudRes.json()
      if (!cloudResult.secure_url) throw new Error('Cloudinary upload failed')

      const uploadedUrl = cloudResult.secure_url

      // 2. Validate the photo against the ALREADY-SELECTED issue type —
      // the backend rejects (allowUpload: false) if the photo shows a
      // different civic issue.
      const result = await makeApiCall(apiClient.imageAnalysis.validate, {
        method: 'POST',
        body: JSON.stringify({ imageUrl: uploadedUrl, category: form.issueType }),
      })

      if (result.allowUpload === true) {
        setForm(p => ({ ...p, imageUrl: uploadedUrl, aiConfidence: result.confidence, imagePrimaryClass: result.primaryClass }))
        setImageValidated(true)
        setPhotoSkipped(false)
        toast.success(result.message || 'Photo matches the selected issue')
      } else {
        setField('imageUrl', uploadedUrl) // keep for display, but block progression
        setImageValidated(false)
        setImageError(result.message || 'This photo does not match the selected issue type. Please upload a different photo.')
      }
    } catch (err) {
      setImageError('Image analysis failed: ' + err.message)
    } finally {
      setValidatingImage(false)
    }
  }

  // Debounced authenticity + sentiment check whenever the description (or
  // the selected category) changes on the Details step.
  useEffect(() => {
    if (step !== 2) return
    if (form.description.trim().length < DESCRIPTION_MIN_LENGTH_FOR_ANALYSIS) {
      setContentAnalysis(null)
      return
    }

    if (analysisTimer.current) clearTimeout(analysisTimer.current)
    analysisTimer.current = setTimeout(async () => {
      setAnalyzingText(true)
      try {
        const result = await makeApiCall(apiClient.complaints.analyzeText, {
          method: 'POST',
          body: JSON.stringify({
            description: form.description,
            category: form.issueType,
            imagePrimaryClass: form.imagePrimaryClass,
          }),
        })
        setContentAnalysis(result.authenticity)
      } catch (err) {
        // Non-blocking: if the check fails, don't stop the citizen from typing
        console.error('Text analysis failed:', err)
      } finally {
        setAnalyzingText(false)
      }
    }, 800)

    return () => { if (analysisTimer.current) clearTimeout(analysisTimer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.description, form.issueType, step])

  const applySuggestedCategory = () => {
    if (!contentAnalysis?.suggestedCategory) return
    changeIssueType(contentAnalysis.suggestedCategory)
    setStep(0)
    toast('Go re-check the photo for the new category, then re-enter the description.', { icon: 'ℹ️' })
  }

  const detectLocation = () => {
    if (!navigator.geolocation) { toast.error('Geolocation not supported'); return }
    setLocLoading(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords
        setLocField('latitude', latitude)
        setLocField('longitude', longitude)
        try {
          const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`)
          const d = await r.json()
          setLocField('address', d.display_name || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`)
        } catch {
          setLocField('address', `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`)
        }
        setLocLoading(false)
        toast.success('Location detected!')
      },
      (err) => { toast.error('Location access denied'); setLocLoading(false) },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const handleSubmit = async () => {
    setLoading(true)
    try {
      const payload = {
        title: form.title,
        description: form.description,
        category: form.issueType,    // backend expects "category"
        complaintTitle: form.title,
        imageUrl: form.imageUrl || undefined,
        locationData: {
          latitude: parseFloat(form.location.latitude),
          longitude: parseFloat(form.location.longitude),
          address: form.location.address,
          privacyLevel: form.location.privacyLevel,
        },
        imageValidation: imageValidated
          ? { allowUpload: true, confidence: form.aiConfidence, categoryMatch: true, primaryClass: form.imagePrimaryClass }
          : undefined
      }
      const res = await makeApiCall(apiClient.complaints.submit, {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      if (res.success) {
        toast.success('Complaint submitted successfully!')
        navigate('/citizen/feed')
      }
    } catch (err) {
      toast.error(err.message || 'Submission failed')
    } finally {
      setLoading(false)
    }
  }

  const canNext = () => {
    if (step === 0) return !!form.issueType
    if (step === 1) return imageValidated || photoSkipped
    if (step === 2) {
      if (form.title.length < 3 || form.description.length < 10) return false
      if (contentAnalysis?.flagged) return false // hard block: no override
      return true
    }
    if (step === 3) return !!(form.location.latitude && form.location.longitude)
    return true
  }

  return (
    <div className="p-4 max-w-2xl mx-auto fade-in">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Submit a Report</h1>
        <p className="text-sm text-gray-500">Help improve your city</p>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2 flex-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0
              ${i < step ? 'bg-primary-700 text-white' : i === step ? 'bg-primary-100 text-primary-700 ring-2 ring-primary-700' : 'bg-gray-100 text-gray-400'}`}>
              {i < step ? <HiCheckCircle className="w-5 h-5" /> : i + 1}
            </div>
            <span className={`text-xs font-medium hidden sm:block ${i === step ? 'text-primary-700' : 'text-gray-400'}`}>{s}</span>
            {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 ${i < step ? 'bg-primary-700' : 'bg-gray-200'}`} />}
          </div>
        ))}
      </div>

      <div className="card min-h-64">
        {/* Step 0: Issue Type (selected first) */}
        {step === 0 && (
          <div className="space-y-4">
            <h2 className="font-bold text-gray-800 mb-2">What type of issue are you reporting?</h2>
            <p className="text-sm text-gray-500 mb-4">Pick the category first — you'll upload a photo of this specific issue next.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {ISSUE_TYPES.map(it => (
                <button
                  key={it.value}
                  onClick={() => changeIssueType(it.value)}
                  className={`p-3 rounded-xl border-2 text-left transition-all text-sm
                    ${form.issueType === it.value
                      ? 'border-primary-600 bg-primary-50'
                      : 'border-gray-200 hover:border-primary-300 hover:bg-gray-50'}`}
                >
                  <div className="font-medium text-gray-800">{it.label}</div>
                  <div className="text-gray-500 text-xs">{it.desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 1: Photo — validated against the already-selected issue type */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="font-bold text-gray-800 mb-1">
              Upload a photo of: <span className="text-primary-700">{ISSUE_TYPES.find(i => i.value === form.issueType)?.label}</span>
            </h2>
            <p className="text-sm text-gray-500 mb-2">Our AI checks that the photo actually shows this issue. A photo of something else will be rejected.</p>

            <div className="bg-primary-50 rounded-2xl p-6 border-2 border-dashed border-primary-200 text-center">
              <label className="btn-primary inline-flex cursor-pointer shadow-none">
                {validatingImage ? (
                  <span className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Validating...</span>
                ) : (
                  <span>{imageValidated ? 'Replace Photo' : 'Upload Photo'}</span>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={validatingImage} />
              </label>

              {imageValidated && (
                <div className="mt-4 flex items-center justify-center gap-2 text-sm text-primary-700 font-medium">
                  <HiCheckCircle className="w-5 h-5" />
                  Photo verified {typeof form.aiConfidence === 'number' && `(${(form.aiConfidence * 100).toFixed(0)}% confidence)`}
                </div>
              )}
            </div>

            {imageError && (
              <div className="rounded-xl p-4 text-sm border bg-red-50 border-red-200 text-red-800 flex items-start gap-2">
                <HiXCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Photo doesn't match</p>
                  <p className="text-xs mt-1">{imageError}</p>
                </div>
              </div>
            )}

            {!imageValidated && (
              <button
                onClick={() => { setPhotoSkipped(true); resetImageState() }}
                className="text-sm text-gray-400 hover:text-gray-600 underline w-full text-center"
              >
                I don't have a photo — continue without one
              </button>
            )}
            {photoSkipped && !imageValidated && (
              <p className="text-xs text-center text-gray-400">Continuing without a photo. You can still go back and add one.</p>
            )}
          </div>
        )}

        {/* Step 2: Details */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="font-bold text-gray-800 mb-2">Describe the issue</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
              <input
                value={form.title}
                onChange={e => setField('title', e.target.value)}
                placeholder="Brief title of the issue"
                className="input"
                maxLength={100}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
              <textarea
                value={form.description}
                onChange={e => setField('description', e.target.value)}
                placeholder="Describe the issue in detail (min 10 characters)"
                className="input h-28 resize-none"
                maxLength={1000}
              />
              <p className="text-xs text-gray-400 mt-1">{form.description.length}/1000</p>
            </div>

            {analyzingText && (
              <p className="text-xs text-gray-400 flex items-center gap-2">
                <div className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin"></div>
                Checking description against "{ISSUE_TYPES.find(i => i.value === form.issueType)?.label}"...
              </p>
            )}

            {contentAnalysis && (contentAnalysis.mismatchDetected || contentAnalysis.flagged) && (
              <div className={`rounded-xl p-4 text-sm border ${contentAnalysis.flagged ? 'bg-red-50 border-red-200 text-red-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
                <div className="flex items-start gap-2">
                  {contentAnalysis.flagged ? <HiXCircle className="w-5 h-5 flex-shrink-0 mt-0.5" /> : <HiExclamation className="w-5 h-5 flex-shrink-0 mt-0.5" />}
                  <div className="space-y-1">
                    <p className="font-medium">{contentAnalysis.flagged ? "This doesn't match the selected issue — please rewrite it" : 'Heads up'}</p>
                    {contentAnalysis.reasons.map((r, i) => <p key={i} className="text-xs">{r}</p>)}
                    {contentAnalysis.suggestedCategory && (
                      <button onClick={applySuggestedCategory} className="text-xs font-semibold underline mt-1">
                        Switch category to {ISSUE_TYPES.find(i => i.value === contentAnalysis.suggestedCategory)?.label || contentAnalysis.suggestedCategory} instead
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <select value={form.priority} onChange={e => setField('priority', e.target.value)} className="input">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>
        )}

        {/* Step 3: Location */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="font-bold text-gray-800 mb-2">Set location</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Privacy Level</label>
              <div className="grid grid-cols-3 gap-2">
                {PRIVACY_LEVELS.map(pl => (
                  <button
                    key={pl.value}
                    onClick={() => setLocField('privacyLevel', pl.value)}
                    className={`p-2.5 rounded-xl border-2 text-sm transition-all text-center
                      ${form.location.privacyLevel === pl.value
                        ? 'border-primary-600 bg-primary-50'
                        : 'border-gray-200 hover:border-primary-300'}`}
                  >
                    <div className="font-medium text-gray-800 text-xs">{pl.label}</div>
                    <div className="text-gray-400 text-xs">{pl.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <button onClick={detectLocation} disabled={locLoading} className="btn-primary w-full flex items-center justify-center gap-2">
              {locLoading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" /> : 'Detect My Location'}
            </button>

            {form.location.address && (
              <div className="bg-primary-50 rounded-xl p-3 text-sm text-primary-800">
                <p className="font-medium">Location detected</p>
                <p className="text-xs mt-1 text-primary-600">{form.location.address}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Latitude</label>
                <input value={form.location.latitude} onChange={e => setLocField('latitude', e.target.value)} placeholder="e.g. 13.0827" className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Longitude</label>
                <input value={form.location.longitude} onChange={e => setLocField('longitude', e.target.value)} placeholder="e.g. 80.2707" className="input" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address (optional)</label>
              <input value={form.location.address} onChange={e => setLocField('address', e.target.value)} placeholder="Street address" className="input" />
            </div>
          </div>
        )}

        {/* Step 4: Review */}
        {step === 4 && (
          <div className="space-y-4">
            <h2 className="font-bold text-gray-800 mb-2">Review your report</h2>
            {[
              { label: 'Issue Type', value: ISSUE_TYPES.find(i => i.value === form.issueType)?.label },
              { label: 'Photo', value: imageValidated ? 'Verified match' : 'Not provided' },
              { label: 'Title', value: form.title },
              { label: 'Priority', value: form.priority },
              { label: 'Location', value: form.location.address || `${form.location.latitude}, ${form.location.longitude}` },
            ].map(r => (
              <div key={r.label} className="flex gap-3 py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500 w-24 flex-shrink-0">{r.label}</span>
                <span className="text-sm text-gray-800 font-medium">{r.value}</span>
              </div>
            ))}
            <div className="py-2">
              <span className="text-sm text-gray-500 block mb-1">Description</span>
              <p className="text-sm text-gray-800">{form.description}</p>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex gap-3 mt-5">
        {step > 0 && (
          <button onClick={() => setStep(s => s - 1)} className="btn-secondary flex items-center gap-2">
            <HiArrowLeft className="w-4 h-4" /> Back
          </button>
        )}
        {step < STEPS.length - 1 ? (
          <button onClick={() => setStep(s => s + 1)} disabled={!canNext()} className="btn-primary flex items-center gap-2 ml-auto disabled:opacity-50 disabled:cursor-not-allowed">
            Next <HiArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button onClick={handleSubmit} disabled={loading || !canNext()} className="btn-primary flex items-center gap-2 ml-auto disabled:opacity-50">
            {loading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" /> : 'Submit Report'}
          </button>
        )}
      </div>
    </div>
  )
}

// End of SubmitComplaint component
