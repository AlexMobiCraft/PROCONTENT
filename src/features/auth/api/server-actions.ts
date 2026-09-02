'use server'

import { createClient as createAdminSupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'
import type { Database } from '@/types/supabase'

export type LinkSubscriptionResult =
  | { linked: true; status: 'active' | 'trialing' }
  | {
      linked: false
      reason:
        | 'unauthenticated'
        | 'invalid_session'
        | 'not_paid'
        | 'email_mismatch'
        | 'no_subscription'
        | 'update_failed'
        | 'misconfigured'
    }

// Локальный admin-клиент: профиль обновляется в обход RLS, но импортировать его
// из вебхука нельзя — это разные слои. Объявляем здесь (см. правило проекта).
function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createAdminSupabaseClient<Database>(url, key)
}

/**
 * Привязывает оплаченную Stripe-сессию к только что зарегистрированному профилю.
 *
 * Зачем: вебхук `checkout.session.completed` приходит ДО регистрации (участница
 * платит, аккаунта ещё нет) и выходит, никого не найдя. Профиль, созданный
 * триггером `handle_new_user`, остаётся без `subscription_status`, поэтому
 * переход на `/onboarding` упирался в access-gate и уводил на `/inactive`,
 * где отрабатывал Stripe-fallback и высаживал участницу уже на `/feed` —
 * экран онбординга она не видела вовсе.
 *
 * Безопасность: `sessionId` приходит из URL, поэтому мало проверить оплату —
 * сверяем email сессии Stripe с email авторизованного пользователя. Иначе чужой
 * `session_id` позволил бы присвоить себе оплату другого человека.
 */
export async function linkSubscriptionAfterSignup(
  sessionId: string
): Promise<LinkSubscriptionResult> {
  if (!sessionId) {
    return { linked: false, reason: 'invalid_session' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    return { linked: false, reason: 'unauthenticated' }
  }

  let session
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId)
  } catch (error) {
    console.error('[linkSubscription] Не удалось получить сессию Stripe:', sessionId, error)
    return { linked: false, reason: 'invalid_session' }
  }

  if (session.mode !== 'subscription' || session.status !== 'complete') {
    return { linked: false, reason: 'invalid_session' }
  }

  if (session.payment_status !== 'paid' && session.payment_status !== 'no_payment_required') {
    return { linked: false, reason: 'not_paid' }
  }

  // Ключевая проверка: сессия должна принадлежать этому же человеку.
  const sessionEmail = session.customer_details?.email
  if (!sessionEmail || sessionEmail.toLowerCase() !== user.email.toLowerCase()) {
    console.error('[linkSubscription] Email сессии не совпадает с email пользователя:', sessionId)
    return { linked: false, reason: 'email_mismatch' }
  }

  const subscriptionId =
    typeof session.subscription === 'string' ? session.subscription : session.subscription?.id
  const customerId =
    typeof session.customer === 'string' ? session.customer : session.customer?.id

  if (!subscriptionId) {
    return { linked: false, reason: 'no_subscription' }
  }

  let subscription
  try {
    subscription = await stripe.subscriptions.retrieve(subscriptionId)
  } catch (error) {
    console.error('[linkSubscription] Подписка недоступна в Stripe:', subscriptionId, error)
    return { linked: false, reason: 'no_subscription' }
  }

  // Доступ открываем только реально действующей подписке (Stripe может создать trialing).
  if (subscription.status !== 'active' && subscription.status !== 'trialing') {
    return { linked: false, reason: 'no_subscription' }
  }

  // cancel_at — реальная дата окончания у promo-подписки без автопродления.
  // current_period_end есть в ответе, но отсутствует в типах (2026-02-25.clover) → cast.
  // Проверка перед new Date() обязательна: NaN дал бы RangeError, съеденный catch'ем.
  const rawPeriodEnd = (subscription as unknown as { current_period_end?: number })
    .current_period_end
  const periodEndTs = subscription.cancel_at ?? rawPeriodEnd
  const currentPeriodEnd = periodEndTs ? new Date(periodEndTs * 1000).toISOString() : null

  const admin = createAdminClient()
  if (!admin) {
    console.error('[linkSubscription] Не заданы переменные окружения Supabase admin')
    return { linked: false, reason: 'misconfigured' }
  }

  const update: Database['public']['Tables']['profiles']['Update'] = {
    subscription_status: subscription.status,
    stripe_subscription_id: subscriptionId,
    is_vip: false, // Правило 2: оплата снимает VIP тем же statement (chk_vip_xor_active)
  }
  if (customerId) update.stripe_customer_id = customerId
  if (currentPeriodEnd) update.current_period_end = currentPeriodEnd

  const { data: updatedRows, error: updateError } = await admin
    .from('profiles')
    .update(update)
    .eq('id', user.id)
    .select('id')

  if (updateError || !updatedRows || updatedRows.length === 0) {
    console.error(
      '[linkSubscription] Профиль не обновлён:',
      user.id,
      updateError?.message ?? '0 строк'
    )
    return { linked: false, reason: 'update_failed' }
  }

  return { linked: true, status: subscription.status }
}
