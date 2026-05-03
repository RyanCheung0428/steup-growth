import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { ChatProvider, useChat } from '../contexts/ChatContext'
import { useChatApi } from '../hooks/useChatApi'
import { useFileUpload } from '../hooks/useFileUpload'
import { useVoiceInput } from '../hooks/useVoiceInput'
import { useTypewriter } from '../hooks/useTypewriter'
import { useSocket } from '../hooks/useSocket'
import { useI18n } from '../contexts/I18nContext'
import { useTTS } from '../hooks/useTTS'
import FilePreviewRail from '../components/chat/FilePreviewRail'
import PlusMenu from '../components/chat/PlusMenu'
import ModelDropdown from '../components/chat/ModelDropdown'
import WebcamModal from '../components/chat/WebcamModal'
import MessageList from '../components/chat/MessageList'
import WelcomeScreen from '../components/chat/WelcomeScreen'
import ChatHeader from '../components/chat/ChatHeader'
import ChatSidebar from '../components/chat/ChatSidebar'
import PreviewPanel from '../components/chat/PreviewPanel'
import MediaViewer from '../components/chat/MediaViewer'
import SettingsModal from '../components/SettingsModal'

export default function ChatPage() {
  return (
    <ChatProvider>
      <ChatInner />
      <SettingsModal />
    </ChatProvider>
  )
}

function ChatInner() {
  const chat = useChat()
  const api = useChatApi()
  const { addFiles, removeFile, clearFiles, selectedFiles, setSelectedFiles } = useFileUpload()
  const textareaRef = useRef(null)
  const { connect, disconnect, joinRoom, leaveRoom, startActivityMonitor } = useSocket()
  const typewriter = useTypewriter()
  const tts = useTTS()
  const { t } = useI18n()

  const [inputValue, setInputValue] = useState('')
  const [showTyping, setShowTyping] = useState(false)
  const [webcamOpen, setWebcamOpen] = useState(false)
  const [mediaViewer, setMediaViewer] = useState(null)
  const twMsgIdRef = useRef(null)

  const {
    activeConversationId, setActiveConversationId,
    messages, setMessages, addMessage, updateLastBotMessage, resetMessages,
    conversationHistory, setConversationHistory,
    isStreaming, setIsStreaming, streamStopped, setStreamStopped,
    sidebarCollapsed, toggleSidebar,
    previewContent, previewActive, openPreview, closePreview,
    welcomeMode, setWelcomeMode,
    conversationTitle, setConversationTitle, conversationPinned, setConversationPinned,
    botAvatar, setBotAvatar,
    settings, user, token,
  } = chat

  const displayMessages = useMemo(() => {
    return messages.map(m => {
      if (m.id === twMsgIdRef.current && typewriter.displayText !== undefined) {
        return { ...m, content: typewriter.displayText, isTyping: false }
      }
      return m
    })
  }, [messages, typewriter.displayText])

  useEffect(() => {
    connect()
    const cleanup = startActivityMonitor()
    return () => {
      disconnect()
      cleanup?.()
    }
  }, [])

  useEffect(() => {
    if (activeConversationId) {
      joinRoom(activeConversationId)
      return () => leaveRoom(activeConversationId)
    }
  }, [activeConversationId])

  useEffect(() => {
    api.getModel().then(data => {
      if (data?.bot_avatar) setBotAvatar(data.bot_avatar)
    }).catch(() => {})
  }, [])

  const loadConversationMessages = useCallback(async (convId) => {
    try {
      const data = await api.fetchMessages(convId)
      const msgs = (data.messages || []).map(m => ({
        ...m,
        userAvatar: user?.avatar || null,
        botAvatar: botAvatar,
      }))
      setMessages(msgs)
      const history = msgs.map(m => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.content,
      }))
      setConversationHistory(history)
    } catch (err) {
      console.error('Failed to load messages:', err)
    }
  }, [api, user, botAvatar])

  const handleOpenConversation = useCallback(async (conv) => {
    leaveRoom(activeConversationId)
    setActiveConversationId(conv.id)
    setConversationTitle(conv.title || '')
    setConversationPinned(conv.is_pinned || false)
    setWelcomeMode(false)
    joinRoom(conv.id)
    await loadConversationMessages(conv.id)
  }, [activeConversationId])

  const sendMessage = useCallback(async () => {
    const text = inputValue.trim()
    if (!text && selectedFiles.length === 0) return
    if (isStreaming) return

    setInputValue('')
    setStreamStopped(false)
    setIsStreaming(true)
    setWelcomeMode(false)

    const currentFiles = [...selectedFiles]
    // Defer blob URL cleanup: React hasn't rendered the optimistic images yet
    // clearing now would revoke their object URLs before <img> can load them

    const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2)}`

    const userMsg = {
      id: tempId,
      sender: 'user',
      content: text,
      uploaded_files: currentFiles.map(f => ({
        url: f.objectUrl,
        name: f.name,
        mime_type: f.mimeType,
      })),
      created_at: new Date().toISOString(),
      isOptimistic: true,
    }

    if (!text && currentFiles.length > 0) {
      userMsg.content = text || '[File attachment]'
    }

    setMessages(prev => [...prev, { ...userMsg, userAvatar: user?.avatar || null }])
    setConversationHistory(prev => [...prev, { role: 'user', content: userMsg.content }])

    let convId = activeConversationId

    if (!convId) {
      try {
        const data = await api.createConversation(text?.slice(0, 50) || 'New Conversation')
        convId = data.conversation_id
        setActiveConversationId(convId)
        setConversationTitle(data.conversation?.title || text?.slice(0, 50) || 'New Conversation')
        joinRoom(convId)
        window.dispatchEvent(new CustomEvent('refresh-conversations'))
      } catch (err) {
        setIsStreaming(false)
        console.error('Failed to create conversation:', err)
        return
      }
    }

    let uploadedFileUrls = []
    let fileMimeTypes = []

    if (currentFiles.length > 0) {
      try {
        const msgResult = await api.addMessage({
          conversationId: convId,
          content: userMsg.content,
          sender: 'user',
          tempId,
          files: currentFiles.map(f => f.file),
        })
        uploadedFileUrls = msgResult?.message?.uploaded_files || []
        fileMimeTypes = currentFiles.map(f => f.mimeType)
        // Update optimistic message to use server (GCS) URLs so MediaViewer/PreviewPanel work after send
        if (uploadedFileUrls.length > 0) {
          setMessages(prev => prev.map(m => {
            if (m.id === tempId) {
              return {
                ...m,
                isOptimistic: false,
                uploaded_files: uploadedFileUrls.map((url, i) => ({
                  url,
                  name: currentFiles[i]?.name || url.split('/').pop(),
                  mime_type: currentFiles[i]?.mimeType || '',
                })),
              }
            }
            return m
          }))
        }
      } catch (err) {
        console.error('Failed to save user message with files:', err)
        updateLastBotMessage(prev => ({
          ...prev,
          content: t('errorMsg', '抱歉，發生了錯誤。請稍後再試。'),
          isTyping: false,
        }))
        setIsStreaming(false)
        clearFiles()
        return
      }
    } else {
      try {
        await api.addMessage({
          conversationId: convId,
          content: userMsg.content,
          sender: 'user',
          tempId,
        })
      } catch (err) {
        console.error('Failed to save user message:', err)
      }
    }

    // Safe to revoke blob URLs now — optimistic images are already rendered in the DOM
    clearFiles()

    const botTempId = `bot_${Date.now()}`
    let firstChunk = true

    setShowTyping(true)

    await api.streamChatMessage({
      message: userMsg.content,
      conversationId: convId,
      fileUrls: uploadedFileUrls.length > 0 ? uploadedFileUrls : undefined,
      fileMimeTypes: fileMimeTypes.length > 0 ? fileMimeTypes : undefined,
      history: conversationHistory,
      onChunk: (chunk) => {
        if (firstChunk) {
          firstChunk = false
          setShowTyping(false)
          const botMsg = {
            id: botTempId,
            sender: 'assistant',
            content: '',
            created_at: new Date().toISOString(),
            botAvatar,
          }
          twMsgIdRef.current = botTempId
          setMessages(prev => [...prev, botMsg])
          typewriter.start()
        }
        typewriter.append(chunk)
      },
      onComplete: async () => {
        typewriter.done(() => {
          const finalContent = typewriter.getFullText() || t('stoppedMsg', '你已停止了這則回應')
          setMessages(prev => prev.map(m => {
            if (m.id === botTempId) return { ...m, content: finalContent, isTyping: false }
            return m
          }))
          setIsStreaming(false)
          setConversationHistory(prev => [...prev, { role: 'assistant', content: finalContent }])
          twMsgIdRef.current = null
          api.addMessage({
            conversationId: convId,
            content: finalContent,
            sender: 'assistant',
          }).catch(() => {})
        })
      },
      onError: (err) => {
        typewriter.flush()
        setShowTyping(false)
        const errorMsg = t('errorMsg', '抱歉，發生了錯誤。請稍後再試。')
        if (twMsgIdRef.current) {
          setMessages(prev => prev.map(m => {
            if (m.id === botTempId) return { ...m, content: errorMsg, isTyping: false }
            return m
          }))
          twMsgIdRef.current = null
        } else {
          setMessages(prev => [...prev, {
            id: botTempId,
            sender: 'assistant',
            content: errorMsg,
            created_at: new Date().toISOString(),
            botAvatar,
          }])
        }
        setIsStreaming(false)
      },
    })
  }, [
    inputValue, selectedFiles, isStreaming, activeConversationId,
    conversationHistory, clearFiles, user, botAvatar, t, api,
    setMessages, updateLastBotMessage, setConversationHistory,
    setIsStreaming, setWelcomeMode, setStreamStopped,
    setActiveConversationId, joinRoom, setConversationTitle,
  ])

  const handleStop = useCallback(() => {
    api.abortStream()
    typewriter.flush()
    setStreamStopped(true)
    setIsStreaming(false)
    setShowTyping(false)
    const mid = twMsgIdRef.current
    if (mid) {
      setMessages(prev => prev.map(m => {
        if (m.id === mid) return { ...m, content: typewriter.getFullText() || t('stoppedMsg', '你已停止了這則回應'), isTyping: false }
        return m
      }))
      twMsgIdRef.current = null
    }
  }, [api, typewriter, t, setStreamStopped, setIsStreaming, setMessages])

  const handleTextareaChange = (e) => {
    setInputValue(e.target.value)
    const ta = e.target
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 140) + 'px'
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const handleFileInput = (e) => {
    addFiles(Array.from(e.target.files))
    e.target.value = ''
  }

  const handleWebcamCapture = (file) => {
    addFiles([file])
  }

  const handleFileClick = (url, type, fileName) => {
    if (type === 'image' || type === 'video') {
      setMediaViewer({ url, type, fileName })
    } else {
      openPreview(url, fileName)
    }
  }

  const handleNewChat = () => {
    resetMessages()
  }

  const renderTTSButton = (msg) => {
    if (msg.sender !== 'assistant' || msg.isTyping) return null
    const isSpeaking = tts.currentButton === msg.id
    return (
      <button
        className="speak-btn"
        onClick={() => tts.speakMessage(msg.content, msg.id)}
        style={{
          marginTop: '10px',
          border: 'none',
          background: 'transparent',
          color: 'inherit',
          cursor: 'pointer',
          opacity: isSpeaking ? 1 : 0.72,
          padding: '6px 10px',
          minWidth: '36px',
          minHeight: '36px',
          borderRadius: '50%',
          transition: 'opacity 0.15s, background 0.15s',
        }}
        title={t('readMessage', '朗讀訊息')}
      >
        <i className={`fas ${isSpeaking ? 'fa-stop' : 'fa-volume-up'}`} />
      </button>
    )
  }

  return (
    <div className="chatbox-page" style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <main className="ae-main chatbox-shell" style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        width: '100%',
        maxWidth: '100%',
        padding: 0,
        margin: 0,
        minHeight: 0,
        flexBasis: 0,
        height: 'auto',
      }}>
        <div id="main-content" style={{
          display: 'grid',
          gridTemplateColumns: previewActive
            ? (sidebarCollapsed ? '56px minmax(0, 0.95fr) minmax(360px, 0.75fr)' : '340px minmax(0, 0.95fr) minmax(360px, 0.75fr)')
            : (sidebarCollapsed ? '56px 1fr' : '340px 1fr'),
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          transition: 'grid-template-columns 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
        }}>
          <ChatSidebar onSelectConversation={handleOpenConversation} />

          <section id="chat-container" style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            minWidth: 0,
            padding: 0,
            overflow: 'hidden',
            borderRadius: 0,
            border: 'none',
            boxShadow: 'none',
            background: 'var(--ae-surface)',
          }}>
            <ChatHeader />

            {welcomeMode ? (
              <WelcomeScreen />
            ) : (
              <MessageList
                messages={displayMessages}
                isStreaming={isStreaming}
                showTyping={showTyping}
                onFileClick={handleFileClick}
                renderTTSButton={renderTTSButton}
              />
            )}

            <div id="input-container" style={{ padding: '18px 20px 20px' }}>
              <div className="input-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="input-main-row" style={{ display: 'flex', gap: 0, alignItems: 'flex-end' }}>
                  <div className="input-field-wrapper" style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'stretch',
                    flex: 1,
                    border: '1px solid var(--ae-border)',
                    borderRadius: '16px',
                    background: 'var(--ae-surface-soft)',
                    transition: 'border-color 0.15s',
                  }}>
                    {selectedFiles.length > 0 && (
                      <FilePreviewRail files={selectedFiles} onRemove={removeFile} onFileClick={(url, type, fileName) => {
                        if (type === 'image' || type === 'video') {
                          setMediaViewer({ url, type, fileName })
                        } else {
                          openPreview(url, fileName)
                        }
                      }} />
                    )}

                    <div className="input-field-row" style={{ display: 'flex', alignItems: 'center' }}>
                      <div className="input-field-left" style={{ display: 'flex', alignItems: 'center', flexShrink: 0, padding: '10px 0 10px 8px' }}>
                        <PlusMenu
                          onFileUpload={() => document.getElementById('chat-file-input')?.click()}
                          onVoiceInput={() => {}}
                          onWebcam={() => setWebcamOpen(true)}
                          isRecording={false}
                        />
                      </div>

                      <textarea
                        ref={textareaRef}
                        id="messageInput"
                        rows="1"
                        placeholder={t('placeholder', '在這裡輸入您的問題...')}
                        value={inputValue}
                        onChange={handleTextareaChange}
                        onKeyDown={handleKeyDown}
                        style={{
                          flex: 1,
                          minHeight: '52px',
                          maxHeight: '140px',
                          resize: 'none',
                          border: 'none',
                          background: 'transparent',
                          padding: '16px 4px',
                          color: 'var(--ae-text)',
                          outline: 'none',
                          scrollbarWidth: 'none',
                          fontFamily: 'inherit',
                          fontSize: '1rem',
                          lineHeight: 1.5,
                        }}
                      />
                      <input
                        id="chat-file-input"
                        type="file"
                        accept="image/*,video/*,application/pdf"
                        multiple
                        style={{ display: 'none' }}
                        onChange={handleFileInput}
                      />

                      <div className="input-field-right" style={{
                        display: 'flex',
                        alignItems: 'center',
                        flexShrink: 0,
                        gap: '10px',
                        padding: '10px 20px 10px 0',
                      }}>
                        <ModelDropdown />
                        <button
                          type="button"
                          id="sendButton"
                          onClick={isStreaming ? handleStop : sendMessage}
                          title={isStreaming ? t('stopGenerating', '停止生成') : t('sendMessage', '發送訊息')}
                          style={{
                            border: 'none',
                            background: 'transparent',
                            color: isStreaming ? 'var(--ae-danger)' : 'var(--ae-text-muted)',
                            borderRadius: '8px',
                            width: '34px',
                            height: '34px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                          }}
                        >
                          <i className={`fas ${isStreaming ? 'fa-stop-circle' : 'fa-paper-plane'}`} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {previewActive && previewContent && (
            <PreviewPanel previewContent={previewContent} onClose={closePreview} />
          )}
        </div>
      </main>

      {webcamOpen && (
        <WebcamModal
          onClose={() => setWebcamOpen(false)}
          onCapture={handleWebcamCapture}
        />
      )}

      {mediaViewer && (
        <MediaViewer
          url={mediaViewer.url}
          type={mediaViewer.type}
          fileName={mediaViewer.fileName}
          onClose={() => setMediaViewer(null)}
        />
      )}
    </div>
  )
}