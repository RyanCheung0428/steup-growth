import { useState, useRef, useEffect } from 'react'
import { useChat } from '../../contexts/ChatContext'
import { useI18n } from '../../contexts/I18nContext'
import { useConversations } from '../../hooks/useConversations'

export default function ChatHeader() {
  const { t } = useI18n()
  const {
    activeConversationId, conversationTitle, conversationPinned,
    setConversationPinned, setWelcomeMode,
    setMessages, setConversationHistory, setActiveConversationId,
  } = useChat()
  const { togglePin, deleteConversation } = useConversations()
  const [menuOpen, setMenuOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  const handlePin = async () => {
    if (!activeConversationId) return
    try {
      await togglePin(activeConversationId, conversationPinned)
      setConversationPinned(!conversationPinned)
      window.dispatchEvent(new CustomEvent('refresh-conversations'))
    } catch {}
    setMenuOpen(false)
  }

  const handleRename = () => {
    setMenuOpen(false)
    if (activeConversationId) {
      window.dispatchEvent(new CustomEvent('rename-conversation', { detail: { id: activeConversationId } }))
    }
  }

  const handleDelete = async () => {
    if (!activeConversationId) return
    try {
      await deleteConversation(activeConversationId)
      setActiveConversationId(null)
      setMessages([])
      setConversationHistory([])
      setWelcomeMode(true)
      window.dispatchEvent(new CustomEvent('refresh-conversations'))
    } catch {}
    setMenuOpen(false)
    setDeleteTarget(false)
  }

  if (!activeConversationId) return null

  return (
    <>
    <div id="chat-header" style={{
      display: 'grid',
      gridTemplateColumns: '1fr auto 1fr',
      alignItems: 'center',
      gap: '12px',
      padding: '12px 20px',
      minHeight: '56px',
    }}>
      <div className="chat-header-left" style={{ display: 'flex', alignItems: 'center', gap: '8px', justifySelf: 'start' }}>
        <a className="chat-header-brand" href="/" style={{
          fontSize: '1rem',
          fontWeight: 700,
          letterSpacing: '-0.02em',
          color: 'var(--ae-text)',
          textDecoration: 'none',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          whiteSpace: 'nowrap',
        }}>
          <i className="fas fa-baby" style={{ color: 'var(--ae-primary)', fontSize: '1.1rem' }} />
          Steup Growth
        </a>
      </div>

      <div className="chat-header-center" style={{ display: 'flex', alignItems: 'center', gap: '8px', justifySelf: 'center', minWidth: 0, maxWidth: '400px' }}>
        <span id="chatHeaderTitle" style={{
          fontWeight: 600,
          fontSize: '1rem',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {conversationTitle || 'New Conversation'}
        </span>
        <button type="button" className="chat-header-pin" onClick={handlePin} title={conversationPinned ? t('unpinAction') : t('pinAction')} style={{
          border: conversationPinned ? '1px solid var(--ae-primary-faint)' : 'none',
          background: conversationPinned ? 'var(--ae-primary-faint)' : 'transparent',
          color: conversationPinned ? 'var(--ae-primary)' : 'var(--ae-text-muted)',
          cursor: 'pointer',
          width: '30px',
          height: '30px',
          borderRadius: '8px',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          fontSize: '0.82rem',
          transition: 'color 0.15s, background 0.15s, border 0.15s, transform 0.2s',
        }}
        onMouseEnter={(e) => { if (!conversationPinned) e.currentTarget.style.transform = 'rotate(-15deg)' }}
        onMouseLeave={(e) => { if (!conversationPinned) e.currentTarget.style.transform = 'rotate(0deg)' }}
        >
          <i className={`fas fa-thumbtack${conversationPinned ? ' active' : ''}`} style={{
            transform: conversationPinned ? 'rotate(45deg)' : 'none',
            transition: 'transform 0.2s',
          }} />
        </button>
      </div>

      <div className="chat-header-right" style={{ display: 'flex', alignItems: 'center', gap: '6px', justifySelf: 'end', position: 'relative' }}>
        <button type="button" className="chat-header-dots" onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen) }} title={t('chatHeader.more', '更多')} style={{
          border: 'none',
          background: 'transparent',
          color: 'var(--ae-text-muted)',
          borderRadius: '10px',
          cursor: 'pointer',
          width: '34px',
          height: '34px',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background 0.15s',
        }}>
          <i className="fas fa-ellipsis-v" />
        </button>

        {menuOpen && (
          <div ref={menuRef} className="chat-header-dropdown open" style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            minWidth: '160px',
            padding: '8px',
            background: 'var(--ae-surface)',
            border: '1px solid var(--ae-border)',
            borderRadius: '12px',
            boxShadow: 'var(--ae-shadow)',
            zIndex: 20,
          }}>
            <button type="button" className="chat-header-dropdown-item" onClick={handlePin} style={{
              border: 'none', background: 'transparent', borderRadius: '10px',
              padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '10px',
              cursor: 'pointer', color: 'var(--ae-text)', fontSize: '0.88rem', transition: 'background 0.15s',
            }}>
              <i className="fas fa-thumbtack" style={{ width: '18px', textAlign: 'center', flexShrink: 0 }} />
              <span>{conversationPinned ? t('unpinAction', '取消置頂') : t('pinAction', '置頂')}</span>
            </button>
            <button type="button" className="chat-header-dropdown-item" onClick={handleRename} style={{
              border: 'none', background: 'transparent', borderRadius: '10px',
              padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '10px',
              cursor: 'pointer', color: 'var(--ae-text)', fontSize: '0.88rem',
            }}>
              <i className="fas fa-pen" style={{ width: '18px', textAlign: 'center', flexShrink: 0 }} />
              <span>{t('renameAction', '重新命名')}</span>
            </button>
            <button type="button" className="chat-header-dropdown-item" onClick={() => { setMenuOpen(false); setDeleteTarget(true) }} style={{
              border: 'none', background: 'transparent', borderRadius: '10px',
              padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '10px',
              cursor: 'pointer', color: 'var(--ae-danger)', fontSize: '0.88rem',
            }}>
              <i className="fas fa-trash" style={{ width: '18px', textAlign: 'center', flexShrink: 0 }} />
              <span>{t('deleteAction', '刪除')}</span>
            </button>
          </div>
        )}
      </div>
    </div>

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
      }} onClick={() => setDeleteTarget(false)}>
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
            <button onClick={() => setDeleteTarget(false)} style={{
              padding: '10px 20px', borderRadius: 10, border: '1px solid var(--ae-border)',
              background: 'var(--ae-surface)', color: 'var(--ae-text)', cursor: 'pointer', fontSize: '0.92rem',
            }}>
              {t('cancel', '取消')}
            </button>
            <button onClick={handleDelete} style={{
              padding: '10px 20px', borderRadius: 10, border: 'none',
              background: 'var(--ae-danger)', color: '#fff', cursor: 'pointer', fontSize: '0.92rem',
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