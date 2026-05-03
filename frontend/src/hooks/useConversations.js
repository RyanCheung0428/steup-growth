import { useState, useCallback, useRef } from 'react'
import { useChatApi } from './useChatApi'

export function useConversations() {
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(false)
  const cacheRef = useRef([])
  const api = useChatApi()

  const loadConversations = useCallback(async () => {
    setLoading(true)
    try {
      const convs = await api.fetchConversations()
      setConversations(convs)
      cacheRef.current = convs
      return convs
    } catch (err) {
      console.error('Failed to load conversations:', err)
      return []
    } finally {
      setLoading(false)
    }
  }, [api])

  const upsertConversation = useCallback((conv) => {
    setConversations(prev => {
      const idx = prev.findIndex(c => c.id === conv.id)
      if (idx >= 0) {
        const updated = [...prev]
        updated[idx] = { ...updated[idx], ...conv }
        return updated.sort((a, b) => {
          if (a.is_pinned !== b.is_pinned) return b.is_pinned ? 1 : -1
          return new Date(b.updated_at) - new Date(a.updated_at)
        })
      }
      return [conv, ...prev].sort((a, b) => {
        if (a.is_pinned !== b.is_pinned) return b.is_pinned ? 1 : -1
        return new Date(b.updated_at) - new Date(a.updated_at)
      })
    })
  }, [])

  const removeConversation = useCallback((id) => {
    setConversations(prev => prev.filter(c => c.id !== id))
  }, [])

  const renameConversation = async (id, title) => {
    const res = await api.updateConversation(id, { title })
    if (res.conversation) {
      upsertConversation(res.conversation)
    }
    return res
  }

  const togglePin = async (id, isPinned) => {
    const res = await api.updateConversation(id, { is_pinned: !isPinned })
    if (res.conversation) {
      upsertConversation(res.conversation)
    }
    return res
  }

  const deleteConversation = async (id) => {
    await api.deleteConversation(id)
    removeConversation(id)
  }

  return {
    conversations,
    loading,
    loadConversations,
    upsertConversation,
    removeConversation,
    renameConversation,
    togglePin,
    deleteConversation,
  }
}