import { useState } from 'react'
import { makeApiCall, apiClient } from '../../services/api'
import toast from 'react-hot-toast'
import { HiStar } from 'react-icons/hi'

export default function FeedbackScreen() {
  const [form, setForm] = useState({ rating: 0, category: '', message: '' })
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.rating === 0) { toast.error('Please select a rating'); return }
    if (!form.message.trim()) { toast.error('Please write a message'); return }
    setLoading(true)
    try {
      // Mocking API call natively per user request
      setTimeout(() => {
        setSubmitted(true)
        toast.success('Thank you for your feedback!')
        setLoading(false)
      }, 600)
    } catch (err) {
      toast.error('Failed to submit feedback')
      setLoading(false)
    }
  }

  if (submitted) return (
    <div className="flex flex-col items-center justify-center p-8 h-full text-center">
      <div className="text-6xl mb-4">🎉</div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Thank You!</h2>
      <p className="text-gray-600">Your feedback helps us improve UrbanPulse for everyone.</p>
      <button onClick={() => setSubmitted(false)} className="btn-primary mt-6">Submit Another</button>
    </div>
  )

  return (
    <div className="p-4 max-w-lg mx-auto fade-in pb-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Feedback</h1>
        <p className="text-sm text-gray-500">Help us improve your experience</p>
      </div>

      <div className="card">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Star Rating */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">Overall Rating</label>
            <div className="flex gap-2">
              {[1,2,3,4,5].map(star => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setForm(p => ({ ...p, rating: star }))}
                  className="transition-transform hover:scale-110"
                >
                  <HiStar className={`w-9 h-9 transition-colors ${star <= form.rating ? 'text-amber-400' : 'text-gray-200'}`} />
                </button>
              ))}
              {form.rating > 0 && (
                <span className="ml-2 text-sm text-gray-500 self-center">
                  {['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][form.rating]}
                </span>
              )}
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} className="input">
              <option value="">Select category (optional)</option>
              <option value="app_usability">App Usability</option>
              <option value="complaint_process">Complaint Process</option>
              <option value="response_time">Response Time</option>
              <option value="general">General</option>
            </select>
          </div>

          {/* Message */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Your Feedback *</label>
            <textarea
              value={form.message}
              onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
              placeholder="Share your thoughts, suggestions, or any issues you encountered..."
              className="input h-28 resize-none"
              maxLength={500}
            />
            <p className="text-xs text-gray-400 mt-1">{form.message.length}/500</p>
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
            {loading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" /> : '⭐ Submit Feedback'}
          </button>
        </form>
      </div>
    </div>
  )
}

