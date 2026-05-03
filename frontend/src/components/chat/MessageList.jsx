import { useRef, useEffect } from 'react'
import MessageBubble from './MessageBubble'
import TypingIndicator from './TypingIndicator'

export default function MessageList({ messages, isStreaming, showTyping, onFileClick, renderTTSButton }) {
  const containerRef = useRef(null)
  const bottomRef = useRef(null)
  const isNearBottomRef = useRef(true)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleScroll = () => {
      const threshold = 100
      isNearBottomRef.current = container.scrollHeight - container.scrollTop - container.clientHeight < threshold
    }
    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    if (isNearBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, showTyping])

  return (
    <div ref={containerRef} id="messages" style={{
      flex: 1,
      overflowY: 'auto',
      padding: '22px',
      display: 'flex',
      flexDirection: 'column',
      gap: '18px',
      background: 'transparent',
    }}>
      {messages.map((msg, idx) => (
        <MessageBubble
          key={msg.id || msg.temp_id || idx}
          message={msg}
          isUser={msg.sender === 'user'}
          onFileClick={onFileClick}
          ttsButton={msg.sender === 'assistant' && !msg.isTyping ? renderTTSButton?.(msg) : null}
        />
      ))}
      {showTyping && <TypingIndicator />}
      <div ref={bottomRef} />
    </div>
  )
}