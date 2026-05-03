import { useEffect, useCallback } from 'react'

export default function MediaViewer({ url, type, fileName, onClose }) {
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  if (!url) return null

  return (
    <div
      className="media-viewer-overlay active"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        animation: 'fadeIn 0.3s ease',
      }}
    >
      <button
        className="media-viewer-close"
        onClick={(e) => { e.stopPropagation(); onClose() }}
        style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          width: '42px',
          height: '42px',
          border: 'none',
          borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.15)',
          color: '#fff',
          fontSize: '1.1rem',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1,
        }}
      >
        <i className="fas fa-times" />
      </button>

      {type === 'image' && (
        <img
          src={url}
          alt={fileName || ''}
          onClick={(e) => e.stopPropagation()}
          style={{
            maxWidth: '90vw',
            maxHeight: '90vh',
            borderRadius: '12px',
            boxShadow: '0 8px 40px rgba(0, 0, 0, 0.5)',
            cursor: 'default',
          }}
        />
      )}
      {type === 'video' && (
        <video
          src={url}
          controls
          autoPlay
          onClick={(e) => e.stopPropagation()}
          style={{
            maxWidth: '90vw',
            maxHeight: '90vh',
            borderRadius: '12px',
            boxShadow: '0 8px 40px rgba(0, 0, 0, 0.5)',
            cursor: 'default',
          }}
        />
      )}
    </div>
  )
}