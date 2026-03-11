import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { stripe } from '@/lib/stripe'
import type Stripe from 'stripe'
import type { Database } from '@/types/supabase'

// Типизированный объект обновления профиля (без any)
type ProfileUpdate = Database['public']['Tables']['profiles']['Update']

// Fix [AI-Review][Low]: явные параметры и guard-проверки вместо ! assertions
function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('[webhook] Missing Supabase environment variables (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)')
  }

  return createClient<Database>(url, key)
}

// Admin-клиент Supabase с Service Role Key (обходит RLS).
// SupabaseClient<Database> — полная типизация без any.
type SupabaseAdmin = ReturnType<typeof createAdminClient>

// Task 3.1: checkout.session.completed
// Привязываем stripe_customer_id / stripe_subscription_id к профилю по email,
// если пользователь уже зарегистрирован (иначе Story 1.7 завершит привязку).
// Fix [AI-Review][Medium]: двухшаговое обновление устраняет Race Condition при retry-событиях:
//   1) По stripe_customer_id (идемпотентно для последующих retries после первой привязки)
//   2) По email (первичная привязка, когда stripe_customer_id ещё не установлен в БД)
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

  const updateData: ProfileUpdate = {
    stripe_customer_id: customerId ?? null,
    stripe_subscription_id: subscriptionId ?? null,
    subscription_status: 'active',
  }

  // Шаг 1: обновляем по stripe_customer_id (no-op при первом вызове, корректен при retry)
  if (customerId) {
    const { error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('stripe_customer_id', customerId)

    if (error) {
      throw new Error(
        `[webhook] Ошибка обновления профиля (checkout.completed via customer_id): ${error.message}`
      )
    }
  }

  // Шаг 2: первичная привязка по email (устанавливает stripe_customer_id при первом вызове)
  // Fix [AI-Review][Medium]: .select('id') позволяет обнаружить 0 обновлённых строк
  const { data: updatedProfiles, error: emailError } = await supabase
    .from('profiles')
    .update(updateData)
    .eq('email', email)
    .select('id')

  if (emailError) {
    throw new Error(
      `[webhook] Ошибка обновления профиля (checkout.completed via email): ${emailError.message}`
    )
  }

  if (!updatedProfiles || updatedProfiles.length === 0) {
    console.warn(
      `[webhook] checkout.session.completed: профиль не найден по email ${email}. Ожидание Story 1.7 для привязки.`
    )
  }
}

// Task 3.2: invoice.payment_succeeded
// Продлеваем/обновляем current_period_end и подтверждаем active-статус.
// В Stripe API 2026: subscription ID лежит в invoice.parent.subscription_details.subscription
// Fix [AI-Review][High]: OR-фильтр по subscription_id + customer_id решает race condition:
//   invoice.payment_succeeded может прийти до checkout.session.completed,
//   когда stripe_subscription_id ещё не записан в БД → fallback на stripe_customer_id.
async function handleInvoicePaymentSucceeded(
  invoice: Stripe.Invoice,
  supabase: SupabaseAdmin
) {
  const subRef = invoice.parent?.subscription_details?.subscription
  const subscriptionId = typeof subRef === 'string' ? subRef : subRef?.id
  const customerId =
    typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id ?? null

  if (!subscriptionId && !customerId) return

  const periodEndTs = invoice.lines?.data?.[0]?.period?.end
  const currentPeriodEnd = periodEndTs
    ? new Date(periodEndTs * 1000).toISOString()
    : null

  const update: ProfileUpdate = { subscription_status: 'active' }
  if (currentPeriodEnd) {
    update.current_period_end = currentPeriodEnd
  }
  // Устанавливаем subscription_id если ещё не записан (handles late event binding)
  if (subscriptionId) {
    update.stripe_subscription_id = subscriptionId
  }

  // OR-фильтр: subscription_id (основной) ИЛИ customer_id (fallback при нарушении порядка)
  const conditions: string[] = []
  if (subscriptionId) conditions.push(`stripe_subscription_id.eq.${subscriptionId}`)
  if (customerId) conditions.push(`stripe_customer_id.eq.${customerId}`)

  const { error } = await supabase
    .from('profiles')
    .update(update)
    .or(conditions.join(','))

  if (error) {
    throw new Error(
      `[webhook] Ошибка обновления профиля (invoice.payment_succeeded): ${error.message}`
    )
  }
}

// Task 3.3: customer.subscription.deleted
// Переводим пользователя в inactive.
// [AI-Review][High] Fix: двухшаговое обновление вместо OR:
//   1) строгая проверка по stripe_subscription_id (primary key события)
//   2) fallback по stripe_customer_id только если customerId определён
// [AI-Review][Medium] Fix: customerId проверяется перед использованием (PostgREST undefined guard)
// Примечание [Low]: Stripe не имеет события 'customer.subscription.canceled'.
//   AC2 упоминает 'canceled' как состояние, но в реальности Stripe шлёт 'customer.subscription.deleted'.
//   При отмене с cancel_at_period_end — событие 'customer.subscription.updated' (обрабатывается в handleSubscriptionUpdated).
async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription,
  supabase: SupabaseAdmin
) {
  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer?.id

  // Шаг 1: строгое обновление по stripe_subscription_id
  const { error } = await supabase
    .from('profiles')
    .update({ subscription_status: 'inactive' })
    .eq('stripe_subscription_id', subscription.id)

  if (error) {
    throw new Error(
      `[webhook] Ошибка обновления профиля (subscription.deleted via subscription_id): ${error.message}`
    )
  }

  // Шаг 2: fallback по stripe_customer_id (только если customerId определён)
  // Страхует случай, когда subscription_id ещё не привязан к профилю
  if (customerId) {
    const { error: fallbackError } = await supabase
      .from('profiles')
      .update({ subscription_status: 'inactive' })
      .eq('stripe_customer_id', customerId)

    if (fallbackError) {
      throw new Error(
        `[webhook] Ошибка обновления профиля (subscription.deleted via customer_id): ${fallbackError.message}`
      )
    }
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

  const update: ProfileUpdate = { subscription_status: status }
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

  try {
    // Task 5.4: admin-клиент с Service Role Key (обходит RLS для записи в profiles)
    // Fix [AI-Review][Low]: ошибка конфигурации перехватывается явно
    const supabase = createAdminClient()

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
    // Task 5.1 + 5.2: логируем ошибку с event.id, возвращаем 500 для Stripe retry (AC4, NFR19)
    // Fix [AI-Review][Low]: добавлен event.id для трассировки конкретного события в логах
    console.error('[webhook] Ошибка обработки события:', event.id, error)
    return NextResponse.json({ error: 'Ошибка обработки webhook' }, { status: 500 })
  }
}
