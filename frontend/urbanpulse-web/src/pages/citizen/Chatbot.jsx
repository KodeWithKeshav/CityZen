import { useState, useRef, useEffect } from 'react'
import { makeApiCall, apiClient } from '../../services/api'
import { HiPaperAirplane, HiChatAlt2 } from 'react-icons/hi'

const SUGGESTIONS = [
  'How do I submit an emergency road obstruction report?',
  'What is the standard municipal resolution timeline?',
  'How is my report authenticity score determined?',
  'What categories qualify for expedited municipal dispatch?',
]

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
  const [messages, setMessages] = useState([
    {
      id: 1,
      role: 'assistant',
      text: "CITYZEN CIVIC AGENT ONLINE. I provide automated guidance on municipal codes, incident dispatch parameters, telemetry validation, and government workflows. Enter your inquiry below.",
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (text) => {
    const userMsg = text || input.trim()
    if (!userMsg) return
    setInput('')

    setMessages(prev => [...prev, { id: Date.now(), role: 'user', text: userMsg }])
    setLoading(true)

    try {
      const res = await makeApiCall(apiClient.chatbot.message, {
        method: 'POST',
        body: JSON.stringify({ message: userMsg }),
      })
      const reply = res.data?.reply || res.reply || res.message || "Query processed. No further data returned."
      setMessages(prev => [...prev, { id: Date.now() + 1, role: 'assistant', text: reply }])
    } catch (err) {
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'assistant',
        text: "TELECOMMUNICATION PROTOCOL ERROR: Neural agent temporarily unresponsive.",
      }])
    } finally {
      setLoading(false)
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
                Civic Intelligence Agent
              </h1>
              <span className="font-mono text-[10px] tracking-wider uppercase px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-300">
                ACTIVE PROTOCOL
              </span>
            </div>
            <p className="font-mono text-xs text-neutral-500 mt-0.5">
              Natural Language Urban Guidance Terminal
            </p>
          </div>
        </div>

        <div className="font-mono text-xs text-neutral-400 hidden sm:block">
          SESSION VERIFIED · 256-BIT
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
              {m.role === 'user' ? 'CITIZEN QUERY' : 'MUNICIPAL NEURAL RESPONSE'}
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
          </div>
        ))}

        {loading && (
          <div className="flex flex-col items-start">
            <span className="font-mono text-[10px] text-neutral-500 uppercase tracking-widest mb-1">
              SYSTEM DELIBERATING
            </span>
            <div className="bg-white border border-neutral-300 p-4 font-mono text-xs text-neutral-600 flex items-center gap-2">
              <div className="w-2.5 h-2.5 bg-black animate-pulse" />
              <span>Querying civic neural knowledge graph...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} className="h-1" />
      </div>

      {/* Sample Query Prompts */}
      {messages.length <= 2 && (
        <div className="p-4 border-t border-neutral-200 bg-white">
          <span className="font-mono text-[10px] uppercase text-neutral-400 tracking-wider block mb-2">
            SUGGESTED DISPATCH INQUIRIES:
          </span>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s, idx) => (
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
            placeholder="Type your inquiry for the civic intelligence agent..."
            className="flex-1 px-4 py-3 border border-neutral-300 rounded-none text-xs font-mono placeholder-neutral-400 focus:outline-none focus:border-black"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-6 py-3 bg-black text-white font-mono text-xs font-bold uppercase tracking-wider hover:bg-neutral-800 disabled:opacity-40 transition-colors flex items-center gap-2"
          >
            <span>TRANSMIT</span>
            <HiPaperAirplane className="w-3.5 h-3.5 rotate-90" />
          </button>
        </form>
      </div>
    </div>
  )
}
