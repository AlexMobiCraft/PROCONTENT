'use client'

import { useEffect } from 'react'
import type { Session, User } from '@supabase/supabase-js'

import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/features/auth/store'

interface AuthProviderProps {
  user: User
  session: Session | null
  children: React.ReactNode
}

// Инициализирует Zustand store из серверных данных и подписывается на клиентские
// изменения auth-состояния (token refresh и т.д.) через onAuthStateChange.
// useEffect гарантирует что мутация store не происходит в render-phase,
// что корректно с React StrictMode/concurrent mode и не вызывает SSR-утечек.
export function AuthProvider({ user, session, children }: AuthProviderProps) {
  useEffect(() => {
    const state = useAuthStore.getState()
    const currentUser = state.user
    const currentSession = state.session

    // Обновляем user если изменился user.id или если user стал null
    if (!currentUser || currentUser.id !== user.id) {
      state.setUser(user)
    }

    // Обновляем session независимо — может обновиться без изменения user.id (token refresh)
    if (currentSession?.access_token !== session?.access_token) {
      state.setSession(session)
    }

    // Сигнализируем что hydration завершена
    state.setReady(true)

    // Подписываемся на клиентские изменения auth-состояния.
    // Это обновляет Zustand store при token refresh, sign-out и т.д.,
    // предотвращая хранение протухшего токена после клиентского обновления.
    const supabase = createClient()
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      const authState = useAuthStore.getState()
      authState.setSession(newSession)
      authState.setUser(newSession?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [user, session])

  return <>{children}</>
}
