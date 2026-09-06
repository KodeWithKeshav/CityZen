import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { makeApiCall, apiClient } from '../../services/api'
import toast from 'react-hot-toast'
import {
  HiCheckCircle,
  HiArrowRight,
  HiArrowLeft,
  HiExclamation,
  HiXCircle,
  HiMicrophone,
  HiLocationMarker,
  HiUpload,
  HiShieldCheck
} from 'react-icons/hi'

const ISSUE_TYPES = [
  { value: 'pothole', label: 'POTHOLE', desc: 'Asphalt rupture, crater, or severe road decay' },
  { value: 'fallen_tree', label: 'FALLEN TREE', desc: 'Foliage or timber obstructing thoroughfare' },
  { value: 'garbage_dumping', label: 'GARBAGE DUMPING', desc: 'Illegal municipal or commercial waste deposit' },
  { value: 'stray_cattle', label: 'STRAY CATTLE', desc: 'Livestock impeding transit or vehicular corridors' },
  { value: 'fallen_electric_pole', label: 'FALLEN ELECTRIC POLE', desc: 'Damaged pole, exposed wiring, or transformer failure' },
  { value: 'concrete_structure_damage', label: 'STRUCTURAL DAMAGE', desc: 'Fissures, bridge wear, or pavement subsidence' },
  { value: 'road_waterlogging', label: 'ROAD WATERLOGGING', desc: 'Stagnant monsoon or burst main runoff' },
]

const PRIVACY_LEVELS = [
  { value: 'exact', label: 'EXACT GPS', desc: '±5–10m survey coordinate precision' },
  { value: 'street', label: 'STREET LEVEL', desc: '±25m corridor precision' },
  { value: 'area', label: 'NEIGHBORHOOD', desc: '±150m ward radius approximation' },
]

const STEPS = [
  { id: '01', title: 'CLASSIFICATION' },
  { id: '02', title: 'EVIDENCE' },
  { id: '03', title: 'NARRATIVE' },
  { id: '04', title: 'GEODATA' },
  { id: '05', title: 'AUDIT & SUBMIT' },
]

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
  const [imageValidated, setImageValidated] = useState(false)
  const [imageError, setImageError] = useState(null)
  const [photoSkipped, setPhotoSkipped] = useState(false)

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false)

  // Text authenticity/correctness analysis
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
      toast.error('Select an issue classification first')
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
      if (!cloudResult.secure_url) throw new Error('Image upload failed')

      const uploadedUrl = cloudResult.secure_url

      // 2. Validate photo against selected issue type using backend SAM3/AI check
      const result = await makeApiCall(apiClient.imageAnalysis.validate, {
        method: 'POST',
        body: JSON.stringify({ imageUrl: uploadedUrl, category: form.issueType }),
      })

      if (result.allowUpload === true) {
        setForm(p => ({
          ...p,
          imageUrl: uploadedUrl,
          aiConfidence: result.confidence,
          imagePrimaryClass: result.primaryClass
        }))
        setImageValidated(true)
        setPhotoSkipped(false)
        toast.success(result.message || 'Evidence validated against classification')
      } else {
        setField('imageUrl', uploadedUrl)
        setImageValidated(false)
        setImageError(result.message || 'The submitted image failed neural verification for this classification.')
      }
    } catch (err) {
      setImageError('Neural validation error: ' + err.message)
    } finally {
      setValidatingImage(false)
    }
  }

  // Debounced description text analysis
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
        console.error('Text validation failed:', err)
      } finally {
        setAnalyzingText(false)
      }
    }, 800)

    return () => { if (analysisTimer.current) clearTimeout(analysisTimer.current) }
  }, [form.description, form.issueType, step, form.imagePrimaryClass])

  const applySuggestedCategory = () => {
    if (!contentAnalysis?.suggestedCategory) return
    changeIssueType(contentAnalysis.suggestedCategory)
    setStep(0)
    toast('Switched classification. Review evidence and description.', { icon: 'ℹ️' })
  }

  // Voice dictation using Web Speech API (parity with React Native Sarvam Speech)
  const handleVoiceInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      toast.error('Voice dictation is not supported by your browser.')
      return
    }

    if (isRecording) {
      setIsRecording(false)
      return
    }

    try {
      const recognition = new SpeechRecognition()
      recognition.continuous = false
      recognition.interimResults = false
      recognition.lang = 'en-IN'

      recognition.onstart = () => {
        setIsRecording(true)
        toast('Listening for voice dictation...', { icon: '🎙️' })
      }

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript
        if (transcript) {
          setField('description', form.description ? `${form.description} ${transcript}` : transcript)
          toast.success('Voice transcription appended')
        }
      }

      recognition.onerror = (event) => {
        console.error('Speech error', event.error)
        setIsRecording(false)
        toast.error(`Voice error: ${event.error}`)
      }

      recognition.onend = () => {
        setIsRecording(false)
      }

      recognition.start()
    } catch (e) {
      setIsRecording(false)
      toast.error('Could not activate microphone')
    }
  }

  const detectLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation interface unavailable')
      return
    }
    setLocLoading(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords
        setLocField('latitude', latitude)
        setLocField('longitude', longitude)
        try {
          const r = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
          )
          const d = await r.json()
          setLocField('address', d.display_name || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`)
        } catch {
          setLocField('address', `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`)
        }
        setLocLoading(false)
        toast.success('Geographic coordinates verified')
      },
      () => {
        toast.error('Location telemetry permission denied')
        setLocLoading(false)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const handleSubmit = async () => {
    setLoading(true)
    try {
      const payload = {
        title: form.title,
        description: form.description,
        category: form.issueType,
        complaintTitle: form.title,
        imageUrl: form.imageUrl || undefined,
        locationData: {
          latitude: parseFloat(form.location.latitude),
          longitude: parseFloat(form.location.longitude),
          address: form.location.address,
          privacyLevel: form.location.privacyLevel,
        },
        imageValidation: imageValidated
          ? {
              allowUpload: true,
              confidence: form.aiConfidence,
              categoryMatch: true,
              primaryClass: form.imagePrimaryClass,
            }
          : undefined,
      }
      const res = await makeApiCall(apiClient.complaints.submit, {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      if (res.success) {
        toast.success('Civic incident registered successfully!')
        navigate('/citizen/feed')
      }
    } catch (err) {
      toast.error(err.message || 'Dispatch submission failed')
    } finally {
      setLoading(false)
    }
  }

  const canNext = () => {
    if (step === 0) return !!form.issueType
    if (step === 1) return imageValidated || photoSkipped
    if (step === 2) {
      if (form.title.length < 3 || form.description.length < 10) return false
      if (contentAnalysis?.flagged) return false
      return true
    }
    if (step === 3) return !!(form.location.latitude && form.location.longitude)
    return true
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header section */}
      <div className="border-b border-black pb-4 flex flex-col md:flex-row md:items-end justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 font-mono text-xs text-neutral-500 uppercase tracking-widest mb-1">
            <span>URBAN AUDIT</span>
            <span>/</span>
            <span>INCIDENT INTAKE</span>
            <span>/</span>
            <span className="text-black font-semibold">DISPATCH PROTOCOL</span>
          </div>
          <h1 className="font-serif text-3xl font-bold tracking-tight text-neutral-900 uppercase">
            File Incident Dispatch
          </h1>
          <p className="text-sm text-neutral-600 mt-1 font-sans">
            Formal submission ledger requiring neural visual validation and geospatial verification.
          </p>
        </div>
        <div className="font-mono text-xs text-neutral-500">
          STEP <span className="text-black font-bold">{step + 1}</span> OF {STEPS.length}
        </div>
      </div>

      {/* Stepper Timeline */}
      <div className="grid grid-cols-5 border border-neutral-200 bg-white">
        {STEPS.map((s, i) => (
          <div
            key={s.id}
            className={`p-3 border-r last:border-r-0 border-neutral-200 transition-colors ${
              i === step
                ? 'bg-neutral-900 text-white'
                : i < step
                ? 'bg-neutral-100 text-neutral-700'
                : 'bg-white text-neutral-400'
            }`}
          >
            <div className="flex items-center justify-between font-mono text-[10px] tracking-wider mb-1">
              <span>{s.id}</span>
              {i < step && <HiCheckCircle className="w-3.5 h-3.5 text-emerald-600" />}
            </div>
            <p className="font-mono text-xs font-semibold uppercase tracking-wider truncate">
              {s.title}
            </p>
          </div>
        ))}
      </div>

      {/* Step Form Box */}
      <div className="border border-neutral-200 bg-white p-6 md:p-8">
        {/* Step 0: Classification */}
        {step === 0 && (
          <div className="space-y-6">
            <div>
              <span className="font-mono text-xs text-neutral-500 uppercase tracking-wider block mb-1">
                STEP 01: TAXONOMY
              </span>
              <h2 className="font-serif text-xl font-bold text-neutral-900 uppercase">
                Select Municipal Incident Category
              </h2>
              <p className="text-sm text-neutral-600 mt-1 font-sans">
                Submissions must adhere to classified urban maintenance vectors for prompt routing.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {ISSUE_TYPES.map(it => {
                const isSelected = form.issueType === it.value
                return (
                  <button
                    key={it.value}
                    type="button"
                    onClick={() => changeIssueType(it.value)}
                    className={`p-4 border text-left transition-all ${
                      isSelected
                        ? 'border-black bg-neutral-900 text-white shadow-sm'
                        : 'border-neutral-200 hover:border-neutral-400 bg-white text-neutral-900'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-xs font-bold tracking-wider">
                        {it.label}
                      </span>
                      <div
                        className={`w-3.5 h-3.5 border ${
                          isSelected ? 'border-white bg-white' : 'border-neutral-300'
                        }`}
                      />
                    </div>
                    <p
                      className={`text-xs font-sans leading-relaxed ${
                        isSelected ? 'text-neutral-300' : 'text-neutral-500'
                      }`}
                    >
                      {it.desc}
                    </p>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Step 1: Neural Evidence Verification */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <span className="font-mono text-xs text-neutral-500 uppercase tracking-wider block mb-1">
                STEP 02: NEURAL AUDIT
              </span>
              <h2 className="font-serif text-xl font-bold text-neutral-900 uppercase">
                Upload Verification Evidence
              </h2>
              <p className="text-sm text-neutral-600 mt-1 font-sans">
                Target classification: <strong className="text-black uppercase">{ISSUE_TYPES.find(i => i.value === form.issueType)?.label}</strong>.
                Our backend vision model validates photographic veracity against this category.
              </p>
            </div>

            <div className="border-2 border-dashed border-neutral-300 p-8 text-center bg-neutral-50">
              <label className="cursor-pointer inline-flex flex-col items-center justify-center">
                <HiUpload className="w-8 h-8 text-neutral-600 mb-2" />
                <span className="font-mono text-xs uppercase tracking-wider font-bold text-neutral-900 bg-white px-4 py-2 border border-neutral-300 hover:border-black transition-colors">
                  {validatingImage
                    ? 'EVALUATING NEURAL MODEL...'
                    : imageValidated
                    ? 'REPLACE EVIDENCE PHOTO'
                    : 'SELECT PHOTOGRAPHIC FILE'}
                </span>
                <span className="text-[11px] font-mono text-neutral-500 mt-2">
                  JPG, PNG OR WEBP UP TO 10MB
                </span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                  disabled={validatingImage}
                />
              </label>

              {validatingImage && (
                <div className="mt-4 flex items-center justify-center gap-2 font-mono text-xs text-neutral-700">
                  <div className="w-3.5 h-3.5 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin" />
                  Running deep learning feature extraction &amp; classification match...
                </div>
              )}

              {imageValidated && form.imageUrl && (
                <div className="mt-6 border border-neutral-200 bg-white p-4 max-w-sm mx-auto">
                  <img
                    src={form.imageUrl}
                    alt="Verified civic evidence"
                    className="w-full h-48 object-cover border border-neutral-200 mb-3"
                  />
                  <div className="flex items-center justify-center gap-2 font-mono text-xs text-emerald-800 bg-emerald-50 py-1 border border-emerald-300">
                    <HiCheckCircle className="w-4 h-4 text-emerald-600" />
                    <span>
                      VERIFIED MATCH {typeof form.aiConfidence === 'number' && `(${(form.aiConfidence * 100).toFixed(0)}% CONFIDENCE)`}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {imageError && (
              <div className="border border-rose-300 bg-rose-50 p-4 flex items-start gap-3">
                <HiXCircle className="w-5 h-5 text-rose-700 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-mono text-xs font-bold uppercase text-rose-900 tracking-wider">
                    Neural Verification Rejected
                  </h4>
                  <p className="text-xs text-rose-800 font-sans mt-0.5">{imageError}</p>
                </div>
              </div>
            )}

            {!imageValidated && (
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setPhotoSkipped(true)
                    resetImageState()
                  }}
                  className="font-mono text-xs text-neutral-500 hover:text-black underline uppercase tracking-wider"
                >
                  Bypass photographic evidence (Requires manual municipal dispatch review)
                </button>
              </div>
            )}

            {photoSkipped && !imageValidated && (
              <div className="border border-neutral-200 bg-neutral-100 p-3 font-mono text-xs text-neutral-600 text-center">
                Visual proof bypassed. Proceeding to textual record.
              </div>
            )}
          </div>
        )}

        {/* Step 2: Details & Voice Input */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <span className="font-mono text-xs text-neutral-500 uppercase tracking-wider block mb-1">
                STEP 03: SPECIFICATION
              </span>
              <h2 className="font-serif text-xl font-bold text-neutral-900 uppercase">
                Incident Specifics &amp; Audio Input
              </h2>
              <p className="text-sm text-neutral-600 mt-1 font-sans">
                Provide comprehensive notes regarding the severity, obstruction level, and exact surroundings.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block font-mono text-xs uppercase tracking-wider text-neutral-700 mb-1">
                  INCIDENT TITLE *
                </label>
                <input
                  value={form.title}
                  onChange={e => setField('title', e.target.value)}
                  placeholder="e.g. Deep crater near pedestrian crosswalk on Anna Salai"
                  className="w-full px-3 py-2 border border-neutral-300 rounded-none text-sm font-sans focus:outline-none focus:border-black"
                  maxLength={100}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-mono text-xs uppercase tracking-wider text-neutral-700">
                    DESCRIPTION NARRATIVE *
                  </label>
                  <button
                    type="button"
                    onClick={handleVoiceInput}
                    className={`font-mono text-xs px-2.5 py-1 border flex items-center gap-1.5 transition-colors ${
                      isRecording
                        ? 'bg-rose-600 text-white border-rose-700 animate-pulse'
                        : 'border-neutral-300 text-neutral-700 hover:border-black'
                    }`}
                  >
                    <HiMicrophone className="w-3.5 h-3.5" />
                    <span>{isRecording ? 'RECORDING... (STOP)' : 'VOICE DICTATE'}</span>
                  </button>
                </div>
                <textarea
                  value={form.description}
                  onChange={e => setField('description', e.target.value)}
                  placeholder="Detail the circumstances, exact location clues, hazard factors, and immediate risks (min 10 chars)..."
                  className="w-full px-3 py-2 border border-neutral-300 rounded-none text-sm font-sans focus:outline-none focus:border-black h-32 resize-none"
                  maxLength={1000}
                />
                <div className="flex items-center justify-between mt-1 text-[11px] font-mono text-neutral-400">
                  <span>{analyzingText ? 'Analyzing narrative authenticity...' : 'Natural language semantic parsing active'}</span>
                  <span>{form.description.length}/1000 CHARS</span>
                </div>
              </div>

              {contentAnalysis && (contentAnalysis.mismatchDetected || contentAnalysis.flagged) && (
                <div className={`p-4 border ${contentAnalysis.flagged ? 'bg-rose-50 border-rose-300 text-rose-900' : 'bg-amber-50 border-amber-300 text-amber-900'}`}>
                  <div className="flex items-start gap-2">
                    {contentAnalysis.flagged ? (
                      <HiXCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-700" />
                    ) : (
                      <HiExclamation className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-700" />
                    )}
                    <div>
                      <h4 className="font-mono text-xs font-bold uppercase tracking-wider">
                        {contentAnalysis.flagged ? 'Semantic Inconsistency Detected' : 'Classification Advisory'}
                      </h4>
                      {contentAnalysis.reasons?.map((r, i) => (
                        <p key={i} className="text-xs font-sans mt-0.5">{r}</p>
                      ))}
                      {contentAnalysis.suggestedCategory && (
                        <button
                          type="button"
                          onClick={applySuggestedCategory}
                          className="mt-2 font-mono text-xs font-bold underline uppercase tracking-wider block"
                        >
                          Reassign category to {contentAnalysis.suggestedCategory.replace(/_/g, ' ')} →
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block font-mono text-xs uppercase tracking-wider text-neutral-700 mb-1">
                  ESTIMATED SEVERITY TIER
                </label>
                <select
                  value={form.priority}
                  onChange={e => setField('priority', e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-none text-xs font-mono uppercase bg-white focus:outline-none focus:border-black"
                >
                  <option value="low">LOW — COSMETIC OR NON-BLOCKING</option>
                  <option value="medium">MEDIUM — STANDARD DISPATCH PROTOCOL</option>
                  <option value="high">HIGH — POTENTIAL HAZARD OR TRAFFIC OBSTRUCTION</option>
                  <option value="critical">CRITICAL — DIRECT THREAT TO LIFE OR MAIN CORRIDOR</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Geodata */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <span className="font-mono text-xs text-neutral-500 uppercase tracking-wider block mb-1">
                STEP 04: GEOSPATIAL TELEMETRY
              </span>
              <h2 className="font-serif text-xl font-bold text-neutral-900 uppercase">
                Specify Incident Coordinates
              </h2>
              <p className="text-sm text-neutral-600 mt-1 font-sans">
                Accurate coordinates allow automated municipal ward assignment and nearest squad dispatch.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block font-mono text-xs uppercase tracking-wider text-neutral-700 mb-2">
                  TELEMETRY PRIVACY LEVEL
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {PRIVACY_LEVELS.map(pl => {
                    const isSelected = form.location.privacyLevel === pl.value
                    return (
                      <button
                        key={pl.value}
                        type="button"
                        onClick={() => setLocField('privacyLevel', pl.value)}
                        className={`p-3 border text-left transition-colors ${
                          isSelected
                            ? 'bg-neutral-900 text-white border-black'
                            : 'border-neutral-200 hover:border-neutral-400 bg-white text-neutral-800'
                        }`}
                      >
                        <div className="font-mono text-xs font-bold tracking-wider mb-0.5">
                          {pl.label}
                        </div>
                        <div className={`text-[11px] font-mono ${isSelected ? 'text-neutral-300' : 'text-neutral-500'}`}>
                          {pl.desc}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              <button
                type="button"
                onClick={detectLocation}
                disabled={locLoading}
                className="w-full py-3 bg-neutral-900 text-white text-xs font-mono font-bold uppercase tracking-wider hover:bg-neutral-800 flex items-center justify-center gap-2 border border-black"
              >
                <HiLocationMarker className="w-4 h-4" />
                <span>{locLoading ? 'ACQUIRING GNSS FIX...' : 'ACQUIRE CURRENT GNSS COORDINATES'}</span>
              </button>

              {form.location.address && (
                <div className="border border-neutral-200 bg-neutral-50 p-3 text-xs font-mono">
                  <div className="text-neutral-500 uppercase tracking-wider text-[10px] mb-1">
                    RESOLVED ADDRESS
                  </div>
                  <div className="text-neutral-900 font-semibold">{form.location.address}</div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-mono text-xs uppercase tracking-wider text-neutral-700 mb-1">
                    LATITUDE
                  </label>
                  <input
                    value={form.location.latitude}
                    onChange={e => setLocField('latitude', e.target.value)}
                    placeholder="e.g. 13.0827"
                    className="w-full px-3 py-2 border border-neutral-300 rounded-none text-xs font-mono focus:outline-none focus:border-black"
                  />
                </div>
                <div>
                  <label className="block font-mono text-xs uppercase tracking-wider text-neutral-700 mb-1">
                    LONGITUDE
                  </label>
                  <input
                    value={form.location.longitude}
                    onChange={e => setLocField('longitude', e.target.value)}
                    placeholder="e.g. 80.2707"
                    className="w-full px-3 py-2 border border-neutral-300 rounded-none text-xs font-mono focus:outline-none focus:border-black"
                  />
                </div>
              </div>

              <div>
                <label className="block font-mono text-xs uppercase tracking-wider text-neutral-700 mb-1">
                  LANDMARK / VICINITY REMARKS (OPTIONAL)
                </label>
                <input
                  value={form.location.address}
                  onChange={e => setLocField('address', e.target.value)}
                  placeholder="Near Post Office, Opposite Gate 2, etc."
                  className="w-full px-3 py-2 border border-neutral-300 rounded-none text-sm font-sans focus:outline-none focus:border-black"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Audit & Submit */}
        {step === 4 && (
          <div className="space-y-6">
            <div>
              <span className="font-mono text-xs text-neutral-500 uppercase tracking-wider block mb-1">
                STEP 05: CONCURRENCE
              </span>
              <h2 className="font-serif text-xl font-bold text-neutral-900 uppercase">
                Audit Incident Package
              </h2>
              <p className="text-sm text-neutral-600 mt-1 font-sans">
                Review verified civic parameters before transmitting to the municipal dispatcher ledger.
              </p>
            </div>

            <div className="border border-neutral-200 divide-y divide-neutral-200 font-mono text-xs">
              <div className="p-3 flex justify-between">
                <span className="text-neutral-500">CLASSIFICATION</span>
                <span className="font-bold text-neutral-900">
                  {ISSUE_TYPES.find(i => i.value === form.issueType)?.label}
                </span>
              </div>
              <div className="p-3 flex justify-between">
                <span className="text-neutral-500">EVIDENCE AUDIT</span>
                <span className="font-bold text-neutral-900">
                  {imageValidated ? 'NEURAL MATCH VERIFIED' : 'BYPASSED'}
                </span>
              </div>
              <div className="p-3 flex justify-between">
                <span className="text-neutral-500">INCIDENT TITLE</span>
                <span className="font-bold text-neutral-900">{form.title}</span>
              </div>
              <div className="p-3 flex justify-between">
                <span className="text-neutral-500">SEVERITY TIER</span>
                <span className="font-bold text-neutral-900 uppercase">{form.priority}</span>
              </div>
              <div className="p-3 flex justify-between">
                <span className="text-neutral-500">COORDINATES</span>
                <span className="font-bold text-neutral-900">
                  {form.location.latitude}, {form.location.longitude}
                </span>
              </div>
              <div className="p-3">
                <span className="text-neutral-500 block mb-1">RECORDED NARRATIVE</span>
                <p className="font-sans text-sm text-neutral-800 leading-relaxed bg-neutral-50 p-3 border border-neutral-200">
                  {form.description}
                </p>
              </div>
            </div>

            <div className="border border-neutral-200 bg-neutral-50 p-4 flex items-center gap-3">
              <HiShieldCheck className="w-6 h-6 text-neutral-800 flex-shrink-0" />
              <p className="font-mono text-xs text-neutral-600">
                Transmitted dispatches are digitally signed and cryptographically immutated into the municipal ledger.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Action navigation bar */}
      <div className="flex items-center justify-between pt-2">
        {step > 0 ? (
          <button
            type="button"
            onClick={() => setStep(s => s - 1)}
            className="px-4 py-2 border border-neutral-300 font-mono text-xs uppercase tracking-wider text-neutral-800 hover:border-black flex items-center gap-2"
          >
            <HiArrowLeft className="w-3.5 h-3.5" />
            <span>PREVIOUS STEP</span>
          </button>
        ) : (
          <div />
        )}

        {step < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={() => setStep(s => s + 1)}
            disabled={!canNext()}
            className="px-5 py-2.5 bg-black text-white font-mono text-xs font-bold uppercase tracking-wider hover:bg-neutral-800 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span>PROCEED TO NEXT</span>
            <HiArrowRight className="w-3.5 h-3.5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || !canNext()}
            className="px-6 py-2.5 bg-black text-white font-mono text-xs font-bold uppercase tracking-wider hover:bg-neutral-800 flex items-center gap-2 disabled:opacity-40"
          >
            {loading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>TRANSMITTING...</span>
              </>
            ) : (
              <span>TRANSMIT DISPATCH REPORT →</span>
            )}
          </button>
        )}
      </div>
    </div>
  )
}
