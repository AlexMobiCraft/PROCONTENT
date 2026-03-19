'use client'

import { useEffect } from 'react'
import type { Session, User } from '@supabase/supabase-js'

import { useAuthStore } from '@/features/auth/store'

interface AuthProviderProps {
  user: User
  session: Session | null
  children: React.ReactNode
}

// Инициализирует Zustand store из серверных данных в useEffect.
// useEffect гарантирует что мутация store не происходит в render-phase,
// что корректно с React StrictMode/concurrent mode и не вызывает SSR-утечек.
export function AuthProvider({ user, session, children }: AuthProviderProps) {
  useEffect(() => {
    const currentUser = useAuthStore.getState().user
    if (!currentUser || currentUser.id !== user.id) {
      useAuthStore.getState().setUser(user)
      useAuthStore.getState().setSession(session)
    }
  }, [user, session])

  return <>{children}</>
}
