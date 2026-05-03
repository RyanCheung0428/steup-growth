const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'])
const VIDEO_TYPES = new Set(['video/mp4', 'video/mpeg', 'video/quicktime', 'video/webm'])

export default function FilePreviewRail({ files, onRemove, onFileClick }) {
  if (!files || files.length === 0) return null

  const isImage = (file) => IMAGE_TYPES.has(file.mimeType)
  const isVideo = (file) => VIDEO_TYPES.has(file.mimeType)

  const handleChipClick = (file, idx) => {
    if (onFileClick) {
      const type = isImage(file) ? 'image' : isVideo(file) ? 'video' : 'other'
      onFileClick(file.objectUrl, type, file.name, file.mimeType)
    }
  }

  return (
    <div className="file-preview-container" style={{
      display: 'flex',
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'flex-start',
      gap: '8px',
      padding: '12px 12px 4px',
      maxHeight: '160px',
      overflowY: 'auto',
    }}>
      {files.map((file, idx) => {
        if (isImage(file) || isVideo(file)) {
          return (
            <div key={idx} className="file-thumb-chip" onClick={() => handleChipClick(file, idx)} style={{
              display: 'inline-flex',
              position: 'relative',
              width: '90px',
              height: '64px',
              borderRadius: '8px',
              overflow: 'hidden',
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'transform 0.15s, box-shadow 0.15s',
              border: '1px solid transparent',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'; e.currentTarget.style.borderColor = 'var(--ae-primary-soft)' }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = 'transparent' }}
            >
              {isImage(file) ? (
                <img src={file.objectUrl} alt={file.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <video src={file.objectUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              )}
              <button
                className="file-chip-remove"
                onClick={(e) => { e.stopPropagation(); onRemove(idx) }}
                style={{
                  position: 'absolute',
                  top: '4px',
                  right: '4px',
                  width: '22px',
                  height: '22px',
                  padding: 0,
                  borderRadius: '50%',
                  background: 'rgba(0,0,0,0.45)',
                  color: '#fff',
                  fontSize: '0.65rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: 0,
                  transition: 'opacity 0.15s',
                  border: 'none',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '0'}
              >
                <i className="fas fa-times" />
              </button>
            </div>
          )
        }

        return (
          <div key={idx} className="file-chip" onClick={() => handleChipClick(file, idx)} style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '6px',
            height: '64px',
            minWidth: 0,
            padding: '0 12px',
            borderRadius: '8px',
            background: 'var(--ae-surface)',
            cursor: 'pointer',
            border: '1px solid transparent',
            transition: 'border-color 0.15s, box-shadow 0.15s, transform 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--ae-primary-soft)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'translateY(0)' }}
          >
            <i className={`fas ${file.mimeType === 'application/pdf' ? 'fa-file-pdf' : 'fa-file'}`} style={{ color: 'var(--ae-text-muted)', marginRight: '6px' }} />
            <span className="file-chip-name" style={{
              fontSize: '0.82rem',
              color: 'var(--ae-text)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
              minWidth: 0,
            }}>
              {file.name}
            </span>
            <button
              className="file-chip-remove"
              onClick={(e) => { e.stopPropagation(); onRemove(idx) }}
              style={{
                border: 'none',
                background: 'transparent',
                color: 'var(--ae-text-muted)',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                fontSize: '0.7rem',
                borderRadius: '4px',
                flexShrink: 0,
              }}
            >
              <i className="fas fa-times" />
            </button>
          </div>
        )
      })}
    </div>
  )
}