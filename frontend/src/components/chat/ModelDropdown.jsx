import { useState, useEffect, useRef } from 'react'
import { useChat } from '../../contexts/ChatContext'
import { useChatApi } from '../../hooks/useChatApi'
import { useI18n } from '../../contexts/I18nContext'

export default function ModelDropdown() {
  const { settings, t } = useChat()
  const { settings: chatSettings } = useChat()
  const api = useChatApi()
  const [open, setOpen] = useState(false)
  const [currentModel, setCurrentModel] = useState('gemini-3-flash-preview')
  const menuRef = useRef(null)

  useEffect(() => {
    api.getModel().then(data => {
      if (data?.ai_model) setCurrentModel(data.ai_model)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target) && !e.target.closest('.model-toggle-btn')) {
        setOpen(false)
      }
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  const handleSelect = async (model) => {
    try {
      await api.setModel(model, model.includes('flash') ? 'ai_studio' : 'ai_studio')
      setCurrentModel(model)
      if (settings?.updateSetting) {
        settings.updateSetting('aiModel', model)
      }
    } catch {}
    setOpen(false)
  }

  const label = currentModel.includes('flash') ? 'Flash' : 'Pro'

  return (
    <div className="btn-popup-wrapper" style={{ position: 'relative', display: 'flex', alignItems: 'flex-end' }}>
      {open && (
        <div ref={menuRef} className="model-dropdown" style={{
          position: 'absolute',
          bottom: 'calc(100% + 10px)',
          right: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          minWidth: '220px',
          padding: '10px',
          borderRadius: '14px',
          background: 'var(--ae-surface)',
          border: '1px solid var(--ae-border)',
          boxShadow: 'var(--ae-shadow)',
          zIndex: 10,
        }}>
          <button type="button" className="model-dropdown-item" onClick={() => handleSelect('gemini-3-flash-preview')} style={{
            border: 'none',
            background: currentModel.includes('flash') ? 'var(--ae-primary-faint)' : 'var(--ae-surface-soft)',
            borderRadius: '12px',
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            cursor: 'pointer',
            textAlign: 'left',
          }}>
            <div className="mdi-info" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span className="mdi-name" style={{ fontWeight: 600, fontSize: '0.95rem' }}>Flash</span>
              <span className="mdi-desc" style={{ fontSize: '0.78rem', color: 'var(--ae-text-muted)' }}>快速回應・日常對話</span>
            </div>
          </button>
          <button type="button" className="model-dropdown-item" onClick={() => handleSelect('gemini-3.1-pro-preview')} style={{
            border: 'none',
            background: currentModel.includes('pro') ? 'var(--ae-primary-faint)' : 'var(--ae-surface-soft)',
            borderRadius: '12px',
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            cursor: 'pointer',
            textAlign: 'left',
          }}>
            <div className="mdi-info" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span className="mdi-name" style={{ fontWeight: 600, fontSize: '0.95rem' }}>Pro</span>
              <span className="mdi-desc" style={{ fontSize: '0.78rem', color: 'var(--ae-text-muted)' }}>強大精準・深度分析</span>
            </div>
          </button>
        </div>
      )}
      <button
        type="button"
        className="input-model-btn model-toggle-btn"
        onClick={() => setOpen(!open)}
        title={t('switchModel', '切換 AI 模型')}
        style={{
          minWidth: 'auto',
          height: '34px',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '4px',
          padding: '0 8px',
          border: 'none',
          background: 'transparent',
          color: 'var(--ae-text)',
          borderRadius: '8px',
          cursor: 'pointer',
          fontSize: '0.88rem',
        }}
      >
        <span>{label}</span>
        <i className={`fas fa-chevron-${open ? 'down' : 'up'}`} />
      </button>
    </div>
  )
}