import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { makeApiCall, apiClient, authStorage } from '../services/api'

const ChatContext = createContext(null)

export const useChatContext = () => {
  const ctx = useContext(ChatContext)
  if (!ctx) throw new Error('useChatContext must be used within ChatProvider')
  return ctx
}

export function ChatProvider({ children }) {
  const { t, i18n } = useTranslation('chatbot')
  const currentLang = (i18n.resolvedLanguage || i18n.language || 'en').split('-')[0].toLowerCase()
  const welcomeText = t('floating.welcome')

  const [messages, setMessages]         = useState([{ id: 'welcome', role: 'assistant', text: welcomeText }])
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
    setMessages(prev => {
      if (prev.length === 1 && prev[0].id === 'welcome' && prev[0].text !== welcomeText) {
        return [{ id: 'welcome', role: 'assistant', text: welcomeText }]
      }
      return prev
    })
  }, [welcomeText])

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
          language: currentLang,
        }),
      })

      const reply  = res?.reply || res?.message || t('floating.fallbackError')
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
        text: t('floating.connectionError'),
      }])
      if (isMinimisedRef.current) setHasUnread(true)
    } finally {
      setLoading(false)
    }
  }, [currentLang, t])

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
    const reset = [{ id: 'welcome', role: 'assistant', text: welcomeText }]
    messagesRef.current = reset
    setMessages(reset)
    setFollowUps([])
    setHasUnread(false)
  }, [welcomeText])

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
