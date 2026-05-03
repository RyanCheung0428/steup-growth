import MarkdownContent from '../../lib/markdown'

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'])
const VIDEO_TYPES = new Set(['video/mp4', 'video/mpeg', 'video/quicktime', 'video/webm', 'video/x-msvideo', 'video/x-flv'])

export default function MessageBubble({ message, isUser, onFileClick, ttsButton }) {
  const files = message.uploaded_files || message.files || []
  const hasFiles = files.length > 0
  const content = message.content || ''

  const getFileIcon = (mimeType) => {
    if (IMAGE_TYPES.has(mimeType)) return 'fa-image'
    if (VIDEO_TYPES.has(mimeType)) return 'fa-video'
    if (mimeType === 'application/pdf') return 'fa-file-pdf'
    return 'fa-file'
  }

  const getFileType = (url, mimeType) => {
    const mime = mimeType || ''
    if (IMAGE_TYPES.has(mime)) return 'image'
    if (VIDEO_TYPES.has(mime)) return 'video'
    if (mime === 'application/pdf') return 'pdf'
    const ext = (url || '').split('.').pop().toLowerCase()
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif'].includes(ext)) return 'image'
    if (['mp4', 'mpeg', 'mov', 'avi', 'flv', 'webm'].includes(ext)) return 'video'
    if (ext === 'pdf') return 'pdf'
    return 'other'
  }

  const serveFileUrl = (url) => {
    if (!url) return ''
    if (url.startsWith('blob:')) return url
    if (url.startsWith('http')) return `/serve_file?url=${encodeURIComponent(url)}`
    return url
  }

  return (
    <div className={isUser ? 'user-message-container' : 'bot-message-container'}>
      <div className="avatar">
        {message.userAvatar ? (
          <img src={message.userAvatar} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
        ) : isUser ? (
          <i className="fas fa-user" />
        ) : message.botAvatar ? (
          <img src={message.botAvatar} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
        ) : (
          <i className="fas fa-robot" />
        )}
      </div>

      <div className="message-content">
        {hasFiles && (
          <div className="message-files">
            {files.map((file, idx) => {
              const fileUrl = typeof file === 'string' ? file : file.url || file.path || ''
              const mimeTypeVal = typeof file === 'string' ? '' : file.mime_type || file.content_type || ''
              const fileName = typeof file === 'string' ? fileUrl.split('/').pop() : file.name || fileUrl.split('/').pop()
              const fileType = getFileType(fileUrl, mimeTypeVal)
              const displayUrl = serveFileUrl(fileUrl)

              if (fileType === 'image') {
                return (
                  <img
                    key={idx}
                    src={displayUrl}
                    alt={fileName}
                    className="message-image"
                    onClick={() => onFileClick?.(displayUrl, 'image', fileName)}
                  />
                )
              }
              if (fileType === 'video') {
                return (
                  <div key={idx} className="video-preview-container" onClick={() => onFileClick?.(displayUrl, 'video', fileName)}>
                    <video src={displayUrl} className="message-video-thumb" />
                    <div className="video-play-overlay"><i className="fas fa-play" /></div>
                  </div>
                )
              }
              return (
                <div
                  key={idx}
                  className="message-file-info"
                  onClick={() => onFileClick?.(displayUrl, fileType, fileName)}
                >
                  <i className={`fas ${getFileIcon(mimeTypeVal)}`} />
                  <span>{fileName}</span>
                </div>
              )
            })}
          </div>
        )}

        {content && (
          <div className="message-text">
            {isUser ? (
              <p style={{ margin: 0, lineHeight: 1.65 }}>{content}</p>
            ) : (
              <MarkdownContent content={content} />
            )}
          </div>
        )}

        {!isUser && content && ttsButton && (
          <div className="message-actions">
            {ttsButton}
          </div>
        )}
      </div>
    </div>
  )
}