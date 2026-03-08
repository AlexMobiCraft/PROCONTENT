'use client'

import type { Session, User } from '@supabase/supabase-js'

import { useAuthStore } from '@/features/auth/store'

interface AuthProviderProps {
  user: User
  session: Session
  children: React.ReactNode
}

// Инициализирует Zustand store из серверной сессии синхронно —
// без useEffect, чтобы избежать вспышки неавторизованного UI при гидратации.
export function AuthProvider({ user, session, children }: AuthProviderProps) {
  const currentUser = useAuthStore.getState().user
  if (!currentUser || currentUser.id !== user.id) {
    useAuthStore.getState().setUser(user)
    useAuthStore.getState().setSession(session)
  }

  return <>{children}</>
}
