import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { authApi } from '@/api/auth.api'
import { getToken, setToken, clearToken } from '@/api/client'
import type { User } from '@/types/user'

interface AuthContextValue {
  user: User | null
  isAuthenticated: boolean
  /** True while we verify an existing token on first load. */
  initializing: boolean
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

/**
 * AuthProvider — holds the authenticated user and exposes auth actions.
 * On mount, if a token exists it validates it via /auth/me so refreshes keep
 * the user signed in. Intentionally lightweight (no external state library).
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [initializing, setInitializing] = useState(true)

  useEffect(() => {
    const token = getToken()
    if (!token) {
      setInitializing(false)
      return
    }
    authApi
      .me()
      .then(setUser)
      .catch(() => clearToken())
      .finally(() => setInitializing(false))
  }, [])

  const login = async (email: string, password: string) => {
    const { token, user } = await authApi.login(email, password)
    setToken(token)
    setUser(user)
  }

  const register = async (name: string, email: string, password: string) => {
    const { token, user } = await authApi.register(name, email, password)
    setToken(token)
    setUser(user)
  }

  const logout = () => {
    clearToken()
    setUser(null)
  }

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated: !!user, initializing, login, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return ctx
}
