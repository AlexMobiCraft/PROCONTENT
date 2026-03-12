import { type EmailOtpType } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import { getAuthSuccessRedirectPath } from '@/lib/app-routes'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? getAuthSuccessRedirectPath()

  if (tokenHash && type) {
    const supabase = await createClient()

    const { error } = await supabase.auth.verifyOtp({
      type,
      'token_hash': tokenHash,
    })
    
    if (!error) {
      // Подчищаем URL от токена перед редиректом
      const url = request.nextUrl.clone()
      url.pathname = next
      url.searchParams.delete('token_hash')
      url.searchParams.delete('type')
      url.searchParams.delete('next')
      return NextResponse.redirect(url)
    }
  }

  // При ошибке редиректим на логин с параметром ошибки
  const url = request.nextUrl.clone()
  url.pathname = '/login'
  url.searchParams.delete('token_hash')
  url.searchParams.delete('type')
  url.searchParams.delete('next')
  url.searchParams.set('error', 'auth_callback_error')
  return NextResponse.redirect(url)
}
