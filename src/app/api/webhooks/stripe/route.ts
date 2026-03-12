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
// Fix [AI-Review][Critical] Round 6: ранний выход после шага 1, если профиль найден —
//   предотвращает перезапись чужого аккаунта с совпадающим email.
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

  // Fix [AI-Review][High] Round 5: только подписки — разовые платежи не активируют подписку
  if (session.mode !== 'subscription') {
    console.log('[webhook] checkout.session.completed: пропускаем, mode не subscription:', session.mode)
    return
  }

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
    const { data: updatedByCustomerId, error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('stripe_customer_id', customerId)
      .select('id')

    if (error) {
      throw new Error(
        `[webhook] Ошибка обновления профиля (checkout.completed via customer_id): ${error.message}`
      )
    }

    // Ранний выход: профиль найден по customerId — не рискуем перетереть чужой аккаунт по email
    if (updatedByCustomerId && updatedByCustomerId.length > 0) return
  }

  // Шаг 2: O(1) поиск в auth.users через Postgres RPC (case-insensitive lower() в SQL).
  // Fix [AI-Review][Critical] Round 8: замена auth.admin.listUsers — загружала весь список
  //   пользователей в память и не масштабируется при росте базы.
  // Fix [AI-Review][Medium] Round 8: lower() в SQL функции обеспечивает case-insensitive сравнение.
  const { data: userId, error: authLookupError } = await supabase.rpc(
    'get_auth_user_id_by_email',
    { p_email: email }
  )

  if (authLookupError) {
    throw new Error(
      `[webhook] Ошибка поиска пользователя в auth.users: ${authLookupError.message}`
    )
  }

  if (!userId) {
    console.warn(
      `[webhook] checkout.session.completed: пользователь не найден в auth.users по email ${email}. Ожидание Story 1.7 для привязки.`
    )
    return
  }

  // Обновляем профиль по user ID (не по email — более надёжно)
  const { data: updatedProfiles, error: profileError } = await supabase
    .from('profiles')
    .update(updateData)
    .eq('id', userId)
    .select('id')

  if (profileError) {
    throw new Error(
      `[webhook] Ошибка обновления профиля (checkout.completed via user id): ${profileError.message}`
    )
  }

  if (!updatedProfiles || updatedProfiles.length === 0) {
    console.warn(
      `[webhook] checkout.session.completed: профиль не найден для userId ${userId} (email: ${email}).`
    )
  }
}

// Task 3.2: invoice.payment_succeeded
// Продлеваем/обновляем current_period_end и подтверждаем active-статус.
// В Stripe API 2026: subscription ID лежит в invoice.parent.subscription_details.subscription
// Fix [AI-Review][High]: двухшаговый подход вместо OR-фильтра.
//   OR-фильтр мог перезаписывать данные новой подписки старыми инвойсами.
//   Шаг 1: строгое обновление по subscription_id (primary key)
//   Шаг 2: fallback по customer_id ТОЛЬКО если stripe_subscription_id ещё не привязан (IS NULL)
// Fix [AI-Review][Medium] Round 6: ранний выход если шаг 1 нашёл строку — избегаем двойного обновления
async function handleInvoicePaymentSucceeded(
  invoice: Stripe.Invoice,
  supabase: SupabaseAdmin
) {
  const subRef = invoice.parent?.subscription_details?.subscription
  const subscriptionId = typeof subRef === 'string' ? subRef : subRef?.id
  const customerId =
    typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id ?? null

  if (!subscriptionId && !customerId) return

  // Fix [AI-Review][Medium] Round 5: ищем строку с type==='subscription' для точного period_end.
  // type отсутствует в Stripe TypeScript типах для API 2026-02-25.clover — используем type cast.
  // Если нет subscription-строки — fallback на первую (совместимость с тестовыми моками без type).
  const subscriptionLine = invoice.lines?.data?.find(
    (line) => (line as unknown as { type?: string }).type === 'subscription'
  )
  const periodEndTs = subscriptionLine?.period?.end ?? invoice.lines?.data?.[0]?.period?.end
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

  // Шаг 1: строгое обновление по stripe_subscription_id (основной ключ)
  if (subscriptionId) {
    const { data: updatedBySub, error } = await supabase
      .from('profiles')
      .update(update)
      .eq('stripe_subscription_id', subscriptionId)
      .select('id')

    if (error) {
      throw new Error(
        `[webhook] Ошибка обновления профиля (invoice.payment_succeeded via subscription_id): ${error.message}`
      )
    }

    // Ранний выход если строка найдена — избегаем двойного обновления
    if (updatedBySub && updatedBySub.length > 0) return
  }

  // Шаг 2: fallback по stripe_customer_id только для профилей без привязанного subscription_id.
  // Fix [AI-Review][High]: .is('stripe_subscription_id', null) предотвращает перезапись
  // данных новой подписки инвойсами от предыдущей.
  if (customerId) {
    const { error: fallbackError } = await supabase
      .from('profiles')
      .update(update)
      .eq('stripe_customer_id', customerId)
      .is('stripe_subscription_id', null)

    if (fallbackError) {
      throw new Error(
        `[webhook] Ошибка обновления профиля (invoice.payment_succeeded via customer_id): ${fallbackError.message}`
      )
    }
  }
}

// Task 3.3: customer.subscription.deleted
// Переводим пользователя в inactive.
// [AI-Review][High] Fix: двухшаговое обновление вместо OR:
//   1) строгая проверка по stripe_subscription_id (primary key события)
//   2) fallback по stripe_customer_id только если customerId определён
// [AI-Review][Medium] Fix: customerId проверяется перед использованием (PostgREST undefined guard)
// [AI-Review][Medium] Fix Round 6: ранний выход если шаг 1 нашёл строку — избегаем двойного обновления
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
  const { data: updatedBySub, error } = await supabase
    .from('profiles')
    .update({ subscription_status: 'inactive' })
    .eq('stripe_subscription_id', subscription.id)
    .select('id')

  if (error) {
    throw new Error(
      `[webhook] Ошибка обновления профиля (subscription.deleted via subscription_id): ${error.message}`
    )
  }

  // Ранний выход если строка найдена — избегаем двойного обновления
  if (updatedBySub && updatedBySub.length > 0) return

  // Шаг 2: fallback по stripe_customer_id только если stripe_subscription_id ещё не привязан.
  // Fix [AI-Review][High]: .is('stripe_subscription_id', null) предотвращает случайную отмену
  // новой подписки при замене подписок (когда у профиля уже есть новый subscription_id).
  if (customerId) {
    const { error: fallbackError } = await supabase
      .from('profiles')
      .update({ subscription_status: 'inactive' })
      .eq('stripe_customer_id', customerId)
      .is('stripe_subscription_id', null)

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
// Fix [AI-Review][High] Round 6: добавлен fallback по stripe_customer_id (Race Condition fix).
//   subscription.updated может прийти до checkout.session.completed (нет subscription_id в профиле).
async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription,
  supabase: SupabaseAdmin
) {
  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer?.id

  // Примечание [AI-Review][Medium]: запрос использовать subscription.current_period_end,
  // однако в Stripe API 2026-02-25.clover это поле отсутствует на типе Subscription.
  // Согласно Dev Notes: в новом API используется cancel_at вместо current_period_end.
  // cancel_at — когда подписка реально закончится (если cancel_at_period_end=true)
  const cancelAt = subscription.cancel_at
  const periodEnd = cancelAt ? new Date(cancelAt * 1000).toISOString() : null

  let status: 'active' | 'inactive' | 'canceled'
  // Fix [AI-Review][High] Round 8: trialing = пробный период, пользователь имеет активный доступ
  if (subscription.status === 'active' || subscription.status === 'trialing') {
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

  // Шаг 1: обновление по stripe_subscription_id
  const { data: updatedBySub, error } = await supabase
    .from('profiles')
    .update(update)
    .eq('stripe_subscription_id', subscription.id)
    .select('id')

  if (error) {
    throw new Error(
      `[webhook] Ошибка обновления профиля (subscription.updated): ${error.message}`
    )
  }

  if (updatedBySub && updatedBySub.length > 0) return

  // Шаг 2: fallback по stripe_customer_id если subscription_id ещё не привязан в профиле
  if (customerId) {
    const { error: fallbackError } = await supabase
      .from('profiles')
      .update(update)
      .eq('stripe_customer_id', customerId)
      .is('stripe_subscription_id', null)

    if (fallbackError) {
      throw new Error(
        `[webhook] Ошибка обновления профиля (subscription.updated via customer_id): ${fallbackError.message}`
      )
    }
  }
}

// Task 3.3 (дополнительно): invoice.payment_failed
// Переводим в inactive, чтобы заблокировать доступ (AC2).
// Fix [AI-Review][Medium] Round 6: добавлен fallback по stripe_customer_id (Race Condition fix).
//   payment_failed может прийти до checkout.session.completed (нет subscription_id в профиле).
// Fix [AI-Review][Medium] Round 7: сбрасываем current_period_end в null при неуплате —
//   подписка больше не активна, оставлять дату окончания периода вводит UI в заблуждение.
async function handleInvoicePaymentFailed(
  invoice: Stripe.Invoice,
  supabase: SupabaseAdmin
) {
  const subRef = invoice.parent?.subscription_details?.subscription
  const subscriptionId = typeof subRef === 'string' ? subRef : subRef?.id
  const customerId =
    typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id ?? null

  if (!subscriptionId && !customerId) return

  const failedUpdate: ProfileUpdate = {
    subscription_status: 'inactive',
    current_period_end: null, // Сбрасываем — оплаченный период истёк
  }

  // Шаг 1: обновление по stripe_subscription_id.
  // Fix [AI-Review][High] Round 8: guard от stale webhooks с задержкой Stripe.
  //   Обновляем в inactive только если period_end уже истёк или не установлен.
  //   Если period_end в будущем → более свежий invoice.payment_succeeded уже продлил период.
  const nowIso = new Date().toISOString()
  if (subscriptionId) {
    const { data: updatedBySub, error } = await supabase
      .from('profiles')
      .update(failedUpdate)
      .eq('stripe_subscription_id', subscriptionId)
      .or(`current_period_end.is.null,current_period_end.lte.${nowIso}`)
      .select('id')

    if (error) {
      throw new Error(
        `[webhook] Ошибка обновления профиля (invoice.payment_failed via subscription_id): ${error.message}`
      )
    }

    if (updatedBySub && updatedBySub.length > 0) return
  }

  // Шаг 2: fallback по stripe_customer_id только для профилей без привязанного subscription_id
  if (customerId) {
    const { error: fallbackError } = await supabase
      .from('profiles')
      .update(failedUpdate)
      .eq('stripe_customer_id', customerId)
      .is('stripe_subscription_id', null)

    if (fallbackError) {
      throw new Error(
        `[webhook] Ошибка обновления профиля (invoice.payment_failed via customer_id): ${fallbackError.message}`
      )
    }
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
      // Fix [AI-Review][Low] Round 5: логируем тип для помощи в дебаге
      default:
        console.log('[webhook] Игнорируем необрабатываемое событие:', event.type)
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
