import { useState, useCallback, useRef, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { API_BASE } from '../lib/apiBase'

export function useChatApi() {
  const { token, refreshToken } = useAuth()
  const abortRef = useRef(null)

  const authHeaders = useCallback((contentType) => {
    const h = { Authorization: `Bearer ${token}` }
    if (contentType) h['Content-Type'] = contentType
    return h
  }, [token])

  const fetchWithAuth = useCallback(async (url, options = {}) => {
    let res = await fetch(url, { ...options, headers: { ...authHeaders(options.contentType), ...options.headers } })
    if (res.status === 401 || res.status === 422) {
      const newToken = await refreshToken()
      if (newToken) {
        res = await fetch(url, { ...options, headers: { Authorization: `Bearer ${newToken}`, ...options.headers } })
      } else {
        throw new Error('Auth failed')
      }
    }
    return res
  }, [authHeaders, refreshToken])

  const streamChatMessage = useCallback(async ({ message, conversationId, fileUrls, fileMimeTypes, history, onChunk, onComplete, onError }) => {
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const formData = new FormData()
      formData.append('message', message)
      if (conversationId) formData.append('conversation_id', conversationId)
      if (fileUrls && fileUrls.length > 0) formData.append('file_urls', JSON.stringify(fileUrls))
      if (fileMimeTypes && fileMimeTypes.length > 0) formData.append('file_mime_types', JSON.stringify(fileMimeTypes))
      if (history && history.length > 0) formData.append('history', JSON.stringify(history))

      const res = await fetch(`${API_BASE}/chat/stream`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
        signal: controller.signal,
      })

      if (!res.ok) {
        if (res.status === 401 || res.status === 422) {
          const newToken = await refreshToken()
          if (newToken) {
            const retryRes = await fetch(`${API_BASE}/chat/stream`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${newToken}` },
              body: formData,
              signal: controller.signal,
            })
            if (!retryRes.ok) throw new Error(`Stream failed: ${retryRes.status}`)
            return processStream(retryRes, onChunk, onComplete, onError)
          }
        }
        throw new Error(`Stream failed: ${res.status}`)
      }

      return processStream(res, onChunk, onComplete, onError)
    } catch (err) {
      if (err.name === 'AbortError') return
      onError && onError(err)
    }
  }, [token, refreshToken])

  const processStream = async (res, onChunk, onComplete, onError) => {
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith('data: ')) continue
          const data = trimmed.slice(6)
          if (data === '[DONE]') continue
          try {
            const text = JSON.parse(data)
            const cleaned = stripAIPrefixes(typeof text === 'string' ? text : String(text))
            onChunk && onChunk(cleaned)
          } catch {
            const cleaned = stripAIPrefixes(data)
            if (cleaned) onChunk && onChunk(cleaned)
          }
        }
      }
      onComplete && onComplete()
    } catch (err) {
      if (err.name !== 'AbortError') onError && onError(err)
    }
  }

  const stripAIPrefixes = (text) => {
    return text.replace(/^(Assistant|AI|Bot|System|Human):\s*/i, '')
  }

  const abortStream = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
  }, [])

  const fetchConversations = useCallback(async () => {
    const res = await fetchWithAuth(`${API_BASE}/conversations`)
    if (!res.ok) throw new Error('Failed to fetch conversations')
    const data = await res.json()
    return (data.conversations || []).sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return b.is_pinned ? 1 : -1
      return new Date(b.updated_at) - new Date(a.updated_at)
    })
  }, [fetchWithAuth])

  const createConversation = useCallback(async (title) => {
    const res = await fetchWithAuth(`${API_BASE}/conversations`, {
      method: 'POST',
      contentType: 'application/json',
      body: JSON.stringify({ title: title || 'New Conversation' }),
    })
    if (!res.ok) throw new Error('Failed to create conversation')
    return res.json()
  }, [fetchWithAuth])

  const updateConversation = useCallback(async (id, updates) => {
    const res = await fetchWithAuth(`${API_BASE}/conversations/${id}`, {
      method: 'PATCH',
      contentType: 'application/json',
      body: JSON.stringify(updates),
    })
    if (!res.ok) throw new Error('Failed to update conversation')
    return res.json()
  }, [fetchWithAuth])

  const deleteConversation = useCallback(async (id) => {
    const res = await fetchWithAuth(`${API_BASE}/conversations/${id}`, {
      method: 'DELETE',
    })
    if (!res.ok) throw new Error('Failed to delete conversation')
    return res.json()
  }, [fetchWithAuth])

  const addMessage = useCallback(async ({ conversationId, content, sender = 'user', metadata = null, files = null, tempId = null }) => {
    let res
    if (files && files.length > 0) {
      const formData = new FormData()
      formData.append('conversation_id', conversationId)
      formData.append('sender', sender)
      formData.append('content', content)
      if (metadata) formData.append('metadata', JSON.stringify(metadata))
      if (tempId) formData.append('temp_id', tempId)
      for (const f of files) formData.append('files', f)
      res = await fetch(`${API_BASE}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
    } else {
      const body = { conversation_id: conversationId, sender, content }
      if (metadata) body.metadata = metadata
      if (tempId) body.temp_id = tempId
      res = await fetch(`${API_BASE}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    }
    if (!res.ok) throw new Error('Failed to add message')
    return res.json()
  }, [token])

  const fetchMessages = useCallback(async (conversationId) => {
    const res = await fetchWithAuth(`${API_BASE}/conversations/${conversationId}/messages`)
    if (!res.ok) throw new Error('Failed to fetch messages')
    return res.json()
  }, [fetchWithAuth])

  const getModel = useCallback(async () => {
    const res = await fetchWithAuth(`${API_BASE}/api/user/model`)
    if (!res.ok) throw new Error('Failed to get model')
    return res.json()
  }, [fetchWithAuth])

  const setModel = useCallback(async (aiModel, aiProvider) => {
    const res = await fetchWithAuth(`${API_BASE}/api/user/model`, {
      method: 'POST',
      contentType: 'application/json',
      body: JSON.stringify({ ai_model: aiModel, ai_provider: aiProvider }),
    })
    if (!res.ok) throw new Error('Failed to set model')
    return res.json()
  }, [fetchWithAuth])

  const uploadFile = useCallback(async (conversationId, files, message) => {
    const formData = new FormData()
    formData.append('conversation_id', conversationId)
    if (message) formData.append('message', message)
    for (const f of files) formData.append('files', f)
    const res = await fetch(`${API_BASE}/api/upload_file`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    })
    if (!res.ok) throw new Error('Failed to upload file')
    return res.json()
  }, [token])

  return {
    streamChatMessage,
    abortStream,
    fetchConversations,
    createConversation,
    updateConversation,
    deleteConversation,
    addMessage,
    fetchMessages,
    getModel,
    setModel,
    uploadFile,
  }
}