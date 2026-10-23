import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, useLocation } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import { ChatProvider } from './context/ChatContext'
import FloatingChat from './components/FloatingChat'
import './i18n'
import './index.css'

// Only show the floating bubble on citizen pages, not on the full chatbot page itself
function FloatingChatGate() {
  const location = useLocation()
  const isCitizenArea  = location.pathname.startsWith('/citizen')
  const isFullChatPage = location.pathname === '/citizen/chatbot'
  if (!isCitizenArea || isFullChatPage) return null
  return <FloatingChat />
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ChatProvider>
          <App />
          <FloatingChatGate />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3000,
              style: {
                borderRadius: '0px',
                border: '1px solid #111827',
                background: '#FFFFFF',
                color: '#111827',
                fontFamily: 'Inter, sans-serif',
                fontSize: '13px',
                boxShadow: 'none',
              },
            }}
          />
        </ChatProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)
