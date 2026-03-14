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

  const supabase = await createClient()

  // 1. Проверяем, может мы уже авторизованы (на случай двойного вызова роута)
  const { data: { user } } = await supabase.auth.getUser()
  
  if (user) {
    console.log('[auth/confirm] User already authenticated, redirecting...')
    if (type === 'signup' || type === 'recovery') {
      redirectUrl.pathname = '/update-password'
    } else {
      redirectUrl.pathname = next
    }
    return NextResponse.redirect(redirectUrl)
  }

  // 2. Если не авторизованы, пробуем верифицировать токен
  if (tokenHash && type) {
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

    // Ошибка верификации
    console.error('[auth/confirm] VerifyOtp Error:', error.message)
    redirectUrl.pathname = '/login'
    redirectUrl.searchParams.set('error', 'auth_callback_error_v2')
    redirectUrl.searchParams.set('error_description', `${error.message} (Type: ${type})`)
    return NextResponse.redirect(redirectUrl)
  }

  // Параметров нет
  redirectUrl.pathname = '/login'
  redirectUrl.searchParams.set('error', 'auth_callback_error_v2')
  redirectUrl.searchParams.set('error_description', 'No token_hash found in URL')
  return NextResponse.redirect(redirectUrl)
}
