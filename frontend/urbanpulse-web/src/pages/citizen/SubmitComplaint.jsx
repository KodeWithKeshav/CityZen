import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { makeApiCall, apiClient } from '../../services/api'
import toast from 'react-hot-toast'
import { HiCheckCircle, HiArrowRight, HiArrowLeft } from 'react-icons/hi'

const ISSUE_TYPES = [
  { value: 'pothole', label: '🕳️ Pothole', desc: 'Road damage' },
  { value: 'broken_streetlight', label: '💡 Streetlight', desc: 'Broken / not working' },
  { value: 'garbage_collection', label: '🗑️ Garbage', desc: 'Collection issue' },
  { value: 'sewage_overflow', label: '💧 Sewage', desc: 'Overflow/blockage' },
  { value: 'water_main_break', label: '🚰 Water', desc: 'Pipe break' },
  { value: 'fire_hazard', label: '🔥 Fire Hazard', desc: 'Dangerous situation' },
  { value: 'electrical_danger', label: '⚡ Electrical', desc: 'Dangerous wires' },
  { value: 'traffic_signal', label: '🚦 Traffic Signal', desc: 'Not working' },
  { value: 'road_damage', label: '🛣️ Road Damage', desc: 'General damage' },
  { value: 'illegal_parking', label: '🚗 Parking', desc: 'Obstruction' },
  { value: 'noise_complaint', label: '🔊 Noise', desc: 'Noise pollution' },
  { value: 'structural_damage', label: '🏗️ Structure', desc: 'Building damage' },
  { value: 'others', label: '📋 Other', desc: 'Other issues' },
]

const PRIVACY_LEVELS = [
  { value: 'exact', label: '📍 Exact', desc: '±5-10m precision' },
  { value: 'street', label: '🛣️ Street-Level', desc: '±25m precision' },
  { value: 'area', label: '🏘️ Neighborhood', desc: '±150m precision' },
]

const STEPS = ['Issue Type', 'Details', 'Location', 'Review']

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
  })

  const setField = (field, val) => setForm(p => ({ ...p, [field]: val }))
  const setLocField = (field, val) => setForm(p => ({ ...p, location: { ...p.location, [field]: val } }))
  const [validatingImage, setValidatingImage] = useState(false)

  const handleImageUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    setValidatingImage(true)
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
      setField('imageUrl', uploadedUrl)

      // 2. Validate Image AI Call
      const result = await makeApiCall(apiClient.imageAnalysis.validate, {
        method: 'POST',
        body: JSON.stringify({ imageUrl: uploadedUrl }),
      })

      // 3. Extract Classification and set IssueType
      const fullRespStr = JSON.stringify(result).toLowerCase()
      const textToMatch = (result.message || fullRespStr).toLowerCase()

      if (result.allowUpload !== false) {
        let detected = 'others'
        
        // Manual heuristics for common variations
        if (textToMatch.includes('pothole') || textToMatch.includes('pathole') || textToMatch.includes('path-hole') || textToMatch.includes('crater')) detected = 'pothole'
        else if (textToMatch.includes('water') || textToMatch.includes('leak') || textToMatch.includes('pipe')) detected = 'water_main_break'
        else if (textToMatch.includes('garbage') || textToMatch.includes('trash') || textToMatch.includes('waste') || textToMatch.includes('dump')) detected = 'garbage_collection'
        else if (textToMatch.includes('sewage') || textToMatch.includes('drain')) detected = 'sewage_overflow'
        else if (textToMatch.includes('street') || textToMatch.includes('light') || textToMatch.includes('lamp')) detected = 'broken_streetlight'
        else if (textToMatch.includes('road') || textToMatch.includes('crack') || textToMatch.includes('damage')) detected = 'road_damage'
        else if (textToMatch.includes('fire') || textToMatch.includes('smoke') || textToMatch.includes('burn')) detected = 'fire_hazard'
        else if (textToMatch.includes('electric') || textToMatch.includes('wire') || textToMatch.includes('pole') || textToMatch.includes('cable')) detected = 'electrical_danger'
        else if (textToMatch.includes('traffic') || textToMatch.includes('signal')) detected = 'traffic_signal'
        else if (textToMatch.includes('park')) detected = 'illegal_parking'
        else if (textToMatch.includes('noise') || textToMatch.includes('sound')) detected = 'noise_complaint'
        else if (textToMatch.includes('structure') || textToMatch.includes('build')) detected = 'structural_damage'
        else {
          // Fallback exact match against our types
          const found = ISSUE_TYPES.find(it => textToMatch.includes(it.value.replace('_', ' ')) || textToMatch.includes(it.label.toLowerCase()))
          if (found) detected = found.value
        }
        
        setForm(p => ({ ...p, issueType: detected, aiConfidence: result.confidence || result.modelConfidence }))
        toast.success(`AI identified: ${(ISSUE_TYPES.find(i => i.value === detected)?.label || detected).replace('✅', '')} (Raw: ${textToMatch})`)
        setStep(1) // auto-advance
      } else {
        toast.error(`Image rejected. Raw API response was: ${textToMatch.substring(0, 50)}...`)
      }

    } catch (err) {
      toast.error('Image analysis failed: ' + err.message)
    } finally {
      setValidatingImage(false)
    }
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
        imageValidation: form.aiConfidence ? { allowUpload: true, confidence: form.aiConfidence } : undefined
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
    if (step === 1) return form.title.length >= 3 && form.description.length >= 10
    if (step === 2) return !!(form.location.latitude && form.location.longitude)
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
        {/* Step 0: Issue Type & Image Validation */}
        {step === 0 && (
          <div className="space-y-6">
            <div className="bg-primary-50 rounded-2xl p-6 border-2 border-dashed border-primary-200 text-center">
              <h2 className="font-bold text-primary-800 mb-2">Upload Photo for AI Auto-Detection</h2>
              <p className="text-sm text-primary-600 mb-4">Our AI will analyze the photo and automatically select the category for you.</p>
              <label className="btn-primary inline-flex cursor-pointer shadow-none">
                {validatingImage ? (
                  <span className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Validating...</span>
                ) : (
                  <span>📸 Upload Photo</span>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={validatingImage} />
              </label>
            </div>

            <div className="flex items-center gap-4">
              <div className="h-px bg-gray-200 flex-1"></div>
              <span className="text-sm font-medium text-gray-400 uppercase">OR SELECT MANUALLY</span>
              <div className="h-px bg-gray-200 flex-1"></div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {ISSUE_TYPES.map(it => (
                <button
                  key={it.value}
                  onClick={() => setField('issueType', it.value)}
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

        {/* Step 1: Details */}
        {step === 1 && (
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <select value={form.priority} onChange={e => setField('priority', e.target.value)} className="input">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Image URL (optional)</label>
              <input
                value={form.imageUrl}
                onChange={e => setField('imageUrl', e.target.value)}
                placeholder="https://... (paste image link)"
                className="input"
              />
            </div>
          </div>
        )}

        {/* Step 2: Location */}
        {step === 2 && (
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
              {locLoading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" /> : '📍 Detect My Location'}
            </button>

            {form.location.address && (
              <div className="bg-primary-50 rounded-xl p-3 text-sm text-primary-800">
                <p className="font-medium">📍 Location detected</p>
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

        {/* Step 3: Review */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="font-bold text-gray-800 mb-2">Review your report</h2>
            {[
              { label: 'Issue Type', value: ISSUE_TYPES.find(i => i.value === form.issueType)?.label },
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
            {loading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" /> : '✅ Submit Report'}
          </button>
        )}
      </div>
    </div>
  )
}
