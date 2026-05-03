import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useI18n } from '../contexts/I18nContext'
import { initializeApp } from 'firebase/app'
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendEmailVerification,
  updateProfile,
  signOut,
} from 'firebase/auth'

/* ── Google SVG inline (matches original template) ── */
function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}

/* ── Shared container + form styles ── */
const inputClass =
  'w-full bg-[#f9fafb] dark:bg-ae-darkSurface border border-[#cdc6bb] dark:border-ae-darkBorder rounded-lg px-4 py-3 text-sm outline-none text-[#1c1c1a] dark:text-ae-darkText transition-all duration-200 focus:border-[#655e4e] focus:shadow-[0_0_0_3px_rgba(168,159,141,0.14)] mb-4'

const submitBtnClass =
  'w-full bg-[#655e4e] hover:bg-[#575041] text-white font-semibold py-3 rounded-lg cursor-pointer transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed'

/* ── Main component ── */
export default function LoginSignup() {
  const [tab, setTab] = useState('signin')
  const navigate = useNavigate()
  const { login } = useAuth()
  const { t } = useI18n()

  // Sign-in fields
  const [siEmail, setSiEmail] = useState('')
  const [siPass, setSiPass] = useState('')
  const [siShowPass, setSiShowPass] = useState(false)
  const [remember, setRemember] = useState(false)
  const [siError, setSiError] = useState('')
  const [siLoading, setSiLoading] = useState(false)
  const [showSiVerifyCard, setShowSiVerifyCard] = useState(false)

  // Sign-up fields
  const [suUser, setSuUser] = useState('')
  const [suEmail, setSuEmail] = useState('')
  const [suPass, setSuPass] = useState('')
  const [suConfirm, setSuConfirm] = useState('')
  const [suShowPass, setSuShowPass] = useState(false)
  const [suShowConfirm, setSuShowConfirm] = useState(false)
  const [suError, setSuError] = useState('')
  const [suLoading, setSuLoading] = useState(false)
  const [showSuVerifyCard, setShowSuVerifyCard] = useState(false)

  // Firebase auth instance
  const [auth, setAuth] = useState(null)
  const [fbReady, setFbReady] = useState(false)

  // Init Firebase
  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/auth/firebase-config')
        if (!res.ok) return
        const config = await res.json()
        if (!config.apiKey || !config.authDomain || !config.projectId) return
        const app = initializeApp(config)
        setAuth(getAuth(app))
        setFbReady(true)
      } catch { /* Firebase unavailable */ }
    })()
  }, [])

  /* ── Helpers ── */
  const exchangeFirebaseToken = useCallback(async (idToken, rememberMe = false) => {
    const res = await fetch('/auth/firebase-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_token: idToken, remember: rememberMe }),
    })
    const data = await res.json()
    if (res.ok) {
      login(data.access_token)
      localStorage.setItem('refresh_token', data.refresh_token)
      navigate('/')
      return null
    }
    const err = new Error(data.error || 'Firebase login failed')
    err.code = data.code || ''
    err.email = data.email || ''
    throw err
  }, [navigate, login])

  const showSiCard = useCallback(() => setShowSiVerifyCard(true), [])
  const hideSiCard = useCallback(() => {
    setShowSiVerifyCard(false)
    setSiError('')
  }, [])

  /* ── Google Sign-In ── */
  const handleGoogle = useCallback(async (setError) => {
    if (!fbReady || !auth) {
      setError(t('auth.error.googleUnavailable', 'Google 登入不可用，請使用電子郵件/密碼。'))
      return
    }
    try {
      setError('')
      const provider = new GoogleAuthProvider()
      const result = await signInWithPopup(auth, provider)
      const idToken = await result.user.getIdToken()
      await exchangeFirebaseToken(idToken, remember)
    } catch (e) {
      if (e.code === 'auth/popup-closed-by-user') return
      setError(e.message || t('auth.error.googleFailed', 'Google 登入失敗，請稍後再試。'))
    }
  }, [fbReady, auth, exchangeFirebaseToken, remember])

  /* ── Email Sign-In ── */
  const handleSignIn = useCallback(async (e) => {
    e.preventDefault()
    setSiError('')
    setSiLoading(true)
    hideSiCard()

    if (!fbReady || !auth) {
      setSiError(t('auth.firebaseUnavailable', 'Firebase 不可用，請稍後再試。'))
      setSiLoading(false)
      return
    }

    try {
      const cred = await signInWithEmailAndPassword(auth, siEmail, siPass)
      const idToken = await cred.user.getIdToken()
      try {
        await exchangeFirebaseToken(idToken, remember)
      } catch (exErr) {
        await signOut(auth)
        if (exErr.code === 'email_not_verified') {
          showSiCard()
          return
        }
        throw exErr
      }
    } catch (fbErr) {
      const map = {
        'auth/user-not-found': t('auth.error.noAccount', '找不到此電子郵件的帳號。'),
        'auth/wrong-password': t('auth.error.wrongPassword', '密碼不正確。'),
        'auth/invalid-credential': t('auth.error.invalidCredential', '電子郵件或密碼無效。'),
        'auth/too-many-requests': t('auth.error.tooManyRequests', '嘗試次數過多，請稍後再試。'),
        'auth/user-disabled': t('auth.error.disabled', '此帳號已被停用。'),
      }
      setSiError(map[fbErr.code] || fbErr.message || t('auth.error.loginFailed', '登入失敗'))
    } finally {
      setSiLoading(false)
    }
  }, [fbReady, auth, siEmail, siPass, remember, exchangeFirebaseToken, hideSiCard, showSiCard])

  /* ── Email Sign-Up ── */
  const handleSignUp = useCallback(async (e) => {
    e.preventDefault()
    setSuError('')

    if (suPass !== suConfirm) {
      setSuError(t('auth.error.passwordMismatch', '密碼不一致'))
      return
    }

    if (!fbReady || !auth) {
      setSuError(t('auth.firebaseUnavailable', 'Firebase 不可用，請稍後再試。'))
      return
    }

    setSuLoading(true)
    try {
      const cred = await createUserWithEmailAndPassword(auth, suEmail, suPass)
      if (suUser) {
        await updateProfile(cred.user, { displayName: suUser })
      }
      try { await sendEmailVerification(cred.user) } catch {}
      // Sync to local DB
      try {
        const idToken = await cred.user.getIdToken()
        await fetch('/auth/firebase-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id_token: idToken }),
        })
      } catch {}
      await signOut(auth)
      setShowSuVerifyCard(true)
    } catch (fbErr) {
      const map = {
        'auth/email-already-in-use': t('auth.error.emailInUse', '此電子郵件已被註冊，請改為登入。'),
        'auth/weak-password': t('auth.error.weakPassword', '密碼強度不足，請使用至少6個字元。'),
        'auth/invalid-email': t('auth.error.invalidEmail', '電子郵件格式無效。'),
      }
      setSuError(map[fbErr.code] || fbErr.message || t('auth.error.registrationFailed', '註冊失敗'))
    } finally {
      setSuLoading(false)
    }
  }, [fbReady, auth, suEmail, suPass, suUser, suConfirm])

  /* ── Switch to sign-in tab ── */
  const switchToSignIn = useCallback(() => {
    setTab('signin')
    setShowSuVerifyCard(false)
    setSuError('')
    setSuUser('')
    setSuEmail('')
    setSuPass('')
    setSuConfirm('')
  }, [])

  /* ── Render ── */
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fcf9f5] dark:bg-ae-darkSurface font-sans p-4">
      <div className="bg-white dark:bg-ae-darkCard rounded-xl shadow-lg border border-[#cdc6bb] dark:border-ae-darkBorder w-full max-w-[420px] overflow-hidden p-10 transition-all duration-300">
        {/* Tabs */}
        <div className="flex justify-between mb-8 border-b-2 border-[#e5e7eb] dark:border-ae-darkBorder">
          <button
            className={`bg-transparent border-none text-base font-semibold py-3 w-1/2 cursor-pointer transition-colors duration-300 relative ${
              tab === 'signin' ? 'text-[#1c1c1a] dark:text-ae-darkText' : 'text-[#b8b0a4]'
            }`}
            onClick={() => { setTab('signin'); hideSiCard(); setShowSuVerifyCard(false) }}
          >
            {t('auth.signIn', '登入')}
            {tab === 'signin' && (
              <span className="absolute bottom-[-2px] left-0 w-full h-[2px] bg-[#655e4e]" />
            )}
          </button>
          <button
            className={`bg-transparent border-none text-base font-semibold py-3 w-1/2 cursor-pointer transition-colors duration-300 relative ${
              tab === 'signup' ? 'text-[#1c1c1a] dark:text-ae-darkText' : 'text-[#b8b0a4]'
            }`}
            onClick={() => { setTab('signup'); setSiError(''); setShowSiVerifyCard(false) }}
          >
            {t('auth.signUp', '註冊')}
            {tab === 'signup' && (
              <span className="absolute bottom-[-2px] left-0 w-full h-[2px] bg-[#655e4e]" />
            )}
          </button>
        </div>

        {/* ── SIGN IN ── */}
        {tab === 'signin' && !showSiVerifyCard && (
          <form onSubmit={handleSignIn} autoComplete="on" className="flex flex-col animate-fade-in">
            <h1 className="text-[1.75rem] text-[#1c1c1a] dark:text-ae-darkText text-center mb-2">{t('auth.welcomeBack', '歡迎回來')}</h1>
            <p className="text-sm text-[#5b564d] dark:text-ae-darkTextMuted text-center mb-6">{t('auth.signInSubtitle', '請輸入您的資料以登入。')}</p>

            <GoogleButton onClick={() => handleGoogle(setSiError)} text={t('auth.googleSignIn', '使用 Google 登入')} errorSetter={setSiError} />

            <Divider />

            <input type="email" placeholder={t('auth.email', '電子郵件')} autoComplete="username" required value={siEmail} onChange={e => setSiEmail(e.target.value)} className={inputClass} />
            <PasswordField show={siShowPass} toggle={() => setSiShowPass(p => !p)} placeholder={t('auth.password', '密碼')} autoComplete="current-password" value={siPass} onChange={e => setSiPass(e.target.value)} />

            <div className="flex justify-between items-center text-sm mb-6 -mt-2">
              <label className="flex items-center gap-2 text-[#4b5563] dark:text-ae-darkTextMuted cursor-pointer">
                <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} />
                {t('auth.rememberMe', '記住我')}
              </label>
              <Link to="/forgot-password" className="text-[#655e4e] hover:underline font-medium no-underline">{t('auth.forgotPassword', '忘記密碼？')}</Link>
            </div>

            {siError && <div className="text-[#ef4444] text-sm text-center min-h-[20px] mb-3">{siError}</div>}
            {!siError && <div className="min-h-[20px] mb-3" />}

            <button type="submit" disabled={siLoading} className={submitBtnClass}>
              {siLoading && <i className="fas fa-spinner fa-spin mr-2"></i>}
              {t('auth.signIn', '登入')}
            </button>
          </form>
        )}

        {/* Sign-in verification card (unverified email tried to sign in) */}
        {tab === 'signin' && showSiVerifyCard && (
          <VerifyCard
            type="warning"
            title={t('auth.verifyTitleUnverified', '電子郵件尚未驗證')}
            text={t('auth.verifyTextUnverified', '請先驗證您的電子郵件地址再登入。')}
            email={siEmail}
            onResend={async (setResendState) => {
              setResendState('loading')
              try {
                const cred = await signInWithEmailAndPassword(auth, siEmail, siPass)
                await sendEmailVerification(cred.user)
                await signOut(auth)
                setResendState('sent')
                setTimeout(() => setResendState('idle'), 30000)
              } catch (err) {
                await signOut(auth).catch(() => {})
                setResendState(err.code === 'auth/too-many-requests' ? 'throttled' : 'error')
              }
            }}
            onBack={hideSiCard}
            backLabel={t('auth.backToSignIn', '返回登入')}
          />
        )}

        {/* ── SIGN UP ── */}
        {tab === 'signup' && !showSuVerifyCard && (
          <form onSubmit={handleSignUp} autoComplete="off" noValidate className="flex flex-col animate-fade-in">
            {/* Hidden dummy fields to prevent browser save-password prompts — matches original */}
            <input type="text" name="fake-username" autoComplete="username" aria-hidden="true" style={{ position: 'absolute', left: -9999, top: -9999 }} tabIndex={-1} readOnly />
            <input type="password" name="fake-password" autoComplete="new-password" aria-hidden="true" style={{ position: 'absolute', left: -9999, top: -9999 }} tabIndex={-1} readOnly />

            <h1 className="text-[1.75rem] text-[#1c1c1a] dark:text-ae-darkText text-center mb-2">{t('auth.createAccount', '建立帳號')}</h1>
            <p className="text-sm text-[#5b564d] dark:text-ae-darkTextMuted text-center mb-6">{t('auth.signUpSubtitle', '加入我們以使用所有網站功能。')}</p>

            <GoogleButton onClick={() => handleGoogle(setSuError)} text={t('auth.googleSignUp', '使用 Google 註冊')} />

            <Divider />

            <input type="text" placeholder={t('auth.username', '用戶名稱')} autoComplete="username" required value={suUser} onChange={e => setSuUser(e.target.value)} className={inputClass} />
            <input type="email" placeholder={t('auth.email', '電子郵件')} autoComplete="email" required value={suEmail} onChange={e => setSuEmail(e.target.value)} className={inputClass} />

            <PasswordField show={suShowPass} toggle={() => setSuShowPass(p => !p)} placeholder={t('auth.password', '密碼')} autoComplete="new-password" value={suPass} onChange={e => setSuPass(e.target.value)} />
            <PasswordField show={suShowConfirm} toggle={() => setSuShowConfirm(p => !p)} placeholder={t('auth.confirmPassword', '確認密碼')} autoComplete="new-password" value={suConfirm} onChange={e => setSuConfirm(e.target.value)} />

            {suError && <div className="text-[#ef4444] text-sm text-center min-h-[20px] mb-3">{suError}</div>}
            {!suError && <div className="min-h-[20px] mb-3" />}

            <button type="submit" disabled={suLoading} className={`${submitBtnClass} mt-4`}>
              {suLoading && <i className="fas fa-spinner fa-spin mr-2"></i>}
              {t('auth.signUp', '註冊')}
            </button>
          </form>
        )}

        {/* Sign-up verification card (after successful registration) */}
        {tab === 'signup' && showSuVerifyCard && (
          <VerifyCard
            type="success"
            title={t('auth.verifyTitleSuccess', '註冊成功！')}
            text={t('auth.verifyTextSuccess', '驗證電子郵件已發送至')}
            email={suEmail}
            extraText={t('auth.verifyExtraText', '請在登入前驗證您的電子郵件。')}
            onResend={async (setResendState) => {
              setResendState('loading')
              try {
                const cred = await signInWithEmailAndPassword(auth, suEmail, suPass)
                await sendEmailVerification(cred.user)
                await signOut(auth)
                setResendState('sent')
                setTimeout(() => setResendState('idle'), 30000)
              } catch (err) {
                await signOut(auth).catch(() => {})
                setResendState(err.code === 'auth/too-many-requests' ? 'throttled' : 'error')
              }
            }}
            onBack={switchToSignIn}
            backLabel={t('auth.goToSignIn', '前往登入')}
          />
        )}
      </div>
    </div>
  )
}

/* ── Sub-components ── */

function GoogleButton({ onClick, text }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-center gap-2.5 bg-white dark:bg-ae-darkCard border border-[#cdc6bb] dark:border-ae-darkBorder text-[#374151] dark:text-ae-darkText text-sm font-medium py-2.5 px-4 rounded-lg cursor-pointer transition-colors duration-300 hover:bg-[#f9fafb] dark:hover:bg-ae-darkSurface w-full mb-4"
    >
      <GoogleIcon />
      <span>{text}</span>
    </button>
  )
}

function Divider() {
  return (
    <div className="flex items-center text-center my-2 mb-6 text-[#b8b0a4] text-sm">
      <span className="flex-1 border-b border-[#e5e7eb] dark:border-ae-darkBorder" />
      <span className="px-2.5">{t('auth.or', '或')}</span>
      <span className="flex-1 border-b border-[#e5e7eb] dark:border-ae-darkBorder" />
    </div>
  )
}

function PasswordField({ show, toggle, placeholder, autoComplete, value, onChange }) {
  return (
    <div className="relative mb-4">
      <input
        type={show ? 'text' : 'password'}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required
        value={value}
        onChange={onChange}
        className={inputClass + ' pr-10 mb-0'}
      />
      <button
        type="button"
        className="absolute right-4 top-3.5 bg-transparent border-none text-[#b8b0a4] hover:text-[#4b5563] cursor-pointer text-sm"
        onClick={toggle}
        aria-label={t('auth.togglePassword', '切換密碼顯示')}
      >
        <i className={`fas ${show ? 'fa-eye-slash' : 'fa-eye'}`} />
      </button>
    </div>
  )
}

function VerifyCard({ type, title, text, email, extraText, onResend, onBack, backLabel }) {
  const { t } = useI18n()
  const [resendState, setResendState] = useState('idle') // idle | loading | sent | throttled | error
  const isWarning = type === 'warning'

  const resendLabels = {
    idle: <><i className="fas fa-paper-plane" /> {t('auth.resendEmail', '重新發送郵件')}</>,
    loading: <><i className="fas fa-spinner fa-spin" /> {t('auth.sending', '發送中...')}</>,
    sent: <><i className="fas fa-check" /> {t('auth.sentCheckInbox', '已發送！請檢查您的收件匣。')}</>,
    throttled: <><i className="fas fa-clock" /> {t('auth.tooManyAttempts', '嘗試次數過多')}</>,
    error: <><i className="fas fa-redo" /> {t('auth.retry', '重試')}</>,
  }

  return (
    <div className={`w-full rounded-xl p-6 mt-4 text-center animate-fade-in ${
      isWarning
        ? 'bg-[#fffbeb] border border-[#fbd38d]'
        : 'bg-[#f8f6ff] border border-[#e0d6f2]'
    }`}>
      <div className={`text-[38px] mb-3 ${isWarning ? 'text-[#f59e0b]' : 'text-[#655e4e]'}`}>
        <i className={isWarning ? 'fas fa-exclamation-triangle' : 'fas fa-envelope-open-text'} />
      </div>
      <div className="text-lg font-semibold text-[#1c1c1a] dark:text-ae-darkText mb-2">{title}</div>
      <div className="text-[0.95rem] text-[#4b5563] dark:text-ae-darkTextMuted leading-relaxed mb-1.5">{text}</div>
      {email && <div className="text-[0.95rem] font-semibold text-[#655e4e] mb-1.5">{email}</div>}
      {extraText && <div className="text-[0.95rem] text-[#4b5563] dark:text-ae-darkTextMuted leading-relaxed mb-1.5">{extraText}</div>}
      <div className="flex items-center justify-center gap-1.5 text-sm text-[#b8b0a4] mt-3">
        <i className="fas fa-info-circle text-[#cdc6bb] text-[14px]" /> {t('auth.checkSpam', '找不到郵件？請檢查垃圾郵件匣。')}
      </div>

      <div className="flex flex-col items-center gap-3 mt-5">
        <button
          type="button"
          className={`w-full max-w-[250px] bg-[#655e4e] hover:bg-[#575041] text-white font-semibold py-2.5 px-5 rounded-lg cursor-pointer transition-all duration-200 disabled:opacity-60 inline-flex items-center justify-center gap-2 ${
            resendState === 'loading' || resendState === 'sent' ? 'opacity-60' : ''
          }`}
          onClick={() => onResend(setResendState)}
          disabled={resendState === 'loading' || resendState === 'sent' || resendState === 'throttled'}
        >
          {resendLabels[resendState]}
        </button>

        <button
          type="button"
          onClick={onBack}
          className="text-[0.95rem] text-[#655e4e] hover:underline font-medium cursor-pointer bg-transparent border-none inline-flex items-center gap-1.5 mt-2"
        >
          <i className="fas fa-arrow-left" /> {backLabel}
        </button>
      </div>
    </div>
  )
}
