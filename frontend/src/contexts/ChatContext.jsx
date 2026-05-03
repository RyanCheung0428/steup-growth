import { createContext, useContext, useState, useCallback, useRef } from 'react'
import { useAuth } from './AuthContext'
import { useSettings } from './SettingsContext'
import { useI18n } from './I18nContext'

const ChatContext = createContext(null)

export function ChatProvider({ children }) {
  const { token, user, refreshToken } = useAuth()
  const settings = useSettings()
  const { t } = useI18n()

  const [activeConversationId, setActiveConversationId] = useState(null)
  const [messages, setMessages] = useState([])
  const [conversationHistory, setConversationHistory] = useState([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamStopped, setStreamStopped] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState([])
  const [botAvatar, setBotAvatar] = useState(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [previewActive, setPreviewActive] = useState(false)
  const [previewContent, setPreviewContent] = useState(null)
  const [welcomeMode, setWelcomeMode] = useState(true)
  const [conversationTitle, setConversationTitle] = useState('')
  const [conversationPinned, setConversationPinned] = useState(false)
  const conversationsCacheRef = useRef([])

  const authHeaders = useCallback(() => ({
    Authorization: `Bearer ${token}`,
  }), [token])

  const authHeadersJSON = useCallback(() => ({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }), [token])

  const addMessage = useCallback((msg) => {
    setMessages(prev => [...prev, msg])
  }, [])

  const updateLastBotMessage = useCallback((updater) => {
    setMessages(prev => {
      const lastBotIdx = prev.map((m, i) => ({ m, i })).filter(({ m }) => m.sender === 'assistant').pop()?.i
      if (lastBotIdx === undefined) return prev
      const updated = [...prev]
      const result = typeof updater === 'function' ? updater(updated[lastBotIdx]) : updater
      updated[lastBotIdx] = result
      return [...updated]
    })
  }, [])

  const resetMessages = useCallback(() => {
    setMessages([])
    setConversationHistory([])
    setActiveConversationId(null)
    setWelcomeMode(true)
    setConversationTitle('')
    setConversationPinned(false)
  }, [])

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed(prev => !prev)
  }, [])

  const openPreview = useCallback((filePath, fileName) => {
    setPreviewContent({ filePath, fileName })
    setPreviewActive(true)
  }, [])

  const closePreview = useCallback(() => {
    setPreviewActive(false)
    setTimeout(() => setPreviewContent(null), 350)
  }, [])

  return (
    <ChatContext.Provider value={{
      activeConversationId, setActiveConversationId,
      messages, setMessages, addMessage, updateLastBotMessage, resetMessages,
      conversationHistory, setConversationHistory,
      isStreaming, setIsStreaming,
      streamStopped, setStreamStopped,
      selectedFiles, setSelectedFiles,
      botAvatar, setBotAvatar,
      sidebarCollapsed, setSidebarCollapsed, toggleSidebar,
      previewActive, setPreviewActive, openPreview, closePreview,
      previewContent,
      welcomeMode, setWelcomeMode,
      conversationTitle, setConversationTitle,
      conversationPinned, setConversationPinned,
      conversationsCacheRef,
      authHeaders, authHeadersJSON,
      token, user, refreshToken,
      settings, t,
    }}>
      {children}
    </ChatContext.Provider>
  )
}

export function useChat() {
  const ctx = useContext(ChatContext)
  if (!ctx) throw new Error('useChat must be used within ChatProvider')
  return ctx
}

export default ChatContext