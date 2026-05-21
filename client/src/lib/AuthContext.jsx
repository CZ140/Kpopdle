import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  // undefined = still checking, null = logged out, object = logged in
  const [user, setUser] = useState(undefined)

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(r => r.json().catch(() => ({ user: null })))
      .then(({ user }) => setUser(user ?? null))
      .catch(() => setUser(null))
  }, [])

  const login = useCallback(() => {
    window.location.href = '/api/auth/google'
  }, [])

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    setUser(null)
  }, [])

  const deleteAccount = useCallback(async () => {
    await fetch('/api/auth/account', { method: 'DELETE', credentials: 'include' })
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, login, logout, deleteAccount }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
