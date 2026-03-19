'use client'

import { useRef } from 'react'
import type { Session, User } from '@supabase/supabase-js'

import { useAuthStore } from '@/features/auth/store'

interface AuthProviderProps {
  user: User
  session: Session | null
  children: React.ReactNode
}

// Инициализирует Zustand store из серверных данных один раз при монтировании.
// useRef гарантирует что мутация store происходит только один раз и не повторяется
// при каждом re-render, что совместимо с React concurrent/strict mode.
export function AuthProvider({ user, session, children }: AuthProviderProps) {
  const initialized = useRef(false)
  if (!initialized.current) {
    initialized.current = true
    const currentUser = useAuthStore.getState().user
    if (!currentUser || currentUser.id !== user.id) {
      useAuthStore.getState().setUser(user)
      useAuthStore.getState().setSession(session)
    }
  }

  return <>{children}</>
}
