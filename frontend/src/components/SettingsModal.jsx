import { useState, useEffect, useCallback } from 'react'

/**
 * SettingsModal — placeholder for Phase 0.
 * Full implementation with 4 tabs (Profile, Children, Personalization, API Keys)
 * will be completed as the pages that depend on it are built.
 * 
 * Current Phase 0 behavior: opens/closes, shows placeholder tabs.
 */
export default function SettingsModal() {
  const [isOpen, setIsOpen] = useState(false)

  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])

  // Listen for global open event from AppShellNav settings button
  useEffect(() => {
    window.addEventListener('open-settings', open)
    return () => window.removeEventListener('open-settings', open)
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const handler = (e) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, close])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => {
        if (e.target === e.currentTarget) close()
      }}
    >
      <div className="bg-ae-card rounded-2xl w-full max-w-3xl max-h-[85vh] flex overflow-hidden animate-fade-in border border-ae-border shadow-xl">
        {/* Sidebar tabs (placeholder) */}
        <div className="w-52 border-r border-ae-border p-4 flex flex-col gap-2 flex-shrink-0">
          <h3 className="font-semibold text-sm text-ae-textMuted uppercase tracking-wider mb-2">Settings</h3>
          <button className="ae-btn ae-btn--ghost justify-start !bg-ae-border">Profile</button>
          <button className="ae-btn ae-btn--ghost justify-start">Children</button>
          <button className="ae-btn ae-btn--ghost justify-start">Personalization</button>
          <button className="ae-btn ae-btn--ghost justify-start">API Keys</button>
        </div>

        {/* Content panel (placeholder) */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-ae-text">Settings</h2>
            <button className="ae-icon-btn" onClick={close}>
              <i className="fas fa-times"></i>
            </button>
          </div>
          <p className="text-ae-textMuted">
            Settings modal will be fully implemented as shared component.
            Currently: 4 tabs (Profile, Children, Personalization, API Keys).
          </p>
        </div>
      </div>
    </div>
  )
}
