import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const NAV_ITEMS = [
  { path: '/', label: '首頁', i18n: 'nav.appShell.home', icon: 'fa-home' },
  { path: '/chat', label: 'AI 聊天', i18n: 'nav.appShell.aiChat', icon: 'fa-comments' },
  { path: '/pose-detection', label: '姿態', i18n: 'nav.appShell.pose', icon: 'fa-person-running' },
  { path: '/video', label: '影片', i18n: 'nav.appShell.video', icon: 'fa-video' },
]

export default function AppShellNav() {
  const { user, logout } = useAuth()
  const location = useLocation()

  const isActive = (path) => location.pathname === path || (path !== '/' && location.pathname.startsWith(path))

  return (
    <header className="flex items-center justify-between px-6 py-3 border-b bg-ae-card border-ae-border">
      <div className="flex items-center gap-8">
        <Link to="/" className="text-lg font-semibold tracking-tight text-ae-text no-underline font-display">
          Steup Growth
        </Link>

        <nav className="flex items-center gap-1">
          {NAV_ITEMS.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={`ae-navlink ${isActive(item.path) ? 'is-active' : ''}`}
            >
              {item.label}
            </Link>
          ))}
          {user?.role === 'admin' && (
            <Link
              to="/admin"
              className={`ae-navlink ${isActive('/admin') ? 'is-active' : ''}`}
            >
              管理後台
            </Link>
          )}
        </nav>
      </div>

      <div className="flex items-center gap-2">
        {user ? (
          <>
            <button
              className="ae-icon-btn"
              title="設定"
              aria-label="Settings"
              onClick={() => {
                // Settings modal will be triggered by this click
                // The SettingsModal component listens for a custom event or global state
                window.dispatchEvent(new CustomEvent('open-settings'))
              }}
            >
              <i className="fas fa-gear"></i>
            </button>
            <button
              className="ae-btn ae-btn--danger text-sm"
              onClick={logout}
            >
              <i className="fas fa-right-from-bracket"></i>
              <span>登出</span>
            </button>
          </>
        ) : (
          <Link to="/login" className="ae-btn ae-btn--primary">
            <i className="fas fa-user"></i>
            <span>登入</span>
          </Link>
        )}
      </div>
    </header>
  )
}
