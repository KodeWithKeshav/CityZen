import { useRef, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useChatContext } from '../../context/ChatContext'
import {
  HiPaperAirplane, HiMicrophone, HiSparkles,
  HiTrash, HiExternalLink, HiX,
} from 'react-icons/hi'
import { apiClient, authStorage } from '../../services/api'
import toast from 'react-hot-toast'
import i18n from '../../i18n'

// ─── Markdown formatter ───────────────────────────────────────────────────────
const formatMarkdown = (text) => {
  if (!text) return null
  return text.split('\n').map((line, i) => {
    const isItem = /^[-*•■]\s/.test(line.trim())
    const clean  = isItem ? line.trim().replace(/^[-*•■]\s/, '') : line
    const parts  = clean.split(/(\*\*.*?\*\*)/g).map((p, j) =>
      p.startsWith('**') && p.endsWith('**')
        ? <strong key={j} className="font-bold text-neutral-900">{p.slice(2, -2)}</strong>
        : p
    )
    if (isItem) return (
      <div key={i} className="flex gap-2 mt-1.5 ml-1">
        <span className="text-violet-600 font-bold mt-0.5">▸</span>
        <span>{parts}</span>
      </div>
    )
    if (!line.trim()) return <div key={i} className="h-2" />
    return <div key={i} className="mt-1">{parts}</div>
  })
}

// ─── Source badge ─────────────────────────────────────────────────────────────
function SourceBadge({ source, confidence, t }) {
  if (!source) return null
  const map = {
    knowledge_base:          { label: t('sources.knowledge_base'), cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    knowledge_base_fallback: { label: t('sources.knowledge_base_fallback'), cls: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
    groq:                    { label: t('sources.groq'), cls: 'bg-violet-50 text-violet-700 border-violet-200' },
    groq_tool:               { label: t('sources.groq_tool'), cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  }
  const { label, cls } = map[source] || { label: source, cls: 'bg-gray-50 text-gray-700 border-gray-200' }
  return (
    <span className={`font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${cls}`}>
      {label}{typeof confidence === 'number' ? ` · ${Math.round(confidence * 100)}%` : ''}
    </span>
  )
}

// ─── Navigation action card ───────────────────────────────────────────────────
function NavActionCard({ action, onGo, onDismiss, t }) {
  if (!action || action.type !== 'navigate') return null
  return (
    <div className="mt-2 p-3 border border-violet-200 bg-violet-50 rounded-lg flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <HiExternalLink className="w-4 h-4 text-violet-600 flex-shrink-0" />
        <p className="text-xs text-violet-800">
          {t('floating.navigateTo')} <strong>{action.label}</strong>?
        </p>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button
          onClick={onGo}
          className="px-3 py-1 text-xs bg-violet-600 hover:bg-violet-700 text-white rounded-md font-medium transition-colors"
        >
          {t('floating.goNow')}
        </button>
        <button onClick={onDismiss} className="p-1 text-violet-400 hover:text-violet-600">
          <HiX className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

// ─── Chatbot page ─────────────────────────────────────────────────────────────
export default function Chatbot() {
  const { t } = useTranslation('chatbot')
  const navigate = useNavigate()
  const {
    messages, loading, followUps,
    sendMessage, clearChat, executeNav, registerNavigator,
  } = useChatContext()

  const [input, setInput]         = useState('')
  const [pendingNavs, setPendingNavs] = useState({}) // msgId → action
  const [isRecording, setIsRecording]   = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef   = useRef([])
  const mediaStreamRef   = useRef(null)
  const bottomRef        = useRef(null)

  // Register navigator so context can drive routing
  useEffect(() => {
    registerNavigator(navigate)
  }, [navigate, registerNavigator])

  // Scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Track nav actions per message (don't revive dismissed/executed cards)
  useEffect(() => {
    setPendingNavs(prev => {
      let changed = false
      const next = { ...prev }
      messages.forEach(m => {
        if (m.action?.type === 'navigate' && !(m.id in next)) {
          next[m.id] = m.action
          changed = true
        }
      })
      return changed ? next : prev
    })
  }, [messages])

  const handleSend = (text) => {
    const msg = (typeof text === 'string' ? text : input).trim()
    if (!msg || loading) return
    setInput('')
    sendMessage(msg)
  }

  // Voice input ----------------------------------------------------------------
  const stopMediaStream = () => {
    mediaStreamRef.current?.getTracks().forEach(t => t.stop())
    mediaStreamRef.current = null
  }

  const isMountedRef = useRef(true)
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.onstop = null
          mediaRecorderRef.current.stop()
        } catch {
          // ignore
        }
      }
      stopMediaStream()
    }
  }, [])

  const handleVoiceInput = async () => {
    if (isRecording) { mediaRecorderRef.current?.stop(); return }
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error('Microphone not supported'); return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream
      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder
      audioChunksRef.current = []

      recorder.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      recorder.onstop = async () => {
        stopMediaStream()
        if (!isMountedRef.current) return
        setIsRecording(false); setTranscribing(true)
        try {
          const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' })
          const fd = new FormData()
          fd.append('audio', blob, 'recording.webm')
          fd.append('language', (i18n.language || 'en').split('-')[0])
          const token = authStorage.getToken()
          const r = await fetch(apiClient.transcribe.audio, {
            method: 'POST',
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            body: fd,
          })
          const data = await r.json().catch(() => ({}))
          if (!isMountedRef.current) return
          if (r.ok && data.success && data.transcript) {
            setInput(prev => prev ? `${prev} ${data.transcript}` : data.transcript)
          } else {
            toast.error(data.message || 'Transcription failed')
          }
        } catch {
          if (isMountedRef.current) toast.error('Upload error')
        } finally {
          if (isMountedRef.current) setTranscribing(false)
        }
      }
      recorder.start(); setIsRecording(true)
    } catch { toast.error('Microphone access failed'); setIsRecording(false) }
  }

  const QUICK_PROMPTS = [
    t('suggestions.emergency'),
    t('suggestions.timeline'),
    t('suggestions.authenticity'),
    t('suggestions.expedited'),
  ]

  return (
    <div className="flex flex-col h-full bg-white max-w-4xl mx-auto border-x border-neutral-200">
      {/* ── Header ── */}
      <div className="px-3 sm:px-6 py-3 sm:py-4 border-b border-black bg-white flex items-center justify-between gap-2 flex-shrink-0">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center flex-shrink-0">
            <HiSparkles className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <h1 className="font-serif font-bold text-sm sm:text-base uppercase text-neutral-900 truncate">
                {t('floating.tooltip')}
              </h1>
              <span className="font-mono text-[9px] sm:text-[10px] tracking-wider uppercase px-2 py-0.5
                bg-violet-50 text-violet-700 border border-violet-200 rounded-full whitespace-nowrap">
                {t('sources.groq')}
              </span>
            </div>
            <p className="font-mono text-[11px] sm:text-xs text-neutral-500 mt-0.5 truncate">
              {t('subtitle')}
            </p>
          </div>
        </div>
        <button
          onClick={() => { clearChat(); setPendingNavs({}) }}
          title={t('floating.clearChat')}
          className="p-2 rounded-lg border border-neutral-200 hover:bg-neutral-50 text-neutral-400 hover:text-neutral-700 transition-colors flex-shrink-0"
        >
          <HiTrash className="w-4 h-4" />
        </button>
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 sm:space-y-5 bg-neutral-50/40">
        {messages.map(m => (
          <div key={m.id} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
            <span className="font-mono text-[10px] text-neutral-400 uppercase tracking-widest mb-1">
              {m.role === 'user' ? t('citizenQuery') : t('botResponse')}
            </span>

            <div
              className={`max-w-[90%] sm:max-w-[75%] p-3 sm:p-4 text-sm leading-relaxed border rounded-2xl break-words ${
                m.role === 'user'
                  ? 'bg-neutral-900 text-white border-black rounded-br-sm'
                  : 'bg-white text-neutral-800 border-neutral-200 rounded-bl-sm shadow-sm'
              }`}
            >
              {m.role === 'assistant' ? formatMarkdown(m.text) : m.text}
            </div>

            {/* Nav action card */}
            {m.role === 'assistant' && pendingNavs[m.id] && (
              <div className="max-w-[90%] sm:max-w-[75%] w-full">
                <NavActionCard
                  action={pendingNavs[m.id]}
                  onGo={() => { executeNav(pendingNavs[m.id]); setPendingNavs(p => ({ ...p, [m.id]: null })) }}
                  onDismiss={() => setPendingNavs(p => ({ ...p, [m.id]: null }))}
                  t={t}
                />
              </div>
            )}

            {m.role === 'assistant' && (
              <div className="mt-1.5">
                <SourceBadge source={m.source} confidence={m.confidence} t={t} />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex flex-col items-start">
            <span className="font-mono text-[10px] text-neutral-400 uppercase tracking-widest mb-1">{t('botResponse')}</span>
            <div className="bg-white border border-neutral-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm flex items-center gap-2">
              <span className="w-2 h-2 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}

        <div ref={bottomRef} className="h-1" />
      </div>

      {/* ── Follow-ups / quick prompts ── */}
      {(followUps.length > 0 || messages.length <= 2) && (
        <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-t border-neutral-100 bg-white flex-shrink-0">
          <span className="font-mono text-[10px] uppercase text-neutral-400 tracking-wider block mb-2">
            {followUps.length > 0 ? t('followUpInquiries') : t('suggestedInquiries')}
          </span>
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto sm:max-h-none">
            {(followUps.length > 0 ? followUps : QUICK_PROMPTS).map((s, i) => (
              <button
                key={i}
                onClick={() => handleSend(s)}
                className="font-mono text-xs px-2.5 sm:px-3 py-1 sm:py-1.5 border border-neutral-200 hover:border-violet-400
                  hover:bg-violet-50 hover:text-violet-700 text-neutral-600 bg-white rounded-full transition-all text-left"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Input ── */}
      <div className="p-3 sm:p-4 border-t border-black bg-white flex-shrink-0">
        <form onSubmit={e => { e.preventDefault(); handleSend() }} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={transcribing ? t('mobile.thinking') : t('inputPlaceholder')}
            disabled={transcribing || loading}
            className="min-w-0 flex-1 px-3 sm:px-4 py-2.5 sm:py-3 border border-neutral-200 text-sm placeholder-neutral-400
              focus:outline-none focus:border-violet-400 disabled:opacity-50 rounded-lg transition-colors"
          />
          <button type="button" onClick={handleVoiceInput} disabled={loading || transcribing}
            className={`px-2.5 sm:px-3 py-2.5 sm:py-3 border font-mono text-xs flex items-center gap-1.5 transition-colors flex-shrink-0
              disabled:opacity-40 rounded-lg ${
              isRecording
                ? 'bg-rose-600 text-white border-rose-700 animate-pulse'
                : 'border-neutral-200 text-neutral-600 hover:border-violet-400 hover:text-violet-600'
            }`}
          >
            <HiMicrophone className="w-4 h-4" />
          </button>
          <button type="submit" disabled={loading || !input.trim() || transcribing}
            className="px-3.5 sm:px-6 py-2.5 sm:py-3 bg-violet-600 hover:bg-violet-700 text-white font-mono text-xs font-bold
              uppercase tracking-wider disabled:opacity-40 transition-colors flex items-center gap-2 rounded-lg flex-shrink-0"
          >
            <span className="hidden sm:inline">{t('transmit')}</span>
            <HiPaperAirplane className="w-3.5 h-3.5 rotate-90" />
          </button>
        </form>
      </div>
    </div>
  )
}
