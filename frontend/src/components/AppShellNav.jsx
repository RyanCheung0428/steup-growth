import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const NAV_ITEMS = [
  { path: '/', label: '首頁' },
  { path: '/chat', label: 'AI 聊天' },
  { path: '/pose-detection', label: '姿態' },
  { path: '/video', label: '影片' },
]

export default function AppShellNav() {
  const { user, logout } = useAuth()
  const location = useLocation()

  const isActive = (path) =>
    location.pathname === path || (path !== '/' && location.pathname.startsWith(path))

  return (
    <header className="ae-topnav">
      <div className="w-[min(calc(100%-40px),1440px)] mx-auto min-h-[76px] grid items-center gap-6 max-md:w-[min(calc(100%-24px),1440px)] md:grid-cols-[auto_1fr_auto] max-md:grid-cols-1 max-md:py-3.5">
        <Link
          to="/"
          className="text-[1.7rem] font-bold -tracking-[0.03em] text-[var(--ae-text)] no-underline"
        >
          Steup Growth
        </Link>

        <nav className="flex justify-center gap-2.5 flex-wrap">
          {NAV_ITEMS.map((item) => (
            <Link key={item.path} to={item.path} className={`ae-navlink ${isActive(item.path) ? 'is-active' : ''}`}>
              {item.label}
            </Link>
          ))}
          {user?.role === 'admin' && (
            <Link to="/admin" className={`ae-navlink ${isActive('/admin') ? 'is-active' : ''}`}>
              管理後台
            </Link>
          )}
        </nav>

        <div className="flex justify-end items-center gap-2.5">
          {user ? (
            <>
              <button
                className="ae-icon-btn"
                title="設定"
                aria-label="Settings"
                onClick={() => window.dispatchEvent(new CustomEvent('open-settings'))}
              >
                <i className="fas fa-gear" />
              </button>
              <button className="ae-btn ae-btn--danger text-sm" onClick={logout}>
                <i className="fas fa-right-from-bracket" />
                <span>登出</span>
              </button>
            </>
          ) : (
            <Link to="/login" className="ae-btn ae-btn--primary">
              <i className="fas fa-user" />
              <span>登入</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
