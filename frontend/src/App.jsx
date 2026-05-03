import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import AuthGuard from './components/AuthGuard'
import AppShellNav from './components/AppShellNav'
import SettingsModal from './components/SettingsModal'
import ForgotPassword from './pages/ForgotPassword'
import LoginSignup from './pages/LoginSignup'
import Home from './pages/Home'
import VideoAccess from './pages/VideoAccess'
import PoseDetection from './pages/PoseDetection'
import AdminDashboard from './pages/AdminDashboard'
import ChatPage from './pages/ChatPage'

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
            <Route path="/video" element={<VideoAccess />} />
            <Route path="/pose-detection" element={<PoseDetection />} />
            <Route path="/admin" element={<AdminDashboard />} />
          </Route>
        </Route>

        {/* Chat layout — no top nav, sidebar instead */}
        <Route element={<AuthGuard />}>
          <Route path="/chat" element={<ChatPage />} />
        </Route>

        {/* 404 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
