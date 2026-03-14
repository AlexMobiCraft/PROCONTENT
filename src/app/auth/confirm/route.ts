import { type EmailOtpType } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import { getAuthSuccessRedirectPath } from '@/lib/app-routes'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? getAuthSuccessRedirectPath()

  const redirectUrl = request.nextUrl.clone()
  redirectUrl.searchParams.delete('token_hash')
  redirectUrl.searchParams.delete('type')
  redirectUrl.searchParams.delete('next')

  if (tokenHash && type) {
    const supabase = await createClient()

    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    })
    
    if (!error) {
      if (type === 'signup' || type === 'recovery') {
        redirectUrl.pathname = '/update-password'
      } else {
        redirectUrl.pathname = next
      }
      return NextResponse.redirect(redirectUrl)
    }

    // Если verifyOtp вернул ошибку
    console.error('[auth/confirm] Error:', error.message)
    redirectUrl.pathname = '/login'
    redirectUrl.searchParams.set('error', 'auth_callback_error_v2')
    redirectUrl.searchParams.set('error_description', error.message)
    return NextResponse.redirect(redirectUrl)
  }

  // Если параметров нет вообще
  redirectUrl.pathname = '/login'
  redirectUrl.searchParams.set('error', 'auth_callback_error_v2')
  redirectUrl.searchParams.set('error_description', 'Missing token_hash or type')
  return NextResponse.redirect(redirectUrl)
}
