import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { stripe } from '@/lib/stripe'
import {
  consumeStripeWebhookRateLimit,
  getStripeWebhookRateLimitKey,
} from '@/lib/stripe/webhook-rate-limit'
import type Stripe from 'stripe'
import type { Database } from '@/types/supabase'

// Типизированный объект обновления профиля (без any)
type ProfileUpdate = Database['public']['Tables']['profiles']['Update']
type ProfileInsert = Database['public']['Tables']['profiles']['Insert']

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

async function getAuthUserEmailById(supabase: SupabaseAdmin, userId: string) {
  const { data, error } = await supabase.auth.admin.getUserById(userId)

  if (error) {
    throw new Error(`[webhook] Ошибка получения пользователя auth.users по id ${userId}: ${error.message}`)
  }

  const authEmail = data.user?.email
  if (!authEmail) {
    throw new Error(`[webhook] Не найден email пользователя auth.users для id ${userId}`)
  }

  return authEmail
}

async function upsertProfileByUserId(
  supabase: SupabaseAdmin,
  userId: string,
  updateData: ProfileUpdate
) {
  const authEmail = await getAuthUserEmailById(supabase, userId)
  const { error: upsertError } = await supabase
    .from('profiles')
    .upsert(
      { id: userId, email: authEmail, ...updateData } as ProfileInsert,
      { onConflict: 'id' }
    )

  if (upsertError) {
    const { data: updatedProfiles, error: retryError } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', userId)
      .select('id')

    if (retryError) {
      throw new Error(
        `[webhook] Ошибка сохранения профиля для userId ${userId}: ${upsertError.message} → ${retryError.message}`
      )
    }

    if (!updatedProfiles || updatedProfiles.length === 0) {
      throw new Error(
        `[webhook] Профиль для userId ${userId} не был сохранён после upsert retry: ${upsertError.message}`
      )
    }
  }
}

async function findSubscriptionLineItem(invoice: Stripe.Invoice) {
  const initialLine = invoice.lines?.data?.find(
    (line) => (line as unknown as { type?: string }).type === 'subscription'
  )

  if (!initialLine && invoice.lines?.has_more && invoice.id) {
    console.warn(
      '[webhook] invoice.payment_succeeded: subscription line item не найден на первой странице, current_period_end будет пропущен:',
      invoice.id
    )
  }

  return initialLine ?? null
}

// Task 3.1: checkout.session.completed
// Привязываем stripe_customer_id / stripe_subscription_id к профилю пользователя.
// Fix [AI-Review][Critical] Round 16: приоритет привязки:
//   0) По client_reference_id (userId, заданный нашим сервером при создании сессии) — самый надёжный
//   1) По stripe_customer_id (идемпотентно при retry после первой привязки)
//   2) По email через Postgres RPC (только если нет client_reference_id)
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

  // Fix [AI-Review][High] Round 13: формируем updateData динамически.
  // Если customerId или subscriptionId отсутствуют — НЕ включаем ключ в объект обновления.
  // Иначе запись null перезаписывает ранее сохранённые данные (потеря stripe_customer_id / stripe_subscription_id).
  // Fix [AI-Review][High] Round 14: IDs записываются независимо от payment_status.
  // Прежний ранний выход при payment_status != 'paid' блокировал запись IDs в профиль.
  // Без IDs последующий invoice.payment_succeeded не находил пользователя по customer_id → утечка подписки.
  // Теперь: IDs всегда записываются; subscription_status = 'active' — только при подтверждённой оплате.
  const updateData: ProfileUpdate = {}
  if (customerId) updateData.stripe_customer_id = customerId
  if (subscriptionId) updateData.stripe_subscription_id = subscriptionId

  // Fix [AI-Review][Critical] Round 12: утечка выручки — активируем подписку только при фактической оплате.
  // Stripe может вызвать checkout.session.completed до получения оплаты (payment_status = 'unpaid')
  // в случае банковских переводов, 3DS pending и т.п. IDs привязываем всегда, active — только при paid.
  const paymentStatus = session.payment_status
  if (paymentStatus === 'paid' || paymentStatus === 'no_payment_required') {
    updateData.subscription_status = 'active'
  } else {
    console.log(
      '[webhook] checkout.session.completed: привязываем IDs без активации, payment_status:',
      paymentStatus
    )
  }

  // Нечего обновлять (нет IDs и не оплачено)
  if (Object.keys(updateData).length === 0) {
    console.warn('[webhook] checkout.session.completed: нет данных для обновления')
    return
  }

  // Шаг 0: client_reference_id — прямая привязка по userId (наиболее безопасный метод).
  // Fix [AI-Review][Critical] Round 16: customer_details.email задаётся пользователем в Stripe —
  // злоумышленник может ввести чужой email для захвата аккаунта (Account Takeover).
  // client_reference_id устанавливается нашим сервером при создании Stripe сессии (Story 1.4),
  // поэтому ему можно доверять как идентификатору пользователя.
  const clientReferenceId = session.client_reference_id
  if (clientReferenceId) {
    const { data: updatedById, error: updateByIdError } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', clientReferenceId)
      .select('id')

    if (updateByIdError) {
      throw new Error(
        `[webhook] Ошибка обновления профиля (checkout.completed via client_reference_id): ${updateByIdError.message}`
      )
    }

    if (!updatedById || updatedById.length === 0) {
      // Триггер на auth.users ещё не создал профиль — сохраняем данные Stripe через upsert.
      await upsertProfileByUserId(supabase, clientReferenceId, updateData)
    }
    return
  }

  // Без client_reference_id — email обязателен для шагов 1 и 2
  if (!email) {
    console.error('[webhook] checkout.session.completed: отсутствует email клиента и client_reference_id')
    return
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
    // Fix [AI-Review][Medium] Round 14: триггер на auth.users мог не успеть создать запись в profiles.
    // .update() нашёл 0 строк — пробуем upsert чтобы не потерять данные Stripe.
    console.warn(
      `[webhook] checkout.session.completed: профиль не найден для userId ${userId} (email: ${email}). Пробуем upsert.`
    )
    await upsertProfileByUserId(supabase, userId, updateData)
  }
}

// Task 3.2: invoice.payment_succeeded
// Продлеваем/обновляем current_period_end и подтверждаем active-статус.
// В Stripe API 2026: subscription ID лежит в invoice.parent.subscription_details.subscription
// Fix [AI-Review][High]: двухшаговый подход вместо OR-фильтра.
//   OR-фильтр мог перезаписывать данные новой подписки старыми инвойсами.
//   Шаг 1: строгое обновление по subscription_id (primary key)
//   Шаг 2: fallback по customer_id — при повторной подписке профиль имеет старый sub_id (не null),
//     поэтому guard расширен: IS NULL ИЛИ NEQ нового subscriptionId (RE-SUBSCRIPTION FIX Round 9).
// Fix [AI-Review][Medium] Round 6: ранний выход если шаг 1 нашёл строку — избегаем двойного обновления
async function handleInvoicePaymentSucceeded(
  invoice: Stripe.Invoice,
  supabase: SupabaseAdmin
) {
  const subRef = invoice.parent?.subscription_details?.subscription
  const subscriptionId = typeof subRef === 'string' ? subRef : subRef?.id
  const customerId =
    typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id ?? null

  // Fix [AI-Review][High] Round 12: повышение привилегий через разовые инвойсы.
  // Если invoice не привязан к подписке (subscriptionId отсутствует), активировать подписку нельзя:
  // разовый платёж (one-time purchase) не даёт права на recurring subscription.
  // Без этой проверки неактивный пользователь мог оплатить разовый товар и получить active статус.
  if (!subscriptionId) return

  if (invoice.status !== 'paid') return

  // Fix [AI-Review][Medium] Round 5: ищем строку с type==='subscription' для точного period_end.
  // type отсутствует в Stripe TypeScript типах для API 2026-02-25.clover — используем type cast.
  // Fix [AI-Review][Medium] Round 16: убираем fallback на первую строку инвойса.
  // Fallback мог использовать period_end разовой позиции (invoiceitem) как дату окончания подписки,
  // что приводит к ложному current_period_end в БД. Если нет subscription-строки — не устанавливаем дату.
  const subscriptionLine = await findSubscriptionLineItem(invoice)
  const periodEndTs = subscriptionLine?.period?.end
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

  // Шаг 2: fallback по stripe_customer_id.
  // Fix [AI-Review][High] Round 9 (RE-SUBSCRIPTION): если invoice.payment_succeeded пришёл
  //   до checkout.session.completed при переподписке, профиль может иметь старый sub_id (не null).
  // Fix [AI-Review][Critical] Round 11: включаем stripe_subscription_id чтобы устранить
  //   Leaked State при переподписке (False Cancellation).
  // Fix [AI-Review][High] Round 16: заменяем строковую интерполяцию в .or() на два отдельных запроса.
  //   Строковая конкатенация в PostgREST фильтрах потенциально небезопасна; типобезопасные методы
  //   SDK (.is(), .neq()) передают значения корректно без риска нарушения синтаксиса фильтра.
  //   Шаг 2a: профили без sub_id (первая подписка / checkout задержан)
  //   Шаг 2b: профили со старым sub_id (переподписка, sub_old != sub_new)
  if (customerId) {
    const fallbackUpdate: ProfileUpdate = { subscription_status: 'active' }
    if (currentPeriodEnd) fallbackUpdate.current_period_end = currentPeriodEnd
    if (subscriptionId) fallbackUpdate.stripe_subscription_id = subscriptionId

    // Шаг 2a: профили без sub_id
    const { error: fallbackError1 } = await supabase
      .from('profiles')
      .update(fallbackUpdate)
      .eq('stripe_customer_id', customerId)
      .is('stripe_subscription_id', null)

    if (fallbackError1) {
      throw new Error(
        `[webhook] Ошибка обновления профиля (invoice.payment_succeeded fallback-null): ${fallbackError1.message}`
      )
    }

    // Шаг 2b: профили со старым subscription_id (переподписка)
    if (subscriptionId) {
      const { error: fallbackError2 } = await supabase
        .from('profiles')
        .update(fallbackUpdate)
        .eq('stripe_customer_id', customerId)
        .neq('stripe_subscription_id', subscriptionId)

      if (fallbackError2) {
        throw new Error(
          `[webhook] Ошибка обновления профиля (invoice.payment_succeeded fallback-neq): ${fallbackError2.message}`
        )
      }
    }
  }
}

// Task 3.3: customer.subscription.deleted
// Переводим пользователя в inactive.
// [AI-Review][High] Fix: двухшаговый подход вместо OR:
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

  // Fix [AI-Review][Medium] Round 10: сбрасываем current_period_end при удалении подписки.
  //   Оставлять дату окончания периода при deleted подписке → Leaked State:
  //   UI может показывать "подписка до XX.XX.XXXX" для уже удалённого аккаунта.
  const deletedUpdate = {
    subscription_status: 'inactive' as const,
    current_period_end: null,
    stripe_subscription_id: null,
  }

  // Шаг 1: строгое обновление по stripe_subscription_id
  const { data: updatedBySub, error } = await supabase
    .from('profiles')
    .update(deletedUpdate)
    .eq('stripe_subscription_id', subscription.id)
    .select('id')

  if (error) {
    throw new Error(
      `[webhook] Ошибка обновления профиля (subscription.deleted via subscription_id): ${error.message}`
    )
  }

  // Ранний выход если строка найдена — избегаем двойного обновления
  if (updatedBySub && updatedBySub.length > 0) return

  // Шаг 2: fallback по stripe_customer_id.
  // Fix [AI-Review][Critical] Round 15: EQ guard (IS NULL OR EQ sub_id) вместо strict IS NULL.
  // IS NULL был слишком строг — отмена sub_old не могла достичь профиля с sub_old,
  // если Step 1 промахнулся (network glitch). EQ guard безопасен: sub_new != sub_old.
  // Fix [AI-Review][High] Round 16: два отдельных запроса вместо .or() строковой интерполяции.
  if (customerId) {
    // Шаг 2a: профили без sub_id
    const { error: fallbackError1 } = await supabase
      .from('profiles')
      .update(deletedUpdate)
      .eq('stripe_customer_id', customerId)
      .is('stripe_subscription_id', null)

    if (fallbackError1) {
      throw new Error(
        `[webhook] Ошибка обновления профиля (subscription.deleted fallback-null): ${fallbackError1.message}`
      )
    }

    // Шаг 2b: профили именно с этим subscription_id
    const { error: fallbackError2 } = await supabase
      .from('profiles')
      .update(deletedUpdate)
      .eq('stripe_customer_id', customerId)
      .eq('stripe_subscription_id', subscription.id)

    if (fallbackError2) {
      throw new Error(
        `[webhook] Ошибка обновления профиля (subscription.deleted fallback-eq): ${fallbackError2.message}`
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

  // cancel_at — когда подписка реально закончится (если cancel_at_period_end=true).
  // Fix [AI-Review][Medium] Round 11: при апгрейде тарифа cancel_at = null (не отменяется),
  // поэтому дата окончания периода не обновлялась → Stale current_period_end в БД.
  // Используем subscription.current_period_end как fallback (поле есть в Stripe API ответе,
  // но отсутствует в TypeScript типах 2026-02-25.clover → type cast).
  const cancelAt = subscription.cancel_at
  const rawCurrentPeriodEnd = (subscription as unknown as { current_period_end?: number }).current_period_end
  const periodEndTs = cancelAt ?? rawCurrentPeriodEnd
  const periodEnd = periodEndTs ? new Date(periodEndTs * 1000).toISOString() : null

  // Fix [AI-Review][Medium] Round 15: сохраняем 'trialing' в БД как есть,
  // а не перезаписываем в 'active'. Middleware уже поддерживает whitelist active/trialing.
  // Хранение точного статуса синхронизирует модель данных с Stripe и позволяет
  // UI различать trial и полную подписку.
  let status: 'active' | 'inactive' | 'canceled' | 'trialing'
  if (subscription.status === 'active') {
    status = 'active'
  } else if (subscription.status === 'trialing') {
    status = 'trialing'
  } else if (subscription.status === 'canceled') {
    status = 'canceled'
  } else {
    status = 'inactive'
  }

  const update: ProfileUpdate = { subscription_status: status }
  if (periodEnd) {
    update.current_period_end = periodEnd
  }
  // Устанавливаем subscription_id если ещё не записан (handles late event binding)
  if (subscription.id) {
    update.stripe_subscription_id = subscription.id
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

  // Шаг 2: fallback по stripe_customer_id.
  // Fix [AI-Review][Critical] Round 15: EQ guard (IS NULL OR EQ sub_id) вместо strict IS NULL.
  // Fix [AI-Review][High] Round 16: два отдельных запроса вместо .or() строковой интерполяции.
  if (customerId) {
    // Шаг 2a: профили без sub_id
    const { error: fallbackError1 } = await supabase
      .from('profiles')
      .update(update)
      .eq('stripe_customer_id', customerId)
      .is('stripe_subscription_id', null)

    if (fallbackError1) {
      throw new Error(
        `[webhook] Ошибка обновления профиля (subscription.updated fallback-null): ${fallbackError1.message}`
      )
    }

    // Шаг 2b: профили именно с этим subscription_id
    const { error: fallbackError2 } = await supabase
      .from('profiles')
      .update(update)
      .eq('stripe_customer_id', customerId)
      .eq('stripe_subscription_id', subscription.id)

    if (fallbackError2) {
      throw new Error(
        `[webhook] Ошибка обновления профиля (subscription.updated fallback-eq): ${fallbackError2.message}`
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
// Fix [AI-Review][Low] Round 12: поток управления максимально явный:
//   Шаг 1: если есть subscriptionId — обновляем по нёму, при успехе выходим.
//   Шаг 2: fallback по customerId (только если subscriptionId нет в профиле, т.е. через race condition).
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
  // Fix [AI-Review][High] Round 10: убран guard на current_period_end.
  //   Stripe отправляет payment_failed в течение grace period — до истечения period_end.
  //   Прежний guard (.or(period_end.is.null, period_end.lte.now)) блокировал обработку
  //   актуальных неуплат, так как period_end в этот момент ещё в будущем.
  //   Сторонние эффекты (stale webhooks) приемлемы: subscription.deleted приходит следом
  //   и подтверждает inactive статус финально.
  if (subscriptionId) {
    const { data: updatedBySub, error } = await supabase
      .from('profiles')
      .update(failedUpdate)
      .eq('stripe_subscription_id', subscriptionId)
      .select('id')

    if (error) {
      throw new Error(
        `[webhook] Ошибка обновления профиля (invoice.payment_failed via subscription_id): ${error.message}`
      )
    }

    if (updatedBySub && updatedBySub.length > 0) return
  }

  // Шаг 2: fallback по stripe_customer_id.
  // Fix [AI-Review][Critical] Round 15: EQ guard (IS NULL OR EQ sub_id) при наличии subscriptionId.
  // Fix [AI-Review][High] Round 16: два отдельных запроса вместо .or() строковой интерполяции.
  //   Шаг 2a: профили без sub_id (checkout задержан)
  //   Шаг 2b: профили именно с этим sub_id (EQ guard — не затрагивает профили с sub_new)
  if (customerId) {
    // Шаг 2a: профили без sub_id
    const { error: fallbackError1 } = await supabase
      .from('profiles')
      .update(failedUpdate)
      .eq('stripe_customer_id', customerId)
      .is('stripe_subscription_id', null)

    if (fallbackError1) {
      throw new Error(
        `[webhook] Ошибка обновления профиля (invoice.payment_failed fallback-null): ${fallbackError1.message}`
      )
    }

    // Шаг 2b: профили именно с этим subscription_id
    if (subscriptionId) {
      const { error: fallbackError2 } = await supabase
        .from('profiles')
        .update(failedUpdate)
        .eq('stripe_customer_id', customerId)
        .eq('stripe_subscription_id', subscriptionId)

      if (fallbackError2) {
        throw new Error(
          `[webhook] Ошибка обновления профиля (invoice.payment_failed fallback-eq): ${fallbackError2.message}`
        )
      }
    }
  }
}

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!webhookSecret) {
    console.error('[webhook] STRIPE_WEBHOOK_SECRET не настроен')
    return NextResponse.json({ error: 'Конфигурация webhook недоступна' }, { status: 500 })
  }

  const now = Date.now()
  const rateLimitState = consumeStripeWebhookRateLimit(
    getStripeWebhookRateLimitKey(request),
    now
  )

  if (!rateLimitState.allowed) {
    const retryAfter = Math.max(1, Math.ceil((rateLimitState.resetAt - now) / 1000))
    return NextResponse.json(
      { error: 'Слишком много запросов к webhook' },
      {
        status: 429,
        headers: {
          'Retry-After': retryAfter.toString(),
        },
      }
    )
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
