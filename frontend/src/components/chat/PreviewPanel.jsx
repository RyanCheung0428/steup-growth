import { useI18n } from '../../contexts/I18nContext'

function detectType(filePath, fileName) {
  const name = (fileName || filePath || '').toLowerCase()
  if (/\.(jpg|jpeg|png|gif|webp|heic|heif)(\?|$)/i.test(name)) return 'image'
  if (/\.(mp4|mpeg|mov|avi|flv|webm)(\?|$)/i.test(name)) return 'video'
  if (/\.pdf(\?|$)/i.test(name)) return 'pdf'
  const url = (filePath || '').toLowerCase()
  if (/\.(jpg|jpeg|png|gif|webp|heic|heif)(\?|$)/i.test(url)) return 'image'
  if (/\.(mp4|mpeg|mov|avi|flv|webm)(\?|$)/i.test(url)) return 'video'
  if (/\.pdf(\?|$)/i.test(url)) return 'pdf'
  return 'other'
}

export default function PreviewPanel({ previewContent, onClose }) {
  const { t } = useI18n()

  if (!previewContent?.filePath) return null

  const { filePath, fileName } = previewContent
  const fileType = detectType(filePath, fileName)

  const fileUrl = filePath.startsWith('http')
    ? `/serve_file?url=${encodeURIComponent(filePath)}`
    : filePath

  return (
    <aside style={{
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      minWidth: '360px',
      background: 'var(--ae-surface)',
      borderLeft: '1px solid var(--ae-border)',
      position: 'relative',
    }}>
      <button
        type="button"
        onClick={onClose}
        title={t('close', '關閉')}
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 32,
          height: 32,
          border: 'none',
          borderRadius: 8,
          background: 'var(--ae-surface)',
          color: 'var(--ae-text-muted)',
          cursor: 'pointer',
          fontSize: '0.85rem',
          zIndex: 5,
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
          transition: 'color 0.15s, background 0.15s, transform 0.15s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--ae-text)'; e.currentTarget.style.background = 'var(--ae-surface-muted)'; e.currentTarget.style.transform = 'scale(1.05)' }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--ae-text-muted)'; e.currentTarget.style.background = 'var(--ae-surface)'; e.currentTarget.style.transform = 'scale(1)' }}
      >
        <i className="fas fa-times" />
      </button>
      <div className="preview-content" style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        padding: '16px',
        overflow: 'auto',
        background: 'var(--ae-surface-soft)',
      }}>
        {fileType === 'image' && (
          <img src={fileUrl} alt={fileName} style={{ width: '100%', borderRadius: '14px', background: '#111' }} />
        )}
        {fileType === 'video' && (
          <video src={fileUrl} controls style={{ width: '100%', borderRadius: '14px', background: '#111' }} />
        )}
        {fileType === 'pdf' && (
          <iframe src={fileUrl} title={fileName} style={{ flex: 1, width: '100%', border: 'none', borderRadius: '14px', background: '#fff' }} />
        )}
        {fileType === 'other' && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--ae-text-muted)' }}>
            <i className="fas fa-file" style={{ fontSize: '3rem', marginBottom: '16px', display: 'block' }} />
            <p>{fileName || 'File'}</p>
            <a href={fileUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--ae-primary)' }}>
              Open file
            </a>
          </div>
        )}
      </div>
    </aside>
  )
}