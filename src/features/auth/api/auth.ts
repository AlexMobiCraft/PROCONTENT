'use client'

import { createClient } from '@/lib/supabase/client'

export async function signInWithOtp(email: string) {
  const supabase = createClient()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? window.location.origin
  return supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `${siteUrl}/auth/callback`,
    },
  })
}

export async function verifyOtp(email: string, token: string) {
  const supabase = createClient()
  return supabase.auth.verifyOtp({
    email,
    token,
    type: 'email',
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
