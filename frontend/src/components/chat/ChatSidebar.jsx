import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useChat } from '../../contexts/ChatContext'
import { useAuth } from '../../contexts/AuthContext'
import { useI18n } from '../../contexts/I18nContext'
import { useConversations } from '../../hooks/useConversations'

export default function ChatSidebar({ onSelectConversation }) {
  const { t } = useI18n()
  const { logout } = useAuth()
  const {
    activeConversationId,
    sidebarCollapsed, toggleSidebar,
    setActiveConversationId, setMessages,
    setConversationHistory, setWelcomeMode,
    setConversationTitle, setConversationPinned,
    isStreaming,
  } = useChat()
  const {
    conversations, loading, loadConversations,
    renameConversation, togglePin, deleteConversation,
  } = useConversations()

  const [openMenuId, setOpenMenuId] = useState(null)
  const [renameId, setRenameId] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const menuRef = useRef(null)

  useEffect(() => {
    loadConversations()
  }, [])

  useEffect(() => {
    const handler = () => loadConversations()
    window.addEventListener('refresh-conversations', handler)
    return () => window.removeEventListener('refresh-conversations', handler)
  }, [loadConversations])

  useEffect(() => {
    const handler = (e) => {
      const conv = conversations.find(c => c.id === e.detail?.id)
      if (conv) {
        setRenameId(conv.id)
        setRenameValue(conv.title || '')
      }
    }
    window.addEventListener('rename-conversation', handler)
    return () => window.removeEventListener('rename-conversation', handler)
  }, [conversations])

  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target) && !e.target.closest('.conv-dots-btn')) {
        setOpenMenuId(null)
      }
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  const handleNewChat = () => {
    setActiveConversationId(null)
    setMessages([])
    setConversationHistory([])
    setWelcomeMode(true)
    setConversationTitle('')
    setConversationPinned(false)
  }

  const handleSelect = (conv) => {
    if (isStreaming) return
    setActiveConversationId(conv.id)
    setConversationTitle(conv.title || '')
    setConversationPinned(conv.is_pinned || false)
    setWelcomeMode(false)
    if (onSelectConversation) {
      onSelectConversation(conv)
    }
  }

  const handleRenameStart = (conv, e) => {
    e.stopPropagation()
    setRenameId(conv.id)
    setRenameValue(conv.title || '')
  }

  const handleRenameSubmit = async (id) => {
    if (!renameValue.trim()) {
      setRenameId(null)
      return
    }
    try {
      await renameConversation(id, renameValue.trim())
      if (activeConversationId === id) {
        setConversationTitle(renameValue.trim())
      }
      setRenameId(null)
      loadConversations()
    } catch { setRenameId(null) }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    try {
      await deleteConversation(deleteTarget.id)
      if (activeConversationId === deleteTarget.id) handleNewChat()
      loadConversations()
    } catch {}
    setDeleteTarget(null)
  }

  const handlePinClick = async (conv, e) => {
    e.stopPropagation()
    try {
      await togglePin(conv.id, conv.is_pinned)
      loadConversations()
    } catch {}
  }

  const handleSettings = () => {
    window.dispatchEvent(new CustomEvent('open-settings'))
  }

  const sidebarWidth = sidebarCollapsed ? 56 : 340

  return (
    <>
      <aside id="sidebar" style={{
        display: 'flex',
        flexDirection: 'column',
        width: sidebarWidth,
        flexShrink: 0,
        overflow: 'hidden',
        background: 'var(--ae-surface-soft)',
        transition: 'width 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
      }}>
        {/* Header — always visible */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 9px 4px',
          flexShrink: 0,
        }}>
          <button type="button" onClick={toggleSidebar} title={t('toggleSidebar', '切換側邊欄')} style={{
            border: 'none',
            background: 'transparent',
            borderRadius: 0,
            width: 42,
            height: 42,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--ae-text)',
            flexShrink: 0,
          }}>
            <i className="fas fa-bars" />
          </button>
          <h2 style={{
            margin: 0,
            fontSize: '1rem',
            fontWeight: 600,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            opacity: sidebarCollapsed ? 0 : 1,
            transition: 'opacity 0.15s',
          }}>
            {t('chat', '聊天')}
          </h2>
        </div>

        {/* Nav links — always visible, text hidden when collapsed */}
        <nav style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          padding: '0 10px',
          marginBottom: 8,
          flexShrink: 0,
        }}>
          <Link to="/" style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 12px',
            borderRadius: 12,
            color: 'var(--ae-text-muted)',
            textDecoration: 'none',
            fontSize: '0.9rem',
            fontWeight: 500,
            minHeight: 42,
            whiteSpace: 'nowrap',
            transition: 'background 0.15s, color 0.15s',
            overflow: 'hidden',
          }}>
            <i className="fas fa-house" style={{ flexShrink: 0, width: 20, textAlign: 'center' }} />
            <span style={{
              opacity: sidebarCollapsed ? 0 : 1,
              transition: 'opacity 0.15s',
              whiteSpace: 'nowrap',
            }}>{t('nav.home', '首頁')}</span>
          </Link>
          <Link to="/pose-detection" style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 12px',
            borderRadius: 12,
            color: 'var(--ae-text-muted)',
            textDecoration: 'none',
            fontSize: '0.9rem',
            fontWeight: 500,
            minHeight: 42,
            whiteSpace: 'nowrap',
            transition: 'background 0.15s, color 0.15s',
            overflow: 'hidden',
          }}>
            <i className="fas fa-person-running" style={{ flexShrink: 0, width: 20, textAlign: 'center' }} />
            <span style={{
              opacity: sidebarCollapsed ? 0 : 1,
              transition: 'opacity 0.15s',
              whiteSpace: 'nowrap',
            }}>{t('nav.pose', '姿態')}</span>
          </Link>
          <Link to="/video" style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 12px',
            borderRadius: 12,
            color: 'var(--ae-text-muted)',
            textDecoration: 'none',
            fontSize: '0.9rem',
            fontWeight: 500,
            minHeight: 42,
            whiteSpace: 'nowrap',
            transition: 'background 0.15s, color 0.15s',
            overflow: 'hidden',
          }}>
            <i className="fas fa-video" style={{ flexShrink: 0, width: 20, textAlign: 'center' }} />
            <span style={{
              opacity: sidebarCollapsed ? 0 : 1,
              transition: 'opacity 0.15s',
              whiteSpace: 'nowrap',
            }}>{t('nav.video', '影片')}</span>
          </Link>
        </nav>

        {/* Conversation list — hidden when collapsed */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          flex: 1,
          padding: '8px 10px',
          overflowY: 'auto',
          opacity: sidebarCollapsed ? 0 : 1,
          pointerEvents: sidebarCollapsed ? 'none' : 'auto',
          transition: 'opacity 0.15s',
        }}>
          <h3 style={{
            padding: '0 4px',
            fontSize: '0.78rem',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--ae-text-muted)',
            margin: 0,
            whiteSpace: 'nowrap',
          }}>
            {t('chat', '聊天')}
          </h3>
          <ul className="chat-list" style={{
            listStyle: 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            margin: '8px 0 0',
            padding: 0,
            minHeight: 0,
          }}>
            {loading && conversations.length === 0 && (
              <li style={{
                borderRadius: 12,
                background: 'var(--ae-surface-soft)',
                padding: '10px 12px',
                fontSize: '0.88rem',
                color: 'var(--ae-text-muted)',
              }}>
                {t('loading', '載入中...')}
              </li>
            )}
            {!loading && conversations.length === 0 && (
              <li style={{
                borderRadius: 12,
                background: 'var(--ae-surface-soft)',
                padding: '10px 12px',
                fontSize: '0.88rem',
                color: 'var(--ae-text-muted)',
              }}>
                {t('noConversations', '尚無對話')}
              </li>
            )}
            {conversations.map(conv => (
              <li
                key={conv.id}
                onClick={() => handleSelect(conv)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: 'pointer',
                  padding: '10px 12px',
                  borderRadius: 12,
                  background: activeConversationId === conv.id ? 'var(--ae-primary-faint)' : 'var(--ae-surface-soft)',
                  fontSize: '0.88rem',
                  position: 'relative',
                  transition: 'background 0.15s',
                }}
              >
                {renameId === conv.id ? (
                  <input
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleRenameSubmit(conv.id); if (e.key === 'Escape') setRenameId(null) }}
                    onBlur={() => handleRenameSubmit(conv.id)}
                    onClick={(e) => e.stopPropagation()}
                    autoFocus
                    style={{
                      flex: 1,
                      minWidth: 0,
                      border: '1px solid var(--ae-primary)',
                      borderRadius: 6,
                      padding: '2px 6px',
                      background: 'var(--ae-surface)',
                      color: 'var(--ae-text)',
                      outline: 'none',
                      fontSize: '0.88rem',
                    }}
                  />
                ) : (
                  <>
                    <span style={{
                      flex: 1,
                      minWidth: 0,
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      color: 'var(--ae-text)',
                    }}>
                      {conv.title || 'New Conversation'}
                    </span>
                    {conv.is_pinned && (
                      <i className="fas fa-thumbtack" style={{
                        fontSize: '0.7rem',
                        color: 'var(--ae-primary)',
                        flexShrink: 0,
                      }} />
                    )}
                    <button
                      className="conv-dots-btn"
                      onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === conv.id ? null : conv.id) }}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: 'var(--ae-text-muted)',
                        cursor: 'pointer',
                        padding: 4,
                        borderRadius: 6,
                        display: 'flex',
                        alignItems: 'center',
                        fontSize: '0.82rem',
                        flexShrink: 0,
                        transition: 'color 0.15s, background 0.15s',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--ae-text)'; e.currentTarget.style.background = 'var(--ae-surface-muted)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--ae-text-muted)'; e.currentTarget.style.background = 'transparent' }}
                    >
                      <i className="fas fa-ellipsis-v" />
                    </button>

                    {openMenuId === conv.id && (
                      <div ref={menuRef} style={{
                        position: 'absolute',
                        right: 12,
                        top: 'calc(100% + 6px)',
                        display: 'flex',
                        flexDirection: 'column',
                        minWidth: 160,
                        padding: 8,
                        background: 'var(--ae-surface)',
                        border: '1px solid var(--ae-border)',
                        borderRadius: 12,
                        boxShadow: 'var(--ae-shadow)',
                        zIndex: 6,
                      }}>
                        <button
                          className="conversation-action"
                          onClick={(e) => { e.stopPropagation(); handlePinClick(conv, e); setOpenMenuId(null) }}
                          style={{
                            border: 'none', background: 'transparent', borderRadius: 10,
                            padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10,
                            cursor: 'pointer', color: 'var(--ae-text)', fontSize: '0.88rem',
                            transition: 'background 0.15s',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--ae-surface-soft)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          <i className="fas fa-thumbtack" style={{ width: 18, textAlign: 'center', flexShrink: 0 }} />
                          <span>{conv.is_pinned ? t('unpinAction', '取消置頂') : t('pinAction', '置頂')}</span>
                        </button>
                        <button
                          className="conversation-action"
                          onClick={(e) => { handleRenameStart(conv, e); setOpenMenuId(null) }}
                          style={{
                            border: 'none', background: 'transparent', borderRadius: 10,
                            padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10,
                            cursor: 'pointer', color: 'var(--ae-text)', fontSize: '0.88rem',
                            transition: 'background 0.15s',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--ae-surface-soft)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          <i className="fas fa-pen" style={{ width: 18, textAlign: 'center', flexShrink: 0 }} />
                          <span>{t('renameAction', '重新命名')}</span>
                        </button>
                        <button
                          className="conversation-action"
                          onClick={(e) => { e.stopPropagation(); setDeleteTarget(conv); setOpenMenuId(null) }}
                          style={{
                            border: 'none', background: 'transparent', borderRadius: 10,
                            padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10,
                            cursor: 'pointer', color: 'var(--ae-danger)', fontSize: '0.88rem',
                            transition: 'background 0.15s',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--ae-danger-soft)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          <i className="fas fa-trash" style={{ width: 18, textAlign: 'center', flexShrink: 0 }} />
                          <span>{t('deleteAction', '刪除')}</span>
                        </button>
                      </div>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* Footer buttons — always visible, text hidden when collapsed */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          padding: '12px 10px 14px',
          flexShrink: 0,
        }}>
          <button type="button" onClick={handleNewChat} style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            minHeight: 42,
            padding: '0 12px',
            borderRadius: 10,
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            color: 'var(--ae-text)',
            fontSize: '0.88rem',
            transition: 'background 0.15s',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
          }}>
            <i className="fas fa-plus" style={{ fontSize: '0.88rem', flexShrink: 0 }} />
            <span style={{
              opacity: sidebarCollapsed ? 0 : 1,
              transition: 'opacity 0.15s',
              whiteSpace: 'nowrap',
            }}>{t('newChat', '新對話')}</span>
          </button>
          <button type="button" onClick={handleSettings} style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            minHeight: 42,
            padding: '0 12px',
            borderRadius: 10,
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            color: 'var(--ae-text)',
            fontSize: '0.88rem',
            transition: 'background 0.15s',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
          }}>
            <i className="fas fa-gear" style={{ fontSize: '0.88rem', flexShrink: 0 }} />
            <span style={{
              opacity: sidebarCollapsed ? 0 : 1,
              transition: 'opacity 0.15s',
              whiteSpace: 'nowrap',
            }}>{t('settings', '設定')}</span>
          </button>
          <button type="button" onClick={logout} style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            minHeight: 42,
            padding: '0 12px',
            borderRadius: 10,
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            color: 'var(--ae-danger)',
            fontSize: '0.88rem',
            transition: 'background 0.15s',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
          }}>
            <i className="fas fa-right-from-bracket" style={{ fontSize: '0.88rem', flexShrink: 0 }} />
            <span style={{
              opacity: sidebarCollapsed ? 0 : 1,
              transition: 'opacity 0.15s',
              whiteSpace: 'nowrap',
            }}>{t('logout', '登出')}</span>
          </button>
        </div>
      </aside>

      {/* Custom delete confirmation modal */}
      {deleteTarget && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 150,
          background: 'rgba(28, 28, 26, 0.38)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
          animation: 'fadeIn 0.2s ease',
        }} onClick={() => setDeleteTarget(null)}>
          <div style={{
            background: 'var(--ae-surface)',
            border: '1px solid var(--ae-border)',
            borderRadius: 20,
            boxShadow: 'var(--ae-shadow)',
            padding: 28,
            maxWidth: 420,
            width: '100%',
          }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 8px', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: 10, color: 'var(--ae-text)' }}>
              <i className="fas fa-exclamation-triangle" style={{ color: 'var(--ae-danger)' }} />
              {t('deleteConfirmTitle', '確認刪除')}
            </h3>
            <p style={{ margin: '0 0 24px', color: 'var(--ae-text-muted)', fontSize: '0.92rem', lineHeight: 1.6 }}>
              {t('deleteConfirm', '確定要刪除此對話嗎？刪除後無法恢復。')}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setDeleteTarget(null)} style={{
                padding: '10px 20px',
                borderRadius: 10,
                border: '1px solid var(--ae-border)',
                background: 'var(--ae-surface)',
                color: 'var(--ae-text)',
                cursor: 'pointer',
                fontSize: '0.92rem',
              }}>
                {t('cancel', '取消')}
              </button>
              <button onClick={handleDeleteConfirm} style={{
                padding: '10px 20px',
                borderRadius: 10,
                border: 'none',
                background: 'var(--ae-danger)',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '0.92rem',
              }}>
                <i className="fas fa-trash" style={{ marginRight: 6 }} />
                {t('deleteAction', '刪除')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}