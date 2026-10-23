import { useRef, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useChatContext } from '../../context/ChatContext'
import {
  HiPaperAirplane, HiChatAlt2, HiMicrophone, HiSparkles,
  HiTrash, HiExternalLink, HiX,
} from 'react-icons/hi'
import { makeApiCall, apiClient } from '../../services/api'
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
function SourceBadge({ source, confidence }) {
  if (!source) return null
  const map = {
    knowledge_base:          { label: 'Knowledge Base', color: 'emerald' },
    knowledge_base_fallback: { label: 'KB Fallback',    color: 'yellow'  },
    groq:                    { label: 'Qwen3-27B AI',   color: 'violet'  },
    groq_tool:               { label: 'AI + Navigate',  color: 'blue'    },
  }
  const { label, color } = map[source] || { label: source, color: 'gray' }
  return (
    <span className={`font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full
      bg-${color}-50 text-${color}-700 border border-${color}-200`}>
      {label}{typeof confidence === 'number' ? ` · ${Math.round(confidence * 100)}%` : ''}
    </span>
  )
}

// ─── Navigation action card ───────────────────────────────────────────────────
function NavActionCard({ action, onGo, onDismiss }) {
  if (!action || action.type !== 'navigate') return null
  return (
    <div className="mt-2 p-3 border border-violet-200 bg-violet-50 rounded-lg flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <HiExternalLink className="w-4 h-4 text-violet-600 flex-shrink-0" />
        <p className="text-xs text-violet-800">
          Navigate to <strong>{action.label}</strong>?
        </p>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button
          onClick={onGo}
          className="px-3 py-1 text-xs bg-violet-600 hover:bg-violet-700 text-white rounded-md font-medium transition-colors"
        >
          Go now
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

  // Track nav actions per message
  useEffect(() => {
    const updates = {}
    messages.forEach(m => {
      if (m.action?.type === 'navigate') updates[m.id] = m.action
    })
    setPendingNavs(prev => ({ ...prev, ...updates }))
  }, [messages])

  const handleSend = (text) => {
    const msg = text || input.trim()
    if (!msg || loading) return
    setInput('')
    sendMessage(msg)
  }

  // Voice input ----------------------------------------------------------------
  const stopMediaStream = () => {
    mediaStreamRef.current?.getTracks().forEach(t => t.stop())
    mediaStreamRef.current = null
  }

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
        stopMediaStream(); setIsRecording(false); setTranscribing(true)
        try {
          const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' })
          const fd = new FormData()
          fd.append('audio', blob, 'recording.webm')
          fd.append('language', i18n.language)
          const r = await fetch(apiClient.transcribe.audio, { method: 'POST', body: fd })
          const data = await r.json()
          if (r.ok && data.success && data.transcript) {
            setInput(prev => prev ? `${prev} ${data.transcript}` : data.transcript)
          } else {
            toast.error(data.message || 'Transcription failed')
          }
        } catch { toast.error('Upload error') } finally { setTranscribing(false) }
      }
      recorder.start(); setIsRecording(true)
    } catch { toast.error('Microphone access failed'); setIsRecording(false) }
  }

  const QUICK_PROMPTS = [
    'How do I submit a complaint?',
    'Show me the heat map',
    'How do I track my reports?',
    'What civic issues can I report?',
  ]

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] bg-white max-w-4xl mx-auto border-x border-neutral-200">
      {/* ── Header ── */}
      <div className="px-6 py-4 border-b border-black bg-white flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center">
            <HiSparkles className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-serif font-bold text-base uppercase text-neutral-900">
                CityZen AI Assistant
              </h1>
              <span className="font-mono text-[10px] tracking-wider uppercase px-2 py-0.5
                bg-violet-50 text-violet-700 border border-violet-200 rounded-full">
                Qwen3-27B
              </span>
            </div>
            <p className="font-mono text-xs text-neutral-500 mt-0.5">
              Hybrid AI · Rule-based + Language Model · Navigation-aware
            </p>
          </div>
        </div>
        <button
          onClick={clearChat}
          title="Clear conversation"
          className="p-2 rounded-lg border border-neutral-200 hover:bg-neutral-50 text-neutral-400 hover:text-neutral-700 transition-colors"
        >
          <HiTrash className="w-4 h-4" />
        </button>
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-neutral-50/40">
        {messages.map(m => (
          <div key={m.id} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
            <span className="font-mono text-[10px] text-neutral-400 uppercase tracking-widest mb-1">
              {m.role === 'user' ? 'You' : 'CityZen AI'}
            </span>

            <div
              className={`max-w-[85%] sm:max-w-[75%] p-4 text-sm leading-relaxed border rounded-2xl ${
                m.role === 'user'
                  ? 'bg-neutral-900 text-white border-black rounded-br-sm'
                  : 'bg-white text-neutral-800 border-neutral-200 rounded-bl-sm shadow-sm'
              }`}
            >
              {m.role === 'assistant' ? formatMarkdown(m.text) : m.text}
            </div>

            {/* Nav action card */}
            {m.role === 'assistant' && pendingNavs[m.id] && (
              <div className="max-w-[85%] sm:max-w-[75%] w-full">
                <NavActionCard
                  action={pendingNavs[m.id]}
                  onGo={() => { executeNav(pendingNavs[m.id]); setPendingNavs(p => ({ ...p, [m.id]: null })) }}
                  onDismiss={() => setPendingNavs(p => ({ ...p, [m.id]: null }))}
                />
              </div>
            )}

            {m.role === 'assistant' && (
              <div className="mt-1.5">
                <SourceBadge source={m.source} confidence={m.confidence} />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex flex-col items-start">
            <span className="font-mono text-[10px] text-neutral-400 uppercase tracking-widest mb-1">CityZen AI</span>
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
        <div className="px-4 py-3 border-t border-neutral-100 bg-white flex-shrink-0">
          <span className="font-mono text-[10px] uppercase text-neutral-400 tracking-wider block mb-2">
            {followUps.length > 0 ? 'Follow-up suggestions' : 'Quick questions'}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {(followUps.length > 0 ? followUps : QUICK_PROMPTS).map((s, i) => (
              <button
                key={i}
                onClick={() => handleSend(s)}
                className="font-mono text-xs px-3 py-1.5 border border-neutral-200 hover:border-violet-400
                  hover:bg-violet-50 hover:text-violet-700 text-neutral-600 bg-white rounded-full transition-all"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Input ── */}
      <div className="p-4 border-t border-black bg-white flex-shrink-0">
        <form onSubmit={e => { e.preventDefault(); handleSend() }} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={transcribing ? 'Transcribing…' : 'Ask about the app, report an issue, or ask for help…'}
            disabled={transcribing || loading}
            className="flex-1 px-4 py-3 border border-neutral-200 text-sm placeholder-neutral-400
              focus:outline-none focus:border-violet-400 disabled:opacity-50 rounded-lg transition-colors"
          />
          <button type="button" onClick={handleVoiceInput} disabled={loading || transcribing}
            className={`px-3 py-3 border font-mono text-xs flex items-center gap-1.5 transition-colors
              disabled:opacity-40 rounded-lg ${
              isRecording
                ? 'bg-rose-600 text-white border-rose-700 animate-pulse'
                : 'border-neutral-200 text-neutral-600 hover:border-violet-400 hover:text-violet-600'
            }`}
          >
            <HiMicrophone className="w-4 h-4" />
          </button>
          <button type="submit" disabled={loading || !input.trim() || transcribing}
            className="px-6 py-3 bg-violet-600 hover:bg-violet-700 text-white font-mono text-xs font-bold
              uppercase tracking-wider disabled:opacity-40 transition-colors flex items-center gap-2 rounded-lg"
          >
            <span>Send</span>
            <HiPaperAirplane className="w-3.5 h-3.5 rotate-90" />
          </button>
        </form>
      </div>
    </div>
  )
}
