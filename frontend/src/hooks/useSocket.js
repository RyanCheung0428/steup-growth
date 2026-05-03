import { useEffect, useRef, useCallback } from 'react'
import { io } from 'socket.io-client'
import { useAuth } from '../contexts/AuthContext'
import { useChat } from '../contexts/ChatContext'

// Module-level singleton — survives Vite HMR so the WebSocket proxy doesn't
// get torn down and recreated on every file save, avoiding EPIPE errors.
let _socket = null
let _handlersBound = false
let _activityInterval = null
let _activityBound = false

const _ACTIVITY_EVENTS = ['click', 'keydown', 'scroll', 'touchstart', 'pointerdown']

function _onActivity() {
  if (_socket?.connected) {
    _socket.emit('client_activity', {})
  }
}

function _teardownActivityMonitor() {
  if (_activityInterval) {
    clearInterval(_activityInterval)
    _activityInterval = null
  }
  if (_activityBound) {
    _ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, _onActivity))
    _activityBound = false
  }
}

function _startActivityMonitor() {
  if (_activityInterval || _activityBound) return
  _onActivity()
  _activityInterval = setInterval(_onActivity, 15000)
  _ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, _onActivity))
  _activityBound = true
}

export function useSocket() {
  const { token } = useAuth()
  const { setMessages } = useChat()
  const currentRoomRef = useRef(null)
  const tokenRef = useRef(token)
  const setMessagesRef = useRef(setMessages)
  tokenRef.current = token
  setMessagesRef.current = setMessages

  const connect = useCallback(() => {
    if (!_socket) {
      _socket = io({
        auth: { token: tokenRef.current },
        transports: ['websocket', 'polling'],
      })
    } else if (!_socket.connected) {
      _socket.auth = { token: tokenRef.current }
      _socket.connect()
    }

    // Bind handlers only once — using .off() would strip socket.io internal
    // listeners and break the connection state machine.
    if (!_handlersBound && _socket) {
      _handlersBound = true
      _socket.on('connect', () => {
        console.log('Socket.IO connected')
      })
      _socket.on('connected', (data) => {
        console.log('Socket.IO authenticated:', data.message)
      })
      _socket.on('connect_error', (err) => {
        console.error('Socket.IO connection error:', err.message)
      })
      _socket.on('new_message', (data) => {
        if (data.temp_id) return
        if (data.sender === 'assistant') {
          setMessagesRef.current(prev => {
            if (prev.some(m => m.id === data.message_id)) return prev
            return [...prev, {
              id: data.message_id,
              conversation_id: data.conversation_id,
              sender: data.sender,
              content: data.content,
              created_at: data.created_at,
              uploaded_files: data.files || [],
            }]
          })
        }
      })
      _socket.on('idle_timeout', () => {
        alert('連線因閒置已超時，請重新整理頁面。')
      })
      _socket.on('refresh_required', () => {
        _socket.disconnect()
        _socket = null
        _handlersBound = false
        window.location.reload()
      })
    }

    _startActivityMonitor()
  }, [])

  const disconnect = useCallback(() => {
    // Intentionally does NOT disconnect the socket — the module-level
    // singleton survives HMR so rapid mount/unmount cycles don't tear
    // down the WebSocket proxy connection.
    _teardownActivityMonitor()
  }, [])

  const joinRoom = useCallback((conversationId) => {
    if (!_socket?.connected) return
    if (currentRoomRef.current && currentRoomRef.current !== conversationId) {
      _socket.emit('leave_room', { conversation_id: currentRoomRef.current })
    }
    _socket.emit('join_room', { conversation_id: conversationId })
    currentRoomRef.current = conversationId
  }, [])

  const leaveRoom = useCallback((conversationId) => {
    if (!_socket?.connected) return
    _socket.emit('leave_room', { conversation_id: conversationId })
    if (currentRoomRef.current === conversationId) {
      currentRoomRef.current = null
    }
  }, [])

  const startActivityMonitor = useCallback(() => {
    _startActivityMonitor()
  }, [])

  // If token changes (login/logout), reconnect with new auth
  useEffect(() => {
    if (!_socket) return
    _socket.auth = { token }
  }, [token])

  // Disconnect only on real page unload, not HMR
  useEffect(() => {
    const handleBeforeUnload = () => {
      _teardownActivityMonitor()
      if (_socket) {
        _socket.disconnect()
        _socket = null
        _handlersBound = false
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  useEffect(() => {
    return () => {
      _teardownActivityMonitor()
    }
  }, [])

  return { connect, disconnect, joinRoom, leaveRoom, startActivityMonitor, socketRef: { current: _socket } }
}