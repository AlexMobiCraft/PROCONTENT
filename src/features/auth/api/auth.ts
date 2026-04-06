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
  const confirmUrl = new URL('/auth/confirm', window.location.origin)
  confirmUrl.searchParams.set('next', '/onboarding')

  return supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: confirmUrl.toString(),
    },
  })
}

export async function updatePassword(password: string) {
  const supabase = createClient()
  return supabase.auth.updateUser({ password })
}

export async function resetPasswordForEmail(email: string) {
  const supabase = createClient()
  return supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/confirm?type=recovery`,
  })
}

export async function signOut() {
  const supabase = createClient()
  return supabase.auth.signOut()
}

export async function getSession() {
  const supabase = createClient()
  return supabase.auth.getSession()
}
