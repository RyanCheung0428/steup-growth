import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { useAuth } from './AuthContext'

const SettingsContext = createContext(null)

const DEFAULTS = {
  language: 'en',
  theme: 'light',
  aiModel: 'gemini-3-flash-preview',
  aiProvider: 'ai_studio',
  voice: '',
}

export function SettingsProvider({ children }) {
  const { token } = useAuth()
  const [settings, setSettingsState] = useState(() => {
    try {
      const stored = localStorage.getItem('userSettings')
      const parsed = stored ? JSON.parse(stored) : {}
      const preferredLanguage = localStorage.getItem('preferredLanguage')
      return {
        ...DEFAULTS,
        ...parsed,
        language: parsed.language || preferredLanguage || DEFAULTS.language,
      }
    } catch {
      return { ...DEFAULTS }
    }
  })

  const setSettings = useCallback((updates) => {
    setSettingsState(prev => {
      const next = { ...prev, ...updates }
      localStorage.setItem('userSettings', JSON.stringify(next))
      if (updates.language) {
        localStorage.setItem('preferredLanguage', updates.language)
      }
      return next
    })
  }, [])

  // Set a single setting
  const updateSetting = useCallback((key, value) => {
    setSettings({ [key]: value })
  }, [setSettings])

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement
    if (settings.theme === 'dark') {
      root.classList.add('dark-theme')
    } else if (settings.theme === 'auto') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      root.classList.toggle('dark-theme', prefersDark)
    } else {
      root.classList.remove('dark-theme')
    }
  }, [settings.theme])

  // Fetch profile from backend on auth
  const fetchProfile = useCallback(async (authToken) => {
    try {
      const res = await fetch('/api/user/profile', {
        headers: { 'Authorization': `Bearer ${authToken}` },
      })
      if (res.ok) {
        const data = await res.json()
        setSettings({
          language: data.language || DEFAULTS.language,
          theme: data.theme || DEFAULTS.theme,
          aiModel: data.ai_model || data.model || DEFAULTS.aiModel,
          aiProvider: data.ai_provider || data.provider || DEFAULTS.aiProvider,
          voice: data.voice || DEFAULTS.voice,
        })
      }
    } catch {
      // Silently fail
    }
  }, [setSettings])

  useEffect(() => {
    if (!token) return
    fetchProfile(token)
  }, [token, fetchProfile])

  return (
    <SettingsContext.Provider value={{
      ...settings,
      setSettings,
      updateSetting,
      fetchProfile,
    }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider')
  return ctx
}

export default SettingsContext
