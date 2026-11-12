import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'
import { makeApiCall, apiClient, authStorage } from '../services/api'

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
  const navigatorRef                    = useRef(null)      // injected by component
  const messagesRef                     = useRef(messages)
  const isMinimisedRef                  = useRef(isMinimised)
  const msgSeqRef                       = useRef(0)
  const guestSessionRef                 = useRef(`guest_${Math.random().toString(36).slice(2, 10)}`)

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  useEffect(() => {
    isMinimisedRef.current = isMinimised
  }, [isMinimised])

  const nextMsgId = () => `msg_${Date.now()}_${++msgSeqRef.current}`

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
    setIsOpen(false)
    setIsMinimised(true)
  }, [])

  const sendMessage = useCallback(async (text) => {
    const trimmed = text?.trim()
    if (!trimmed) return

    const userMsg = { id: nextMsgId(), role: 'user', text: trimmed }
    const updatedMessages = [...messagesRef.current, userMsg]
    messagesRef.current = updatedMessages
    setMessages(updatedMessages)
    setLoading(true)

    const historyForApi = updatedMessages
      .slice(-8)
      .map(m => ({ type: m.role === 'assistant' ? 'bot' : 'user', text: m.text }))

    const token = authStorage.getToken()
    const userId = 'session_' + (token ? token.slice(-8) : guestSessionRef.current)

    try {
      const res = await makeApiCall(apiClient.chatbot.message, {
        method: 'POST',
        body: JSON.stringify({
          message: trimmed,
          conversationHistory: historyForApi,
          userId,
        }),
      })

      const reply  = res?.reply || res?.message || "I couldn't process that. Please try again."
      const action = res?.action || null   // { type: 'navigate', page, label }

      const botMsg = {
        id: nextMsgId(),
        role: 'assistant',
        text: reply,
        confidence: res?.confidence,
        category: res?.category,
        source: res?.source,
        action,
      }

      setMessages(prev => [...prev, botMsg])
      setFollowUps(Array.isArray(res?.followUpSuggestions) ? res.followUpSuggestions : [])

      // Mark unread if panel is currently minimised
      if (isMinimisedRef.current) setHasUnread(true)

    } catch (err) {
      setMessages(prev => [...prev, {
        id: nextMsgId(),
        role: 'assistant',
        text: '⚠️ Unable to reach the AI. Please check your connection and try again.',
      }])
      if (isMinimisedRef.current) setHasUnread(true)
    } finally {
      setLoading(false)
    }
  }, [])

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
    const key = typeof action.page === 'string' ? action.page.trim().toLowerCase() : ''
    const route = routeMap[key]
    if (route) {
      navigatorRef.current(route)
      closeChat()
    }
  }, [closeChat])

  const clearChat = useCallback(() => {
    messagesRef.current = [WELCOME_MSG]
    setMessages([WELCOME_MSG])
    setFollowUps([])
    setHasUnread(false)
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
