import { createServerClient } from '@supabase/ssr'
import { type EmailOtpType } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

import { getAuthSuccessRedirectPath } from '@/lib/app-routes'

export async function GET(request: NextRequest) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error('[auth/confirm] Missing Supabase env vars')
    const errorUrl = request.nextUrl.clone()
    errorUrl.pathname = '/login'
    errorUrl.searchParams.set('error', 'auth_callback_error_v2')
    return NextResponse.redirect(errorUrl)
  }

  const { searchParams } = request.nextUrl
  const tokenHash = searchParams.get('token_hash')
  const code = searchParams.get('code')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') || getAuthSuccessRedirectPath()

  if ((tokenHash && type) || code) {
    // Определяем путь редиректа
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.searchParams.delete('token_hash')
    redirectUrl.searchParams.delete('code')
    redirectUrl.searchParams.delete('type')
    redirectUrl.searchParams.delete('next')

    // Если это первый вход после регистрации или восстановление — можно отправить на /feed 
    // или на специальную страницу успеха.
    redirectUrl.pathname = next

    // Создаём ответ ПЕРВЫМ — куки будут прикреплены к нему
    const response = NextResponse.redirect(redirectUrl)

    // Supabase клиент для Route Handler
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (!error) return response
      console.error('[auth/confirm] exchangeCodeForSession error:', error.message)
    } else if (tokenHash && type) {
      const { error } = await supabase.auth.verifyOtp({
        type,
        token_hash: tokenHash,
      })
      if (!error) return response
      console.error('[auth/confirm] verifyOtp error:', error.message, '| type:', type)
    }
  }

  // Ошибка (нет кода/токена или ошибка верификации)
  const errorUrl = request.nextUrl.clone()
  errorUrl.searchParams.delete('token_hash')
  errorUrl.searchParams.delete('code')
  errorUrl.searchParams.delete('type')
  errorUrl.searchParams.delete('next')
  errorUrl.pathname = '/login'
  errorUrl.searchParams.set('error', 'auth_callback_error_v2')
  return NextResponse.redirect(errorUrl)
}
