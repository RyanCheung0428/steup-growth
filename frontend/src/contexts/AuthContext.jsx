import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { API_BASE } from '../lib/apiBase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('access_token'))
  const [user, setUser] = useState(null)
  const navigate = useNavigate()

  const isAuthenticated = !!token

  // Decode JWT to get user info on mount
  useEffect(() => {
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]))
        setUser({
          id: payload.sub || payload.user_id,
          username: payload.username,
          email: payload.email,
          role: payload.role,
        })
      } catch {
        logout()
      }
    }
  }, [token])

  const login = useCallback((newToken) => {
    localStorage.setItem('access_token', newToken)
    setToken(newToken)
    // User info will be set by the useEffect above
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('access_token')
    setToken(null)
    setUser(null)
    navigate('/')
  }, [navigate])

  const refreshToken = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })
      if (res.ok) {
        const data = await res.json()
        if (data.access_token) {
          login(data.access_token)
          return data.access_token
        }
      }
    } catch {
      // Silently fail — API module will handle 401
    }
    return token
  }, [token, login])

  const value = {
    token,
    user,
    isAuthenticated,
    login,
    logout,
    refreshToken,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export default AuthContext
