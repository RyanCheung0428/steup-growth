import { useState, useCallback, useRef, useEffect } from 'react'
import { useI18n } from '../contexts/I18nContext'

const LANG_MAP = { 'zh-TW': 'zh-TW', 'zh-CN': 'zh-CN', 'en': 'en-US', 'ja': 'ja-JP' }

export function useVoiceInput(textareaRef) {
  const { locale } = useI18n()
  const [isRecording, setIsRecording] = useState(false)
  const [statusText, setStatusText] = useState('')
  const recognitionRef = useRef(null)

  const startRecording = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setStatusText('voiceNotSupported')
      return
    }

    const recognition = new SpeechRecognition()
    const lang = LANG_MAP[locale] || 'zh-TW'
    recognition.lang = lang
    recognition.interimResults = false
    recognition.continuous = false

    recognition.onstart = () => {
      setIsRecording(true)
      setStatusText('voiceRecording')
    }

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript
      if (textareaRef.current) {
        const textarea = textareaRef.current
        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        const text = textarea.value
        textarea.value = text.slice(0, start) + transcript + text.slice(end)
        textarea.selectionStart = textarea.selectionEnd = start + transcript.length
        textarea.dispatchEvent(new Event('input', { bubbles: true }))
        textarea.focus()
      }
    }

    recognition.onend = () => {
      setIsRecording(false)
      setStatusText('')
    }

    recognition.onerror = (event) => {
      setIsRecording(false)
      if (event.error === 'not-allowed' || event.error === 'permission-denied') {
        setStatusText('micPermissionDenied')
      } else {
        setStatusText('')
      }
    }

    recognitionRef.current = recognition
    recognition.start()
  }, [locale, textareaRef])

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    setIsRecording(false)
    setStatusText('')
  }, [])

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
    }
  }, [])

  return { isRecording, statusText, startRecording, stopRecording }
}