import { createContext, useContext, useState, useCallback, useRef } from 'react'
import { makeApiCall, apiClient } from '../services/api'

const ChatContext = createContext(null)

export const useChatContext = () => {
  const ctx = useContext(ChatContext)
  if (!ctx) throw new Error('useChatContext must be used within ChatProvider')
  return ctx
}

const WELCOME_MSG = {
  id: 'welcome',
  role: 'assistant',
  text: "👋 Hi! I'm your CityZen AI Assistant. Ask me anything about reporting civic issues, navigating the app, or tracking your complaints!",
}

export function ChatProvider({ children }) {
  const [messages, setMessages]         = useState([WELCOME_MSG])
  const [isOpen, setIsOpen]             = useState(false)
  const [isMinimised, setIsMinimised]   = useState(true)   // floating bubble vs open panel
  const [loading, setLoading]           = useState(false)
  const [followUps, setFollowUps]       = useState([])
  const [hasUnread, setHasUnread]       = useState(false)
  const pendingNav                      = useRef(null)      // action from last bot msg
  const navigatorRef                    = useRef(null)      // injected by component

  // Components can register a navigate fn so the context can drive routing
  const registerNavigator = useCallback((fn) => {
    navigatorRef.current = fn
  }, [])

  const openChat = useCallback(() => {
    setIsOpen(true)
    setIsMinimised(false)
    setHasUnread(false)
  }, [])

  const closeChat = useCallback(() => {
    setIsMinimised(true)
  }, [])

  const sendMessage = useCallback(async (text) => {
    const trimmed = text?.trim()
    if (!trimmed) return

    const userMsg = { id: Date.now(), role: 'user', text: trimmed }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    const historyForApi = [...messages, userMsg]
      .slice(-8)
      .map(m => ({ type: m.role === 'assistant' ? 'bot' : 'user', text: m.text }))

    try {
      const res = await makeApiCall(apiClient.chatbot.message, {
        method: 'POST',
        body: JSON.stringify({
          message: trimmed,
          conversationHistory: historyForApi,
          userId: 'session_' + (localStorage.getItem('authToken')?.slice(-8) || 'guest'),
        }),
      })

      const reply  = res.reply || res.message || "I couldn't process that. Please try again."
      const action = res.action || null   // { type: 'navigate', page, label }

      const botMsg = {
        id: Date.now() + 1,
        role: 'assistant',
        text: reply,
        confidence: res.confidence,
        category: res.category,
        source: res.source,
        action,
      }

      setMessages(prev => [...prev, botMsg])
      setFollowUps(Array.isArray(res.followUpSuggestions) ? res.followUpSuggestions : [])

      // Mark unread if panel is minimised
      if (isMinimised) setHasUnread(true)

      // Auto-execute navigation if user is on the chatbot page (full view)
      if (action?.type === 'navigate' && navigatorRef.current) {
        pendingNav.current = action
      }

    } catch (err) {
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'assistant',
        text: '⚠️ Unable to reach the AI. Please check your connection and try again.',
      }])
    } finally {
      setLoading(false)
    }
  }, [messages, isMinimised])

  const executeNav = useCallback((action) => {
    if (!action || !navigatorRef.current) return
    const routeMap = {
      feed:         '/citizen/feed',
      dashboard:    '/citizen/dashboard',
      submit:       '/citizen/submit',
      map:          '/citizen/map',
      reports:      '/citizen/reports',
      chatbot:      '/citizen/chatbot',
      feedback:     '/citizen/feedback',
      transparency: '/citizen/transparency',
    }
    const route = routeMap[action.page]
    if (route) {
      navigatorRef.current(route)
      closeChat()
    }
  }, [closeChat])

  const clearChat = useCallback(() => {
    setMessages([WELCOME_MSG])
    setFollowUps([])
  }, [])

  return (
    <ChatContext.Provider value={{
      messages,
      loading,
      followUps,
      isOpen,
      isMinimised,
      hasUnread,
      sendMessage,
      openChat,
      closeChat,
      clearChat,
      executeNav,
      registerNavigator,
    }}>
      {children}
    </ChatContext.Provider>
  )
}
