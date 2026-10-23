import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
        if (isItem) return <div key={i} className="flex gap-1.5 mt-0.5"><span className="text-violet-400 mt-0.5">▸</span><span>{parts}</span></div>
        if (!line.trim()) return <div key={i} className="h-1.5" />
        return <div key={i} className="mt-0.5">{parts}</div>
      })}
    </span>
  )
}

// ─── Nav action banner ────────────────────────────────────────────────────────
function NavBanner({ action, onGo, onDismiss }) {
  if (!action) return null
  return (
    <div className="mx-3 mb-2 p-2.5 rounded-lg bg-violet-950/60 border border-violet-500/40 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <HiExternalLink className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />
        <span className="text-xs text-violet-200 truncate">Go to <strong>{action.label}</strong>?</span>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button onClick={onGo}
          className="px-2.5 py-1 text-[11px] bg-violet-600 hover:bg-violet-500 text-white rounded font-medium transition-colors">
          Take me there
        </button>
        <button onClick={onDismiss}
          className="p-1 text-violet-400 hover:text-violet-200 transition-colors">
          <HiX className="w-3 h-3" />
        </button>
      </div>
    </div>
  )
}

// ─── Main floating chat component ────────────────────────────────────────────
export default function FloatingChat() {
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

  // Register navigate fn into context so AI-triggered nav works
  useEffect(() => {
    registerNavigator(navigate)
  }, [navigate, registerNavigator])

  // Scroll to bottom on new messages
  useEffect(() => {
    if (!isMinimised) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isMinimised])

  // Watch for nav actions in the latest bot message
  useEffect(() => {
    const last = [...messages].reverse().find(m => m.role === 'assistant' && m.action)
    if (last?.action?.type === 'navigate') {
      setPendingNav(last.action)
    }
  }, [messages])

  // Focus input when panel opens
  useEffect(() => {
    if (!isMinimised) setTimeout(() => inputRef.current?.focus(), 100)
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

  // Don't render if no chat has started yet and minimised — show bubble only after first interaction
  const showBubble = true  // always show the bubble so user can open it

  if (!showBubble) return null

  return (
    <>
      {/* ── Floating Panel ── */}
      {!isMinimised && (
        <div
          className="fixed bottom-20 right-5 z-50 flex flex-col"
          style={{
            width: '360px',
            height: '520px',
            background: 'linear-gradient(145deg, #0f0f1a 0%, #13102a 100%)',
            border: '1px solid rgba(139,92,246,0.35)',
            borderRadius: '16px',
            boxShadow: '0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(139,92,246,0.1)',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/8 flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center">
                <HiSparkles className="w-3.5 h-3.5 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white leading-none">CityZen AI</p>
                <p className="text-[10px] text-violet-400 mt-0.5">Powered by Qwen3-27B</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={clearChat} title="Clear chat"
                className="p-1.5 rounded-md hover:bg-white/8 text-white/40 hover:text-white/70 transition-colors">
                <HiTrash className="w-3.5 h-3.5" />
              </button>
              <button onClick={closeChat}
                className="p-1.5 rounded-md hover:bg-white/8 text-white/40 hover:text-white/70 transition-colors">
                <HiChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 scrollbar-thin">
            {messages.map(m => (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.role === 'assistant' && (
                  <div className="w-5 h-5 rounded-full bg-violet-700 flex items-center justify-center mr-2 mt-1 flex-shrink-0">
                    <HiSparkles className="w-2.5 h-2.5 text-white" />
                  </div>
                )}
                <div
                  className={`max-w-[82%] px-3 py-2.5 rounded-2xl text-xs leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-violet-600 text-white rounded-br-sm'
                      : 'bg-white/8 text-white/90 rounded-bl-sm border border-white/6'
                  }`}
                >
                  {m.role === 'assistant' ? <MiniMarkdown text={m.text} /> : m.text}
                  {m.role === 'assistant' && m.source === 'groq' && (
                    <span className="block mt-1.5 text-[10px] text-violet-400/60">✦ AI generated</span>
                  )}
                  {m.role === 'assistant' && m.source === 'groq_tool' && (
                    <span className="block mt-1.5 text-[10px] text-violet-400/60">✦ AI + Navigation</span>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="w-5 h-5 rounded-full bg-violet-700 flex items-center justify-center mr-2 flex-shrink-0">
                  <HiSparkles className="w-2.5 h-2.5 text-white" />
                </div>
                <div className="bg-white/8 border border-white/6 rounded-2xl rounded-bl-sm px-3 py-2.5">
                  <div className="flex gap-1 items-center">
                    <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} className="h-1" />
          </div>

          {/* Nav banner */}
          <NavBanner action={pendingNav} onGo={handleGoNav} onDismiss={() => setPendingNav(null)} />

          {/* Follow-up chips */}
          {followUps.length > 0 && !loading && (
            <div className="px-3 pb-2 flex flex-wrap gap-1.5">
              {followUps.slice(0, 3).map((s, i) => (
                <button key={i} onClick={() => { sendMessage(s); setInput('') }}
                  className="text-[11px] px-2.5 py-1 rounded-full bg-white/6 border border-white/12 text-white/70 hover:bg-violet-600/30 hover:border-violet-500/50 hover:text-white transition-all truncate max-w-[180px]">
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="px-3 pb-3 flex-shrink-0">
            <div className="flex items-center gap-2 bg-white/6 border border-white/12 rounded-xl px-3 py-2 focus-within:border-violet-500/50 transition-colors">
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Ask anything…"
                disabled={loading}
                className="flex-1 bg-transparent text-xs text-white placeholder-white/30 outline-none disabled:opacity-50"
              />
              <button
                onClick={handleSend}
                disabled={loading || !input.trim()}
                className="w-6 h-6 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-30 flex items-center justify-center transition-colors flex-shrink-0"
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
        className="fixed bottom-5 right-5 z-50 w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-110 active:scale-95"
        style={{
          background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
          boxShadow: '0 8px 32px rgba(124,58,237,0.5)',
        }}
        title="CityZen AI Assistant"
      >
        {isMinimised ? (
          <>
            <HiChatAlt2 className="w-5 h-5 text-white" />
            {hasUnread && (
              <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-pulse" />
            )}
          </>
        ) : (
          <HiChevronDown className="w-5 h-5 text-white" />
        )}
      </button>
    </>
  )
}
