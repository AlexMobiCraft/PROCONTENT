import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { stripe } from '@/lib/stripe'
import type Stripe from 'stripe'

// Admin-клиент Supabase с Service Role Key (обходит RLS).
// Не используем Database generic чтобы избежать конфликтов типов Supabase JS v2.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAdmin = ReturnType<typeof createAdminClient>

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Task 3.1: checkout.session.completed
// Привязываем stripe_customer_id / stripe_subscription_id к профилю по email,
// если пользователь уже зарегистрирован (иначе Story 1.7 завершит привязку).
async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session,
  supabase: SupabaseAdmin
) {
  const email = session.customer_details?.email
  const customerId =
    typeof session.customer === 'string' ? session.customer : session.customer?.id
  const subscriptionId =
    typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id

  if (!email) {
    console.error('[webhook] checkout.session.completed: отсутствует email клиента')
    return
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      stripe_customer_id: customerId ?? null,
      stripe_subscription_id: subscriptionId ?? null,
      subscription_status: 'active',
    })
    .eq('email', email)

  if (error) {
    throw new Error(`[webhook] Ошибка обновления профиля (checkout.completed): ${error.message}`)
  }
}

// Task 3.2: invoice.payment_succeeded
// Продлеваем/обновляем current_period_end и подтверждаем active-статус.
// В Stripe API 2026: subscription ID лежит в invoice.parent.subscription_details.subscription
async function handleInvoicePaymentSucceeded(
  invoice: Stripe.Invoice,
  supabase: SupabaseAdmin
) {
  const subRef = invoice.parent?.subscription_details?.subscription
  const subscriptionId = typeof subRef === 'string' ? subRef : subRef?.id

  if (!subscriptionId) return

  const periodEndTs = invoice.lines?.data?.[0]?.period?.end
  const currentPeriodEnd = periodEndTs
    ? new Date(periodEndTs * 1000).toISOString()
    : null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const update: Record<string, any> = { subscription_status: 'active' }
  if (currentPeriodEnd) {
    update.current_period_end = currentPeriodEnd
  }

  const { error } = await supabase
    .from('profiles')
    .update(update)
    .eq('stripe_subscription_id', subscriptionId)

  if (error) {
    throw new Error(
      `[webhook] Ошибка обновления профиля (invoice.payment_succeeded): ${error.message}`
    )
  }
}

// Task 3.3: customer.subscription.deleted
// Переводим пользователя в inactive. Поиск по subscription_id ИЛИ customer_id (идемпотентно).
async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription,
  supabase: SupabaseAdmin
) {
  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer?.id

  const { error } = await supabase
    .from('profiles')
    .update({ subscription_status: 'inactive' })
    .or(
      `stripe_subscription_id.eq.${subscription.id},stripe_customer_id.eq.${customerId}`
    )

  if (error) {
    throw new Error(
      `[webhook] Ошибка обновления профиля (subscription.deleted): ${error.message}`
    )
  }
}

// Task 3.4: customer.subscription.updated
// Если cancel_at_period_end = true — доступ сохраняется (AC5) до cancel_at.
// Если подписка реально завершена — ставим inactive/canceled.
async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription,
  supabase: SupabaseAdmin
) {
  // cancel_at — когда подписка реально закончится (если cancel_at_period_end=true)
  const cancelAt = subscription.cancel_at
  const periodEnd = cancelAt ? new Date(cancelAt * 1000).toISOString() : null

  let status: 'active' | 'inactive' | 'canceled'
  if (subscription.status === 'active') {
    status = 'active'
  } else if (subscription.status === 'canceled') {
    status = 'canceled'
  } else {
    status = 'inactive'
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const update: Record<string, any> = { subscription_status: status }
  if (periodEnd) {
    update.current_period_end = periodEnd
  }

  const { error } = await supabase
    .from('profiles')
    .update(update)
    .eq('stripe_subscription_id', subscription.id)

  if (error) {
    throw new Error(
      `[webhook] Ошибка обновления профиля (subscription.updated): ${error.message}`
    )
  }
}

// Task 3.3 (дополнительно): invoice.payment_failed
// Переводим в inactive, чтобы заблокировать доступ (AC2).
async function handleInvoicePaymentFailed(
  invoice: Stripe.Invoice,
  supabase: SupabaseAdmin
) {
  const subRef = invoice.parent?.subscription_details?.subscription
  const subscriptionId = typeof subRef === 'string' ? subRef : subRef?.id

  if (!subscriptionId) return

  const { error } = await supabase
    .from('profiles')
    .update({ subscription_status: 'inactive' })
    .eq('stripe_subscription_id', subscriptionId)

  if (error) {
    throw new Error(
      `[webhook] Ошибка обновления профиля (invoice.payment_failed): ${error.message}`
    )
  }
}

export async function POST(request: Request) {
  // Task 5.3: проверяем наличие секрета
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error('[webhook] STRIPE_WEBHOOK_SECRET не настроен')
    return NextResponse.json({ error: 'Конфигурация webhook недоступна' }, { status: 500 })
  }

  // Task 2.2: raw payload для валидации подписи (JSON parsing сломал бы подпись)
  let payload: string
  try {
    payload = await request.text()
  } catch (error) {
    console.error('[webhook] Ошибка чтения payload:', error)
    return NextResponse.json({ error: 'Ошибка чтения тела запроса' }, { status: 400 })
  }

  const signature = request.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ error: 'Отсутствует stripe-signature' }, { status: 400 })
  }

  // Task 2.3: валидация подписи Stripe (AC1, AC4, NFR8)
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret)
  } catch (error) {
    console.error('[webhook] Невалидная подпись Stripe:', error)
    return NextResponse.json({ error: 'Невалидная подпись webhook' }, { status: 400 })
  }

  // Task 5.4: admin-клиент с Service Role Key (обходит RLS для записи в profiles)
  const supabase = createAdminClient()

  try {
    // Task 2.4: операции Update идемпотентны по stripe_subscription_id / stripe_customer_id (NFR18)
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(
          event.data.object as Stripe.Checkout.Session,
          supabase
        )
        break

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice, supabase)
        break

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription, supabase)
        break

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription, supabase)
        break

      case 'invoice.payment_failed':
        // Task 5.1: логируем + переводим в inactive (AC2, NFR19)
        console.error('[webhook] invoice.payment_failed:', event.id)
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice, supabase)
        break

      // Task 3.5: неизвестные события — 200 OK, чтобы Stripe не делал retry
      default:
        break
    }

    return NextResponse.json({ received: true }, { status: 200 })
  } catch (error) {
    // Task 5.1 + 5.2: логируем ошибку, возвращаем 500 для Stripe retry (AC4, NFR19)
    console.error('[webhook] Ошибка обработки события:', error)
    return NextResponse.json({ error: 'Ошибка обработки webhook' }, { status: 500 })
  }
}
