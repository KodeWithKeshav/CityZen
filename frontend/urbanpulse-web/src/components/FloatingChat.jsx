import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useChatContext } from '../context/ChatContext'
import {
  HiX, HiPaperAirplane, HiChatAlt2, HiChevronDown,
  HiSparkles, HiExternalLink, HiTrash,
} from 'react-icons/hi'

// ─── Markdown renderer (minimal) ─────────────────────────────────────────────
function MiniMarkdown({ text }) {
  if (!text) return null
  return (
    <span>
      {text.split('\n').map((line, i) => {
        const isItem = /^[-*•■]\s/.test(line.trim())
        const clean  = isItem ? line.trim().replace(/^[-*•■]\s/, '') : line
        const parts  = clean.split(/(\*\*.*?\*\*)/g).map((p, j) =>
          p.startsWith('**') && p.endsWith('**')
            ? <strong key={j}>{p.slice(2, -2)}</strong>
            : p
        )
        if (isItem) return <div key={i} className="flex gap-1.5 mt-0.5"><span className="text-neutral-400 mt-0.5">▸</span><span>{parts}</span></div>
        if (!line.trim()) return <div key={i} className="h-1.5" />
        return <div key={i} className="mt-0.5">{parts}</div>
      })}
    </span>
  )
}

// ─── Nav action banner ────────────────────────────────────────────────────────
function NavBanner({ action, onGo, onDismiss, t }) {
  if (!action) return null
  return (
    <div className="mx-3 mb-2 p-2.5 bg-neutral-50 border border-neutral-300 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <HiExternalLink className="w-3.5 h-3.5 text-neutral-500 flex-shrink-0" />
        <span className="text-xs text-neutral-700 truncate font-sans">{t('floating.goTo')} <strong className="text-neutral-900">{action.label}</strong>?</span>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button onClick={onGo}
          className="px-2.5 py-1 text-[11px] bg-neutral-900 hover:bg-neutral-800 text-white font-mono font-bold uppercase tracking-wider transition-colors">
          {t('floating.takeMeThere')}
        </button>
        <button onClick={onDismiss}
          className="p-1 text-neutral-400 hover:text-neutral-700 transition-colors">
          <HiX className="w-3 h-3" />
        </button>
      </div>
    </div>
  )
}

// ─── Main floating chat component ────────────────────────────────────────────
export default function FloatingChat() {
  const { t } = useTranslation('chatbot')
  const navigate = useNavigate()
  const {
    messages, loading, followUps,
    isMinimised, hasUnread,
    sendMessage, openChat, closeChat, clearChat,
    executeNav, registerNavigator,
  } = useChatContext()

  const [input, setInput]       = useState('')
  const [pendingNav, setPendingNav] = useState(null)
  const bottomRef               = useRef(null)
  const inputRef                = useRef(null)
  const lastNavMsgIdRef         = useRef(null)

  // Register navigate fn into context so AI-triggered nav works
  useEffect(() => {
    registerNavigator(navigate)
  }, [navigate, registerNavigator])

  // Scroll to bottom on new messages
  useEffect(() => {
    if (!isMinimised) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isMinimised])

  // Watch for nav actions only on newly added assistant messages
  useEffect(() => {
    const last = messages[messages.length - 1]
    if (last?.role === 'assistant' && last?.action?.type === 'navigate' && last.id !== lastNavMsgIdRef.current) {
      lastNavMsgIdRef.current = last.id
      setPendingNav(last.action)
    }
  }, [messages])

  // Focus input when panel opens
  useEffect(() => {
    if (!isMinimised) {
      const id = setTimeout(() => inputRef.current?.focus(), 100)
      return () => clearTimeout(id)
    }
  }, [isMinimised])

  const handleSend = () => {
    if (!input.trim() || loading) return
    sendMessage(input.trim())
    setInput('')
    setPendingNav(null)
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const handleGoNav = () => {
    if (pendingNav) { executeNav(pendingNav); setPendingNav(null) }
  }

  return (
    <>
      {/* ── Floating Panel ── */}
      {!isMinimised && (
        <div
          className="fixed bottom-20 right-3 left-3 sm:left-auto sm:right-5 sm:w-[360px] h-[min(520px,calc(100dvh-6.5rem))] z-50 flex flex-col bg-white border border-black"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 bg-neutral-900 flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 bg-white/10 border border-white/20 flex items-center justify-center flex-shrink-0">
                <HiSparkles className="w-3.5 h-3.5 text-white" />
              </div>
              <div>
                <p className="font-mono text-xs uppercase tracking-widest text-white leading-none">{t('floating.title')}</p>
                <p className="text-[10px] text-neutral-400 mt-1">{t('floating.subtitle')}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => { clearChat(); setPendingNav(null) }} title={t('floating.clearChat')}
                className="p-1.5 hover:bg-white/10 text-neutral-400 hover:text-white transition-colors">
                <HiTrash className="w-3.5 h-3.5" />
              </button>
              <button onClick={closeChat}
                className="p-1.5 hover:bg-white/10 text-neutral-400 hover:text-white transition-colors">
                <HiChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 scrollbar-thin bg-white">
            {messages.map(m => (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.role === 'assistant' && (
                  <div className="w-5 h-5 bg-neutral-900 flex items-center justify-center mr-2 mt-1 flex-shrink-0">
                    <HiSparkles className="w-2.5 h-2.5 text-white" />
                  </div>
                )}
                <div
                  className={`max-w-[82%] px-3 py-2.5 border text-xs leading-relaxed font-sans ${
                    m.role === 'user'
                      ? 'bg-neutral-900 text-white border-black'
                      : 'bg-neutral-50 text-neutral-900 border-neutral-200'
                  }`}
                >
                  {m.role === 'assistant' ? <MiniMarkdown text={m.text} /> : m.text}
                  {m.role === 'assistant' && m.source === 'groq' && (
                    <span className="block mt-1.5 text-[10px] font-mono uppercase tracking-wider text-neutral-400">{t('floating.aiGenerated')}</span>
                  )}
                  {m.role === 'assistant' && m.source === 'groq_tool' && (
                    <span className="block mt-1.5 text-[10px] font-mono uppercase tracking-wider text-neutral-400">{t('floating.aiNav')}</span>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="w-5 h-5 bg-neutral-900 flex items-center justify-center mr-2 flex-shrink-0">
                  <HiSparkles className="w-2.5 h-2.5 text-white" />
                </div>
                <div className="bg-neutral-50 border border-neutral-200 px-3 py-2.5">
                  <div className="flex gap-1 items-center">
                    <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} className="h-1" />
          </div>

          {/* Nav banner */}
          <NavBanner action={pendingNav} onGo={handleGoNav} onDismiss={() => setPendingNav(null)} t={t} />

          {/* Follow-up chips */}
          {followUps.length > 0 && !loading && (
            <div className="px-3 pb-2 flex flex-wrap gap-1.5 bg-white">
              {followUps.slice(0, 3).map((s, i) => (
                <button key={i} onClick={() => { sendMessage(s); setInput('') }}
                  className="text-[11px] px-2.5 py-1 bg-white border border-neutral-300 text-neutral-700 hover:border-black hover:bg-neutral-50 transition-colors truncate max-w-full sm:max-w-[180px] font-sans">
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="px-3 pb-3 pt-2 flex-shrink-0 bg-white border-t border-neutral-100">
            <div className="flex items-center gap-2 bg-white border border-neutral-300 px-3 py-2 focus-within:border-black transition-colors">
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder={t('floating.askAnything')}
                disabled={loading}
                className="min-w-0 flex-1 bg-transparent text-xs text-neutral-900 placeholder-neutral-400 outline-none disabled:opacity-50 font-sans"
              />
              <button
                onClick={handleSend}
                disabled={loading || !input.trim()}
                className="w-6 h-6 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-30 flex items-center justify-center transition-colors flex-shrink-0"
              >
                <HiPaperAirplane className="w-3 h-3 text-white rotate-90" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Floating Bubble Button ── */}
      <button
        onClick={isMinimised ? openChat : closeChat}
        className="fixed bottom-4 right-4 sm:bottom-5 sm:right-5 z-50 w-12 h-12 flex items-center justify-center bg-neutral-900 hover:bg-neutral-800 border border-black transition-all hover:scale-105 active:scale-95"
        title={t('floating.tooltip')}
      >
        {isMinimised ? (
          <>
            <HiChatAlt2 className="w-5 h-5 text-white" />
            {hasUnread && (
              <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-rose-600 border border-white animate-pulse" />
            )}
          </>
        ) : (
          <HiChevronDown className="w-5 h-5 text-white" />
        )}
      </button>
    </>
  )
}
