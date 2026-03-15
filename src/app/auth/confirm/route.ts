import { createServerClient } from '@supabase/ssr'
import { type EmailOtpType } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { getAuthSuccessRedirectPath } from '@/lib/app-routes'
import type { Database } from '@/types/supabase'

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
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.searchParams.delete('token_hash')
    redirectUrl.searchParams.delete('code')
    redirectUrl.searchParams.delete('type')
    redirectUrl.searchParams.delete('next')
    redirectUrl.pathname = next

    const response = NextResponse.redirect(redirectUrl)

    const supabase = createServerClient<Database>(
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

    // 1. Подтверждаем почту и получаем сессию
    let verifyError = null
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      verifyError = error
    } else if (tokenHash && type) {
      const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
      verifyError = error
    }

    if (!verifyError) {
      // 2. УМНАЯ ПРИВЯЗКА (Story 1.7): Если профиль только что создан, проверяем Stripe
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user?.email) {
        try {
          // Ищем успешные подписки в Stripe по email
          const subscriptions = await stripe.subscriptions.list({
            customer: undefined, // ищем по email через поиск клиентов (ниже)
            status: 'active',
            limit: 10,
          })
          
          // Это требует поиска клиента по email
          const customers = await stripe.customers.list({
            email: user.email,
            limit: 1
          })

          if (customers.data.length > 0) {
            const customerId = customers.data[0].id
            const activeSubs = await stripe.subscriptions.list({
              customer: customerId,
              status: 'active',
              limit: 1
            })

            if (activeSubs.data.length > 0) {
              const sub = activeSubs.data[0]
              // Активируем профиль в Supabase (используем сервисную роль для обхода RLS если нужно)
              // Но так как мы уже авторизованы, и если RLS позволяет юзеру обновить свой профиль:
              await supabase
                .from('profiles')
                .update({
                  subscription_status: 'active',
                  stripe_customer_id: customerId,
                  stripe_subscription_id: sub.id,
                  current_period_end: new Date(sub.current_period_end * 1000).toISOString()
                })
                .eq('id', user.id)
            }
          }
        } catch (e) {
          console.error('[auth/confirm] Ошибка авто-привязки подписки:', e)
        }
      }
      return response
    }

    console.error('[auth/confirm] Ошибка верификации:', verifyError.message)
  }

  const errorUrl = request.nextUrl.clone()
  errorUrl.pathname = '/login'
  errorUrl.searchParams.set('error', 'auth_callback_error_v2')
  return NextResponse.redirect(errorUrl)
}
