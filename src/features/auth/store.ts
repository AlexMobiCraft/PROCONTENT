'use client'

import { create } from 'zustand'
import type { Session, User } from '@supabase/supabase-js'

interface AuthState {
  user: User | null
  session: Session | null
  isLoading: boolean
  setUser: (user: User | null) => void
  setSession: (session: Session | null) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  isLoading: false,
  setUser: (user) => set({ user }),
  setSession: (session) => set({ session }),
  clearAuth: () => set({ user: null, session: null }),
}))
