'use client'

import { useEffect } from 'react'

import type { Session, User } from '@supabase/supabase-js'

import { useAuthStore } from '@/features/auth/store'

interface AuthProviderProps {
  user: User
  session: Session
  children: React.ReactNode
}

// Инициализирует Zustand store из серверной сессии на клиенте.
// Должен оборачивать children внутри (app)/layout.tsx.
export function AuthProvider({ user, session, children }: AuthProviderProps) {
  const storeUser = useAuthStore((state) => state.user)
  const setUser = useAuthStore((state) => state.setUser)
  const setSession = useAuthStore((state) => state.setSession)

  useEffect(() => {
    if (!storeUser) {
      setUser(user)
      setSession(session)
    }
  }, [user, session, storeUser, setUser, setSession])

  return <>{children}</>
}
