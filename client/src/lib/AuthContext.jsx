import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { loadStats } from './storage'
import { fetchCloudStats, importLocalStats } from './api'
import { ALL_GROUP_IDS } from './constants'

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

  // On first login: if cloud has no stats yet, import everything from localStorage
  useEffect(() => {
    if (!user) return
    fetchCloudStats().then(cloud => {
      const hasCloudData = Object.keys(cloud).some(g => cloud[g]?.gamesPlayed > 0)
      if (!hasCloudData) {
        const localMap = {}
        for (const g of ALL_GROUP_IDS) {
          const s = loadStats(g)
          if (s.gamesPlayed > 0) localMap[g] = s
        }
        if (Object.keys(localMap).length > 0) importLocalStats(localMap)
      }
    }).catch(() => {})
  }, [user?.id])

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

// eslint-disable-next-line react-refresh/only-export-components -- hook colocated with its provider
export const useAuth = () => useContext(AuthContext)
