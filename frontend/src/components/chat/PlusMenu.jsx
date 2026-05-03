import { useState, useEffect, useRef } from 'react'
import { useI18n } from '../../contexts/I18nContext'

export default function PlusMenu({ onFileUpload, onVoiceInput, onWebcam, isRecording }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target) && !e.target.closest('.plus-btn')) {
        setOpen(false)
      }
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  return (
    <div className="btn-popup-wrapper" style={{ position: 'relative', display: 'flex', alignItems: 'flex-end' }}>
      {open && (
        <div ref={menuRef} className="plus-menu" style={{
          position: 'absolute',
          bottom: 'calc(100% + 10px)',
          left: 0,
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
          <button type="button" className={`plus-menu-item ${isRecording ? '' : ''}`} onClick={() => { onFileUpload(); setOpen(false) }} style={{
            border: 'none',
            background: isRecording ? '#fef2f2' : 'var(--ae-surface-soft)',
            borderRadius: '12px',
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            cursor: 'pointer',
            textAlign: 'left',
            color: isRecording ? '#dc2626' : 'var(--ae-text)',
          }}>
            <span className="pmi-icon"><i className="fas fa-paperclip" /></span>
            <span>{t('uploadFile', '上載文件')}</span>
          </button>
          <button type="button" className={`plus-menu-item ${isRecording ? 'recording' : ''}`} onClick={() => { onVoiceInput(); setOpen(false) }} style={{
            border: 'none',
            background: isRecording ? '#fef2f2' : 'var(--ae-surface-soft)',
            borderRadius: '12px',
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            cursor: 'pointer',
            textAlign: 'left',
            color: isRecording ? '#dc2626' : 'var(--ae-text)',
            animation: isRecording ? 'voicePulse 1.5s ease-in-out infinite' : 'none',
          }}>
            <span className="pmi-icon"><i className="fas fa-microphone" /></span>
            <span>{isRecording ? t('voiceRecording', '正在錄音...') : t('voiceInput', '語音輸入')}</span>
          </button>
          <button type="button" className="plus-menu-item" onClick={() => { onWebcam(); setOpen(false) }} style={{
            border: 'none',
            background: 'var(--ae-surface-soft)',
            borderRadius: '12px',
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            cursor: 'pointer',
            textAlign: 'left',
            color: 'var(--ae-text)',
          }}>
            <span className="pmi-icon"><i className="fas fa-camera" /></span>
            <span>{t('webcam', '攝影機')}</span>
          </button>
        </div>
      )}
      <button type="button" className="input-action-btn plus-btn" onClick={() => setOpen(!open)} title={t('toolbar.more', '更多選項')} style={{
        border: 'none',
        background: 'transparent',
        color: 'var(--ae-text-muted)',
        borderRadius: '8px',
        width: '34px',
        height: '34px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
      }}>
        <i className={`fas ${open ? 'fa-times' : 'fa-plus'}`} />
      </button>
    </div>
  )
}