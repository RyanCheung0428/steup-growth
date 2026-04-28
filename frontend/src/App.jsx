import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import AuthGuard from './components/AuthGuard'
import AppShellNav from './components/AppShellNav'
import SettingsModal from './components/SettingsModal'
import ForgotPassword from './pages/ForgotPassword'
import LoginSignup from './pages/LoginSignup'
import Home from './pages/Home'

function AppShellLayout() {
  return (
    <>
      <AppShellNav />
      <div className="flex-1">
        <Outlet />
      </div>
      <SettingsModal />
    </>
  )
}

export default function App() {
  return (
    <>
      <Routes>
        {/* Public routes — no nav, no settings */}
        <Route path="/login" element={<LoginSignup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />

        {/* Protected routes — with app shell nav + settings */}
        <Route element={<AuthGuard />}>
          <Route element={<AppShellLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/video" element={<div className="p-8 text-ae-textMuted">Video Access — Phase 4</div>} />
            <Route path="/pose-detection" element={<div className="p-8 text-ae-textMuted">Pose Detection — Phase 5</div>} />
            <Route path="/admin" element={<div className="p-8 text-ae-textMuted">Admin — Phase 6</div>} />
          </Route>
        </Route>

        {/* Chat layout — no top nav, sidebar instead */}
        <Route element={<AuthGuard />}>
          <Route path="/chat" element={<div className="p-8 text-ae-textMuted">Chatbox — Phase 7</div>} />
        </Route>

        {/* 404 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
