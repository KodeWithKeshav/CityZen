import { useState, useRef, useEffect } from 'react'
import { makeApiCall, apiClient } from '../../services/api'
import { HiPaperAirplane, HiChat } from 'react-icons/hi'

const SUGGESTIONS = [
  'How do I submit a complaint?',
  'What is the resolution timeline?',
  'How do I track my complaint?',
  'What types of issues can I report?',
]

// Custom Markdown formatter to prevent installing huge dependencies for a simple chat AI
const formatMarkdown = (text) => {
  if (!text) return null;
  return text.split('\n').map((line, i) => {
    // Check if it's a list item
    const isListItem = line.trim().startsWith('- ') || line.trim().startsWith('* ');
    const cleanedLine = isListItem ? line.trim().substring(2) : line;
    
    // Parse bold text
    const parts = cleanedLine.split(/(\*\*.*?\*\*)/g);
    
    const formattedLine = parts.map((part, j) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={j} className="font-bold">{part.slice(2, -2)}</strong>;
      }
      return part;
    });

    if (isListItem) {
      return (
        <div key={i} className="flex gap-2 mt-1.5 ml-1">
          <span className="text-primary-400 font-bold">â€¢</span>
          <span>{formattedLine}</span>
        </div>
      );
    }
    
    if (!line.trim()) return <div key={i} className="h-3" />; // paragraph spacing
    
    return <div key={i} className="mt-1.5">{formattedLine}</div>;
  });
};

export default function Chatbot() {
  const [messages, setMessages] = useState([
    {
      id: 1,
      role: 'assistant',
      text: "Hi! I'm your UrbanPulse AI assistant. I can help you with civic issues, complaint submission, and government services. How can I help you today?",
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
      const reply = res.data?.reply || res.reply || res.message || "I'm processing your request. Please try again."
      setMessages(prev => [...prev, { id: Date.now() + 1, role: 'assistant', text: reply }])
    } catch (err) {
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'assistant',
        text: "Sorry, I'm unable to respond right now. Please try again later.",
      }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="px-4 py-4 bg-white border-b border-gray-200 shadow-sm z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-violet-600 to-purple-500 rounded-xl flex items-center justify-center shadow-sm">
            <span className="text-xl">🤖</span>
          </div>
          <div>
            <h1 className="font-bold text-gray-900 leading-tight">UrbanPulse AI</h1>
            <p className="text-xs text-emerald-500 font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Online
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {m.role === 'assistant' && (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-600 to-purple-500 flex items-center justify-center flex-shrink-0 mr-2.5 mt-0.5 shadow-sm">
                <span className="text-sm">🤖</span>
              </div>
            )}
            <div className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm
              ${m.role === 'user'
                ? 'bg-primary-700 text-white rounded-tr-none'
                : 'bg-white border border-gray-200 text-gray-800 rounded-tl-none'}`}>
              {m.role === 'assistant' ? formatMarkdown(m.text) : m.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-600 to-purple-500 flex items-center justify-center flex-shrink-0 mr-2.5 shadow-sm">
              <span className="text-sm">🤖</span>
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-none px-5 py-4 shadow-sm">
              <div className="flex gap-1.5 items-center justify-center h-2">
                <div className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} className="h-1" />
      </div>

      {/* Suggestions */}
      {messages.length === 1 && (
        <div className="px-4 pb-3">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 ml-1">Suggested questions</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map(s => (
              <button
                key={s}
                onClick={() => sendMessage(s)}
                className="text-xs font-medium bg-white border border-gray-200 text-gray-600 px-3 py-2 rounded-xl hover:bg-gray-50 hover:border-gray-300 hover:text-gray-900 transition-all shadow-sm"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 bg-white border-t border-gray-200 z-10">
        <div className="flex gap-2 max-w-4xl mx-auto relative">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder="Ask about city services, reporting guidelines..."
            className="input flex-1 pr-12 rounded-xl border-gray-300 focus:ring-violet-500 focus:border-violet-500"
            disabled={loading}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            className="absolute right-1.5 top-1.5 bottom-1.5 aspect-square bg-violet-600 hover:bg-violet-700 text-white rounded-lg flex items-center justify-center disabled:opacity-50 transition-colors shadow-sm"
          >
            <HiPaperAirplane className="w-4 h-4 translate-x-px" />
          </button>
        </div>
        <p className="text-[10px] text-center text-gray-400 mt-2">UrbanPulse AI can make mistakes. Verify important information.</p>
      </div>
    </div>
  )
}

