export default function TypingIndicator() {
  return (
    <div className="bot-message-container">
      <div className="avatar">
        <i className="fas fa-robot" />
      </div>
      <div className="message-content typing-indicator-content">
        <div className="typing-dots">
          <span />
          <span />
          <span />
        </div>
      </div>
      <style>{`
        .typing-indicator-content {
          padding: 14px 20px;
        }
        .typing-dots {
          display: inline-flex;
          gap: 5px;
          align-items: center;
        }
        .typing-dots span {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--ae-text-muted);
          opacity: 0.4;
          animation: typingBounce 1.4s ease-in-out infinite;
        }
        .typing-dots span:nth-child(2) { animation-delay: 0.2s; }
        .typing-dots span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes typingBounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-6px); opacity: 1; }
        }
      `}</style>
    </div>
  )
}