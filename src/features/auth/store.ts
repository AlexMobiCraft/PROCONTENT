'use client'

import { create } from 'zustand'
import type { Session, User } from '@supabase/supabase-js'

interface AuthState {
  user: User | null
  session: Session | null
  isLoading: boolean
  isReady: boolean
  setUser: (user: User | null) => void
  setSession: (session: Session | null) => void
  setReady: (ready: boolean) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  isLoading: false,
  isReady: false,
  setUser: (user) => set({ user }),
  setSession: (session) => set({ session }),
  setReady: (ready) => set({ isReady: ready }),
  clearAuth: () => set({ user: null, session: null, isReady: false }),
}))
