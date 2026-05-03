import { useRef, useCallback, useState } from 'react'

export function useTypewriter() {
  const fullRef = useRef('')
  const lenRef = useRef(0)
  const rafRef = useRef(null)
  const doneRef = useRef(null)
  const [, bump] = useState(0)

  const tick = useCallback(() => {
    const full = fullRef.current
    if (lenRef.current < full.length) {
      lenRef.current += 1
      bump(n => n + 1)
      rafRef.current = requestAnimationFrame(tick)
    } else {
      rafRef.current = null
      if (doneRef.current) {
        const cb = doneRef.current
        doneRef.current = null
        cb()
      }
    }
  }, [bump])

  const start = useCallback(() => {
    fullRef.current = ''
    lenRef.current = 0
    doneRef.current = null
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    bump(0)
  }, [bump])

  const append = useCallback((text) => {
    fullRef.current += text
    if (!rafRef.current) {
      rafRef.current = requestAnimationFrame(tick)
    }
  }, [tick])

  const done = useCallback((cb) => {
    doneRef.current = cb
    if (!rafRef.current && lenRef.current >= fullRef.current.length) {
      cb()
      doneRef.current = null
    }
  }, [])

  const flush = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    lenRef.current = fullRef.current.length
    bump(n => n + 1)
  }, [bump])

  const getFullText = useCallback(() => fullRef.current, [])

  const displayText = fullRef.current.slice(0, lenRef.current)

  return { displayText, start, append, done, flush, getFullText }
}