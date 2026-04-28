import { createContext, useContext, useState, useCallback, useEffect } from 'react'

const I18nContext = createContext(null)

// All supported locales
const LOCALES = ['zh-TW', 'en', 'ja', 'zh-CN']

export function I18nProvider({ children }) {
  const [locale, setLocaleState] = useState(() => {
    return localStorage.getItem('preferredLanguage') || 'zh-TW'
  })
  const [translations, setTranslations] = useState({})
  const [loading, setLoading] = useState(true)

  const setLocale = useCallback((lang) => {
    if (LOCALES.includes(lang)) {
      setLocaleState(lang)
      localStorage.setItem('preferredLanguage', lang)
    }
  }, [])

  // Load translations when locale changes
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    import(`../i18n/${locale}.json`)
      .then(mod => {
        if (!cancelled) {
          setTranslations(mod.default)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [locale])

  const t = useCallback((key, fallback = key) => {
    const keys = key.split('.')
    let value = translations
    for (const k of keys) {
      if (value == null) break
      value = value[k]
    }
    return (typeof value === 'string') ? value : fallback
  }, [translations])

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, loading, translations }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}

export default I18nContext
