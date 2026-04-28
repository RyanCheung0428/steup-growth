import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'

export default function ForgotPassword() {
  const [step, setStep] = useState('verify')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [successHtml, setSuccessHtml] = useState('')
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [showResend, setShowResend] = useState(false)
  const [isWarning, setIsWarning] = useState(false)
  const emailRef = useRef(null)
  const lastEmailRef = useRef('')

  useEffect(() => {
    setTimeout(() => emailRef.current?.focus(), 300)
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    const trimmed = email.trim()

    setError('')
    setSuccessMsg('')
    setSuccessHtml('')

    if (!trimmed) {
      setError('Please enter your email address.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Please enter a valid email address.')
      return
    }

    lastEmailRef.current = trimmed
    setLoading(true)

    try {
      const res = await fetch('/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to process request.')
        return
      }

      // Unverified account — verification needed first
      if (data.code === 'verification_needed') {
        setIsWarning(true)
        setShowResend(false)
        setSuccessHtml(
          '<strong>Email Not Verified</strong><br>' +
          data.message +
          '<br><small style="color: #888; margin-top: 6px; display: inline-block;"><i class="fas fa-info-circle"></i> Please sign in first to resend the verification email.</small>'
        )
        setStep('success')
        return
      }

      // Reset email sent
      if (data.code === 'reset_sent') {
        setIsWarning(false)
        setShowResend(true)
        setSuccessHtml(
          (data.message || 'A password reset email has been sent. Please check your inbox.') +
          '<br><small style="color: #888; margin-top: 6px; display: inline-block;"><i class="fas fa-info-circle"></i> Can\'t find it? Check your spam or junk folder.</small>'
        )
        setStep('success')
        return
      }

      // Generic success (anti-enumeration for unknown emails)
      setIsWarning(false)
      setShowResend(true)
      setSuccessHtml(
        (data.message || 'If an account exists with that email, we have sent you an email. Please check your inbox.') +
        '<br><small style="color: #888; margin-top: 6px; display: inline-block;"><i class="fas fa-info-circle"></i> Can\'t find it? Check your spam or junk folder.</small>'
      )
      setStep('success')
    } catch {
      setError('Network error. Please check your connection.')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (!lastEmailRef.current) return
    setResending(true)
    try {
      const res = await fetch('/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: lastEmailRef.current }),
      })
      const data = await res.json()
      if (res.ok && data.code === 'reset_sent') {
        setSuccessMsg('Email sent! Check your inbox.')
      } else {
        setSuccessMsg(data.error || data.message || 'Failed to resend.')
      }
    } catch {
      setSuccessMsg('Network error — try again')
    }
    setTimeout(() => {
      setResending(false)
      setSuccessMsg('')
    }, 30000)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fcf9f5] dark:bg-ae-darkSurface font-sans">
      <div className="bg-white dark:bg-ae-darkCard rounded-xl shadow-lg border border-[#cdc6bb] dark:border-ae-darkBorder w-full max-w-[420px] overflow-hidden p-10 transition-all duration-300">
        <h1 className="text-2xl font-semibold text-[#1c1c1a] dark:text-ae-darkText text-center mb-2">
          Reset Password
        </h1>
        <p className="text-sm text-[#5b564d] dark:text-ae-darkTextMuted text-center mb-6">
          Enter your email and we&apos;ll send you a link to reset your password.
        </p>

        {step === 'verify' && (
          <div className="flex flex-col items-center w-full animate-fade-in">
            <input
              ref={emailRef}
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#f9fafb] dark:bg-ae-darkSurface border border-[#cdc6bb] dark:border-ae-darkBorder rounded-lg px-4 py-3 text-sm outline-none transition-all duration-200 focus:border-[#655e4e] focus:shadow-[0_0_0_3px_rgba(168,159,141,0.14)] mb-3 text-[#1c1c1a] dark:text-ae-darkText"
              required
            />

            {error && (
              <div className="text-[#ef4444] text-sm text-center min-h-[20px] mb-3">{error}</div>
            )}
            {!error && <div className="min-h-[20px] mb-3" />}

            <button
              type="submit"
              onClick={handleSubmit}
              disabled={loading}
              className="w-full bg-[#655e4e] hover:bg-[#575041] text-white font-semibold py-3 rounded-lg cursor-pointer transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading && <i className="fas fa-spinner fa-spin"></i>}
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </div>
        )}

        {step === 'success' && (
          <div className="flex flex-col items-center w-full animate-fade-in">
            <div
              className="text-[52px] mb-4 animate-[successBounce_0.6s_ease]"
              style={{
                animation: 'successBounce 0.6s ease',
              }}
            >
              <i
                className={isWarning ? 'fas fa-exclamation-triangle' : 'fas fa-check-circle'}
                style={{ color: isWarning ? '#e67e22' : '#10b981' }}
              />
            </div>

            <div
              className={`w-full px-4 py-3 rounded-lg text-sm text-center mb-4 ${
                isWarning
                  ? 'bg-[#fef3c7] border border-[#f59e0b] text-[#e67e22]'
                  : 'bg-[#d1fae5] border border-[#10b981] text-[#059669]'
              }`}
              style={{ animation: 'successPulse 0.5s ease-out' }}
              dangerouslySetInnerHTML={{ __html: successHtml }}
            />

            {successMsg && (
              <div className="text-sm text-[#059669] mb-3">{successMsg}</div>
            )}

            {showResend && (
              <button
                onClick={handleResend}
                disabled={resending}
                className="w-full bg-[#6b7280] hover:bg-[#4b5563] text-white font-semibold py-3 rounded-lg cursor-pointer transition-colors duration-200 disabled:opacity-60 mt-4 flex items-center justify-center gap-2"
              >
                <i className="fas fa-redo"></i>
                {resending ? 'Sending...' : 'Resend Email'}
              </button>
            )}
          </div>
        )}

        <Link
          to="/login"
          className="flex items-center justify-center gap-2 text-[#4f46e5] hover:text-[#4338ca] hover:underline font-medium mt-6 text-sm no-underline"
        >
          <i className="fas fa-arrow-left"></i>
          Back to Login
        </Link>
      </div>

      <style>{`
        @keyframes successBounce {
          0% { transform: scale(0); opacity: 0; }
          50% { transform: scale(1.2); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes successPulse {
          0% { transform: scale(1); opacity: 0; }
          50% { transform: scale(1.02); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
