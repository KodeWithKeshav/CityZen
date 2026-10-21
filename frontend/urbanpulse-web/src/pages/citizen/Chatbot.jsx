import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { makeApiCall, apiClient } from '../../services/api'
import toast from 'react-hot-toast'
import { HiPaperAirplane, HiChatAlt2, HiMicrophone } from 'react-icons/hi'
import i18n from '../../i18n'

const formatMarkdown = (text) => {
  if (!text) return null
  return text.split('\n').map((line, i) => {
    const isListItem = line.trim().startsWith('- ') || line.trim().startsWith('* ')
    const cleanedLine = isListItem ? line.trim().substring(2) : line
    const parts = cleanedLine.split(/(\*\*.*?\*\*)/g)

    const formattedLine = parts.map((part, j) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={j} className="font-bold text-neutral-900">{part.slice(2, -2)}</strong>
      }
      return part
    })

    if (isListItem) {
      return (
        <div key={i} className="flex gap-2 mt-1.5 ml-1">
          <span className="text-black font-mono font-bold">■</span>
          <span>{formattedLine}</span>
        </div>
      )
    }

    if (!line.trim()) return <div key={i} className="h-2" />

    return <div key={i} className="mt-1">{formattedLine}</div>
  })
}

export default function Chatbot() {
  const { t } = useTranslation(['chatbot', 'complaint'])
  const SUGGESTIONS = [
    t('suggestions.emergency'),
    t('suggestions.timeline'),
    t('suggestions.authenticity'),
    t('suggestions.expedited'),
  ]
  const [messages, setMessages] = useState([
    {
      id: 1,
      role: 'assistant',
      text: t('greeting'),
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [followUps, setFollowUps] = useState([])
  const [isRecording, setIsRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const mediaStreamRef = useRef(null)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Keep the initial greeting in sync with the selected language, as long as
  // the citizen hasn't started a conversation yet.
  useEffect(() => {
    setMessages(prev => (prev.length === 1 && prev[0].id === 1
      ? [{ id: 1, role: 'assistant', text: t('greeting') }]
      : prev))
  }, [i18n.language, t])

  const sendMessage = async (text) => {
    const userMsg = text || input.trim()
    if (!userMsg) return
    setInput('')

    const history = [...messages, { id: Date.now(), role: 'user', text: userMsg }]
      .slice(-5)
      .map(m => ({ type: m.role === 'assistant' ? 'bot' : 'user', text: m.text }))

    setMessages(prev => [...prev, { id: Date.now(), role: 'user', text: userMsg }])
    setLoading(true)

    try {
      const res = await makeApiCall(apiClient.chatbot.message, {
        method: 'POST',
        body: JSON.stringify({ message: userMsg, conversationHistory: history, language: i18n.language }),
      })
      const reply = res.data?.reply || res.reply || res.message || t('errorReply')
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'assistant',
        text: reply,
        confidence: res.confidence,
        category: res.category,
      }])
      setFollowUps(Array.isArray(res.followUpSuggestions) ? res.followUpSuggestions : [])
    } catch (err) {
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'assistant',
        text: t('errorReply'),
      }])
    } finally {
      setLoading(false)
    }
  }

  const stopMediaStream = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop())
      mediaStreamRef.current = null
    }
  }

  const handleVoiceInput = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop()
      return
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error(t('complaint:voice.notSupported'))
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream

      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder
      audioChunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        stopMediaStream()
        setIsRecording(false)
        setTranscribing(true)

        try {
          const audioBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' })
          const formData = new FormData()
          formData.append('audio', audioBlob, 'recording.webm')
          formData.append('language', i18n.language)

          const response = await fetch(apiClient.transcribe.audio, {
            method: 'POST',
            body: formData,
          })
          const result = await response.json()

          if (response.ok && result.success && result.transcript) {
            setInput(prev => (prev ? `${prev} ${result.transcript}` : result.transcript))
          } else {
            toast.error(result.message || t('complaint:voice.failed'))
          }
        } catch (err) {
          console.error('Transcription upload failed:', err)
          toast.error(t('complaint:voice.uploadError'))
        } finally {
          setTranscribing(false)
        }
      }

      recorder.start()
      setIsRecording(true)
    } catch (e) {
      console.error('Microphone access failed:', e)
      toast.error(t('complaint:voice.micError'))
      setIsRecording(false)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] border border-neutral-300 bg-white max-w-4xl mx-auto">
      {/* Header */}
      <div className="px-6 py-4 border-b border-black bg-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-black text-white flex items-center justify-center font-mono font-bold text-xs">
            AI
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-serif font-bold text-base uppercase text-neutral-900">
                {t('title')}
              </h1>
              <span className="font-mono text-[10px] tracking-wider uppercase px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-300">
                {t('activeProtocol')}
              </span>
            </div>
            <p className="font-mono text-xs text-neutral-500 mt-0.5">
              {t('subtitle')}
            </p>
          </div>
        </div>

        <div className="font-mono text-xs text-neutral-400 hidden sm:block">
          {t('sessionVerified')}
        </div>
      </div>

      {/* Message history */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-neutral-50/50">
        {messages.map(m => (
          <div
            key={m.id}
            className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <span className="font-mono text-[10px] text-neutral-500 uppercase tracking-widest mb-1">
              {m.role === 'user' ? t('citizenQuery') : t('botResponse')}
            </span>
            <div
              className={`max-w-[85%] sm:max-w-[75%] p-4 text-xs font-mono leading-relaxed border ${
                m.role === 'user'
                  ? 'bg-neutral-900 text-white border-black font-sans text-sm'
                  : 'bg-white text-neutral-800 border-neutral-300'
              }`}
            >
              {m.role === 'assistant' ? formatMarkdown(m.text) : m.text}
            </div>
            {m.role === 'assistant' && m.category && (
              <span className="font-mono text-[9px] text-neutral-400 uppercase tracking-wider mt-1">
                {m.category.replace(/_/g, ' ')}
                {typeof m.confidence === 'number' && ` · ${Math.round(m.confidence * 100)}% confidence`}
              </span>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex flex-col items-start">
            <span className="font-mono text-[10px] text-neutral-500 uppercase tracking-widest mb-1">
              {t('deliberating')}
            </span>
            <div className="bg-white border border-neutral-300 p-4 font-mono text-xs text-neutral-600 flex items-center gap-2">
              <div className="w-2.5 h-2.5 bg-black animate-pulse" />
              <span>{t('queryingKnowledgeGraph')}</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} className="h-1" />
      </div>

      {/* Sample Query Prompts / contextual follow-ups */}
      {(followUps.length > 0 || messages.length <= 2) && (
        <div className="p-4 border-t border-neutral-200 bg-white">
          <span className="font-mono text-[10px] uppercase text-neutral-400 tracking-wider block mb-2">
            {followUps.length > 0 ? t('followUpInquiries') : t('suggestedInquiries')}
          </span>
          <div className="flex flex-wrap gap-2">
            {(followUps.length > 0 ? followUps : SUGGESTIONS).map((s, idx) => (
              <button
                key={idx}
                onClick={() => sendMessage(s)}
                className="font-mono text-xs px-3 py-1.5 border border-neutral-300 hover:border-black text-neutral-700 bg-neutral-50 hover:bg-white transition-colors text-left"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input row */}
      <div className="p-4 border-t border-black bg-white">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            sendMessage()
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={transcribing ? t('complaint:form.transcribing') : t('inputPlaceholder')}
            disabled={transcribing}
            className="flex-1 px-4 py-3 border border-neutral-300 rounded-none text-xs font-mono placeholder-neutral-400 focus:outline-none focus:border-black disabled:opacity-50"
          />
          <button
            type="button"
            onClick={handleVoiceInput}
            disabled={loading || transcribing}
            title={t('complaint:form.voiceDictate')}
            className={`px-3 py-3 border font-mono text-xs flex items-center gap-1.5 transition-colors disabled:opacity-40 ${
              isRecording
                ? 'bg-rose-600 text-white border-rose-700 animate-pulse'
                : 'border-neutral-300 text-neutral-700 hover:border-black'
            }`}
          >
            <HiMicrophone className="w-4 h-4" />
          </button>
          <button
            type="submit"
            disabled={loading || !input.trim() || transcribing}
            className="px-6 py-3 bg-black text-white font-mono text-xs font-bold uppercase tracking-wider hover:bg-neutral-800 disabled:opacity-40 transition-colors flex items-center gap-2"
          >
            <span>{t('transmit')}</span>
            <HiPaperAirplane className="w-3.5 h-3.5 rotate-90" />
          </button>
        </form>
      </div>
    </div>
  )
}
