import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'

export default function MarkdownContent({ content }) {
  if (!content) return null

  return (
    <div className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
          ),
          code: ({ className, children, ...props }) => {
            const isInline = !className
            if (isInline) {
              return <code className="inline-code" {...props}>{children}</code>
            }
            return <code className={className} {...props}>{children}</code>
          },
          img: ({ src, alt }) => (
            <img src={src} alt={alt || ''} style={{ maxWidth: '100%', borderRadius: '8px' }} />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}