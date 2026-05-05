import { useState, useCallback, useRef, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useSettings } from '../contexts/SettingsContext'
import { useI18n } from '../contexts/I18nContext'
import { API_BASE } from '../lib/apiBase'

export function useTTS() {
  const { token, refreshToken } = useAuth()
  const { voice } = useSettings()
  const { locale } = useI18n()
  const [currentButton, setCurrentButton] = useState(null)
  const audioRef = useRef(null)
  const ttsCacheRef = useRef(new Map())
  const DEFAULT_VOICE_BY_LOCALE = {
    'zh-TW': 'zh-TW-HsiaoChenNeural',
    'zh-CN': 'zh-CN-XiaoxiaoNeural',
    'en': 'en-US-JennyNeural',
    'ja': 'ja-JP-NanamiNeural',
  }

  const cleanTextForSpeech = useCallback((text) => {
    return text
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`[^`]+`/g, '')
      .replace(/!\[.*?\]\(.*?\)/g, '')
      .replace(/\[([^\]]+)\]\(.*?\)/g, '$1')
      .replace(/#{1,6}\s/g, '')
      .replace(/(\*{1,2}|_{1,2})(.*?)\1/g, '$2')
      .replace(/https?:\/\/\S+/g, '')
      .replace(/[\n\r]+/g, '. ')
      .replace(/\s+/g, ' ')
      .trim()
  }, [])

  const speakMessage = useCallback(async (text, buttonElement) => {
    if (currentButton === buttonElement) {
      stop()
      return
    }

    stop()
    setCurrentButton(buttonElement)

    const cleaned = cleanTextForSpeech(text)
    if (!cleaned) {
      setCurrentButton(null)
      return
    }

    const langMap = { 'zh-TW': 'zh-TW', 'zh-CN': 'zh-CN', 'en': 'en', 'ja': 'ja' }
    const lang = langMap[locale] || 'zh-TW'
    const selectedVoice = voice || DEFAULT_VOICE_BY_LOCALE[locale] || 'en-US-JennyNeural'
    const cacheKey = `${lang}:${selectedVoice}:${cleaned}`

    if (ttsCacheRef.current.has(cacheKey)) {
      const blob = ttsCacheRef.current.get(cacheKey)
      playBlob(blob, buttonElement)
      return
    }

    try {
      const res = await fetchTTS(cleaned, lang, selectedVoice)
      if (!res) {
        speakWithBrowserTTS(cleaned, lang, buttonElement)
        return
      }
      const blob = await res.blob()
      ttsCacheRef.current.set(cacheKey, blob)
      playBlob(blob, buttonElement)
    } catch {
      speakWithBrowserTTS(cleaned, lang, buttonElement)
    }
  }, [currentButton, cleanTextForSpeech, locale, voice])

  const fetchTTS = async (text, lang, voiceId) => {
    let currentToken = token
    const doFetch = async (t) => {
      return fetch(`${API_BASE}/api/tts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${t}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text, lang, voice: voiceId || undefined }),
      })
    }

    let res = await doFetch(currentToken)
    if (res.status === 401 || res.status === 422) {
      const newToken = await refreshToken()
      if (!newToken) return null
      res = await doFetch(newToken)
    }
    if (!res.ok) return null
    return res
  }

  const playBlob = (blob, buttonElement) => {
    const url = URL.createObjectURL(blob)
    const audio = new Audio(url)
    audioRef.current = audio
    audio.onended = () => {
      URL.revokeObjectURL(url)
      setCurrentButton(null)
      audioRef.current = null
    }
    audio.onerror = () => {
      URL.revokeObjectURL(url)
      setCurrentButton(null)
      audioRef.current = null
    }
    audio.play().catch(() => {
      setCurrentButton(null)
    })
  }

  const speakWithBrowserTTS = useCallback((text, lang, buttonElement) => {
    if (!window.speechSynthesis) {
      setCurrentButton(null)
      return
    }
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = lang
    const voices = speechSynthesis.getVoices()
    const preferred = voices.find(v => v.lang === lang || v.lang.startsWith(lang.split('-')[0]))
    if (preferred) utterance.voice = preferred
    utterance.onend = () => setCurrentButton(null)
    utterance.onerror = () => setCurrentButton(null)
    speechSynthesis.cancel()
    speechSynthesis.speak(utterance)
  }, [])

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    if (window.speechSynthesis) {
      speechSynthesis.cancel()
    }
    setCurrentButton(null)
  }, [])

  useEffect(() => {
    return () => stop()
  }, [stop])

  return { speakMessage, stop, currentButton }
}
