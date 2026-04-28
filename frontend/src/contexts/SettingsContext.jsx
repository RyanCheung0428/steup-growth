import { createContext, useContext, useState, useCallback, useEffect } from 'react'

const SettingsContext = createContext(null)

const DEFAULTS = {
  language: 'zh-TW',
  theme: 'light',
  aiModel: 'gemini-3-flash',
  aiProvider: 'ai_studio',
  voice: '',
}

export function SettingsProvider({ children }) {
  const [settings, setSettingsState] = useState(() => {
    try {
      const stored = localStorage.getItem('userSettings')
      return stored ? { ...DEFAULTS, ...JSON.parse(stored) } : { ...DEFAULTS }
    } catch {
      return { ...DEFAULTS }
    }
  })

  const setSettings = useCallback((updates) => {
    setSettingsState(prev => {
      const next = { ...prev, ...updates }
      localStorage.setItem('userSettings', JSON.stringify(next))
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
  const fetchProfile = useCallback(async (token) => {
    try {
      const res = await fetch('/api/user/profile', {
        headers: { 'Authorization': `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setSettings({
          language: data.language || DEFAULTS.language,
          theme: data.theme || DEFAULTS.theme,
          aiModel: data.model || DEFAULTS.aiModel,
          aiProvider: data.provider || DEFAULTS.aiProvider,
          voice: data.voice || DEFAULTS.voice,
        })
      }
    } catch {
      // Silently fail
    }
  }, [setSettings])

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
