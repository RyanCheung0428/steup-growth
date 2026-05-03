import { useState, useRef, useCallback, useEffect } from 'react'
import { useI18n } from '../../contexts/I18nContext'

export default function WebcamModal({ onClose, onCapture }) {
  const { t } = useI18n()
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const [captured, setCaptured] = useState(false)

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
    } catch (err) {
      alert(t('webcamPermissionDenied', '無法訪問攝像頭，請在瀏覽器設定中允許訪問攝像頭'))
      onClose()
    }
  }, [onClose, t])

  useEffect(() => {
    startCamera()
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
        streamRef.current = null
      }
    }
  }, [startCamera])

  const handleCapture = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0)
    setCaptured(true)
  }

  const handleRetake = () => {
    setCaptured(false)
  }

  const handleUsePhoto = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    canvas.toBlob((blob) => {
      const file = new File([blob], `webcam_${Date.now()}.jpg`, { type: 'image/jpeg' })
      onCapture(file)
      handleClose()
    }, 'image/jpeg', 0.9)
  }

  const handleClose = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    onClose()
  }

  return (
    <div className="webcam-modal" style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(28, 28, 26, 0.35)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      zIndex: 120,
    }}>
      <div className="webcam-content" style={{
        width: 'min(760px, 100%)',
        background: 'var(--ae-surface)',
        border: '1px solid var(--ae-border)',
        borderRadius: '18px',
        boxShadow: 'var(--ae-shadow)',
        overflow: 'hidden',
      }}>
        <div className="webcam-header" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '10px',
          padding: '16px 18px',
        }}>
          <h3 style={{ margin: 0 }}>{t('webcam.title', '拍照')}</h3>
          <button type="button" className="close-webcam" onClick={handleClose} style={{
            width: '42px',
            height: '42px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid var(--ae-border)',
            background: 'var(--ae-surface)',
            color: 'var(--ae-text)',
            borderRadius: '12px',
            cursor: 'pointer',
            fontSize: '1.5rem',
          }}>
            &times;
          </button>
        </div>
        <div className="webcam-body" style={{ padding: '0 18px 18px' }}>
          <video ref={videoRef} autoPlay playsInline style={{
            width: '100%',
            borderRadius: '14px',
            background: '#111',
            display: captured ? 'none' : 'block',
          }} />
          <canvas ref={canvasRef} style={{
            width: '100%',
            borderRadius: '14px',
            display: captured ? 'block' : 'none',
          }} />
        </div>
        <div className="webcam-footer" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '10px',
          padding: '16px 18px',
        }}>
          {!captured ? (
            <button type="button" className="webcam-action-btn" onClick={handleCapture} style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '42px',
              padding: '0 14px',
              border: '1px solid var(--ae-border)',
              background: 'var(--ae-surface)',
              borderRadius: '12px',
              color: 'var(--ae-text)',
              cursor: 'pointer',
            }}>
              <i className="fas fa-camera" style={{ marginRight: '8px' }} />
              {t('webcam.capture', '拍照')}
            </button>
          ) : (
            <>
              <button type="button" className="webcam-action-btn" onClick={handleRetake} style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '42px',
                padding: '0 14px',
                border: '1px solid var(--ae-border)',
                background: 'var(--ae-surface)',
                borderRadius: '12px',
                color: 'var(--ae-text)',
                cursor: 'pointer',
              }}>
                <i className="fas fa-redo" style={{ marginRight: '8px' }} />
                {t('webcam.retake', '重拍')}
              </button>
              <button type="button" className="webcam-action-btn primary" onClick={handleUsePhoto} style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '42px',
                padding: '0 14px',
                border: '1px solid var(--ae-primary)',
                background: 'var(--ae-primary)',
                borderRadius: '12px',
                color: '#fff',
                cursor: 'pointer',
              }}>
                <i className="fas fa-check" style={{ marginRight: '8px' }} />
                {t('webcam.usePhoto', '使用照片')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}