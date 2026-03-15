import { createServerClient } from '@supabase/ssr'
import { createClient, type EmailOtpType } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { getAuthSuccessRedirectPath } from '@/lib/app-routes'
import type { Database } from '@/types/supabase'

// url и key гарантированы env guard'ом в начале GET handler (F4)
function createAdminSupabaseClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(request: NextRequest) {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY // F1: проверяем service key здесь, чтобы ошибка не поглощалась catch
  ) {
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
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user?.email) {
        // F9: пропускаем Stripe-запрос если подписка уже активна (идемпотентность)
        const { data: profile } = await supabase
          .from('profiles')
          .select('subscription_status')
          .eq('id', user.id)
          .single()

        if (profile?.subscription_status !== 'active') {
          try {
            const customers = await stripe.customers.list({
              email: user.email,
              limit: 1,
            })

            if (customers.data.length > 0) {
              const customerId = customers.data[0].id
              const activeSubs = await stripe.subscriptions.list({
                customer: customerId,
                status: 'active',
                limit: 1,
              })

              // F8: adminSupabase создаётся один раз на весь stripe-путь запроса
              const adminSupabase = createAdminSupabaseClient()

              if (activeSubs.data.length > 0) {
                const sub = activeSubs.data[0]
                const rawPeriodEnd = (sub as unknown as { current_period_end?: number })
                  .current_period_end
                const currentPeriodEnd = rawPeriodEnd
                  ? new Date(rawPeriodEnd * 1000).toISOString()
                  : null

                const { error: updateError, count } = await adminSupabase
                  .from('profiles')
                  .update(
                    {
                      subscription_status: sub.status as 'active' | 'trialing', // F6: используем реальный статус из Stripe
                      stripe_customer_id: customerId,
                      stripe_subscription_id: sub.id,
                      current_period_end: currentPeriodEnd, // F2: явный null если нет значения
                    },
                    { count: 'exact' } // F3: отслеживаем кол-во обновлённых строк
                  )
                  .eq('id', user.id)

                if (updateError) {
                  console.error('[auth/confirm] Ошибка обновления профиля:', updateError.message)
                } else if (count === 0) {
                  console.error(
                    '[auth/confirm] Профиль не найден для обновления, user.id:',
                    user.id
                  ) // F3
                } else {
                  console.log('[auth/confirm] Профиль активирован для user:', user.id) // F5
                }
              } else {
                // F7: customer найден, но активной подписки нет — записываем stripe_customer_id
                const { error: updateError } = await adminSupabase
                  .from('profiles')
                  .update({ stripe_customer_id: customerId })
                  .eq('id', user.id)

                if (updateError) {
                  console.error(
                    '[auth/confirm] Ошибка записи stripe_customer_id:',
                    updateError.message
                  )
                }
              }
            }
          } catch (e) {
            // F10: Stripe SDK использует 0 retries по умолчанию;
            // для настройки retries — см. инициализацию в src/lib/stripe.ts
            console.error('[auth/confirm] Ошибка авто-привязки подписки:', e)
          }
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
