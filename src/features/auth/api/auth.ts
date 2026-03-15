'use client'

import { createClient } from '@/lib/supabase/client'

export async function signInWithPassword({ email, password }: { email: string, password: string }) {
  const supabase = createClient()
  return supabase.auth.signInWithPassword({
    email,
    password,
  })
}

export async function signUp({ email, password }: { email: string; password: string }) {
  const supabase = createClient()
  return supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/confirm`,
    },
  })
}

export async function updatePassword(password: string) {
  const supabase = createClient()
  return supabase.auth.updateUser({ password })
}

export async function signOut() {
  const supabase = createClient()
  return supabase.auth.signOut()
}

export async function getSession() {
  const supabase = createClient()
  return supabase.auth.getSession()
}
