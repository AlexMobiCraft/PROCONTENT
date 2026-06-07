/**
 * Скрипт миграции существующих Stripe-клиентов в Supabase (ФАЗА 1).
 *
 * Что делает:
 * 1. Получает все подписки из Stripe (с раскрытием клиента и плана).
 * 2. Для каждой подписки ищет профиль в Supabase по email.
 * 3. Если профиля нет — создаёт пользователя в Supabase Auth с уже
 *    подтверждённым email (email_confirm: true, БЕЗ отправки письма).
 *    Триггер on_auth_user_created автоматически заводит строку в profiles.
 * 4. Привязывает Stripe-данные к профилю:
 *    stripe_customer_id, stripe_subscription_id, subscription_status, current_period_end.
 *
 * Письма клиентам на этом этапе НЕ отправляются — это отдельная фаза 2
 * (рассылка recovery-ссылок на установку пароля) после ручной проверки БД.
 *
 * Запуск:
 *   npx tsx scripts/sync-stripe-subscriptions.ts --dry-run   (просмотр, без записи)
 *   npx tsx scripts/sync-stripe-subscriptions.ts             (применить изменения)
 */

import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const DRY_RUN = process.argv.includes('--dry-run')

// Проверка переменных окружения
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!STRIPE_SECRET_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Ошибка: не заданы переменные окружения.')
  console.error('Нужны: STRIPE_SECRET_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const stripe = new Stripe(STRIPE_SECRET_KEY)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

type Result = {
  email: string
  status: 'created' | 'updated' | 'skipped' | 'error'
  name: string
  plan: string
  subscription_status: string
  current_period_end: string
  stripe_customer_id?: string
  reason?: string
}

// Разбирает customer.name из Stripe на first_name / last_name.
// В Stripe имена приходят с техническим суффиксом " (id1234567)" — срезаем его.
// Возвращаем undefined для коротких/пустых значений, чтобы триггер БД применил
// собственный fallback (валидное имя из email).
function parseStripeName(raw: string | null | undefined): {
  first_name?: string
  last_name?: string
} {
  const cleaned = (raw ?? '').replace(/\s*\(id\d+\)\s*$/i, '').trim()
  if (!cleaned) return {}

  const parts = cleaned.split(/\s+/)
  const first = parts[0]
  const last = parts.length > 1 ? parts.slice(1).join(' ') : undefined

  // first_name должен пройти constraint (>= 3 символов) — иначе отдаём триггеру
  const result: { first_name?: string; last_name?: string } = {}
  if (first && first.trim().length >= 3) result.first_name = first
  if (last) result.last_name = last
  return result
}

// Кэш имён продуктов, чтобы не дёргать Stripe повторно по одному productId
const productNameCache = new Map<string, string>()

async function resolvePlanName(price: Stripe.Price | undefined): Promise<string> {
  if (!price) return '—'

  const productRef = price.product
  const productId = typeof productRef === 'string' ? productRef : productRef?.id

  if (productId) {
    if (productNameCache.has(productId)) return productNameCache.get(productId)!
    try {
      const product = await stripe.products.retrieve(productId)
      if (!product.deleted && product.name) {
        productNameCache.set(productId, product.name)
        return product.name
      }
    } catch {
      // не удалось получить продукт — упадём на запасные варианты ниже
    }
  }

  return price.nickname ?? price.id ?? '—'
}

async function run() {
  console.log(
    DRY_RUN
      ? '=== DRY RUN — изменения НЕ сохраняются, аккаунты НЕ создаются ===\n'
      : '=== Миграция Stripe → Supabase (создание аккаунтов + привязка) ===\n'
  )

  const results: Result[] = []

  // Получаем все подписки из Stripe. Раскрываем клиента и price.
  // (product не раскрываем — Stripe разрешает максимум 4 уровня expand,
  //  имя продукта подгружаем отдельно с кэшированием — см. resolvePlanName.)
  const subscriptions = await stripe.subscriptions.list({
    limit: 100,
    expand: ['data.customer', 'data.items.data.price'],
  })

  console.log(`Найдено подписок в Stripe: ${subscriptions.data.length}\n`)

  for (const sub of subscriptions.data) {
    const customer = sub.customer as Stripe.Customer

    // Удалённые клиенты — пропускаем
    if (customer.deleted) {
      results.push({
        email: customer.id,
        status: 'skipped',
        name: '—',
        plan: '—',
        subscription_status: sub.status,
        current_period_end: '—',
        reason: 'customer deleted',
      })
      continue
    }

    const email = customer.email
    if (!email) {
      results.push({
        email: customer.id,
        status: 'skipped',
        name: '—',
        plan: '—',
        subscription_status: sub.status,
        current_period_end: '—',
        reason: 'нет email у клиента',
      })
      continue
    }

    // Имя из Stripe (для отчёта и для записи в профиль при создании)
    const parsedName = parseStripeName(customer.name)
    const displayName =
      [parsedName.first_name, parsedName.last_name].filter(Boolean).join(' ') ||
      '(из email)'

    // Название плана из первого элемента подписки
    const item = sub.items.data[0]
    const plan = await resolvePlanName(item?.price)

    // В Stripe API 2025+ (SDK v18+) current_period_end перенесён в элементы
    // подписки. Берём максимальный период среди всех элементов.
    const periodEndUnix = sub.items.data.reduce(
      (max, it) => (it.current_period_end > max ? it.current_period_end : max),
      0
    )
    const periodEndIso = periodEndUnix ? new Date(periodEndUnix * 1000).toISOString() : null

    // Ищем профиль в Supabase по email
    const { data: profile, error: fetchError } = await supabase
      .from('profiles')
      .select('id, email, stripe_customer_id, subscription_status')
      .eq('email', email)
      .maybeSingle()

    if (fetchError) {
      results.push({
        email,
        status: 'error',
        name: displayName,
        plan,
        subscription_status: sub.status,
        current_period_end: periodEndIso ?? '—',
        reason: `поиск профиля: ${fetchError.message}`,
      })
      continue
    }

    let profileId = profile?.id ?? null
    const willCreate = !profile

    // Если профиля нет — создаём пользователя в Auth (триггер заведёт профиль)
    if (!profile && !DRY_RUN) {
      const { data: created, error: createError } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true, // email сразу подтверждён, письмо НЕ отправляется
        // имя из Stripe → триггер запишет в profiles (см. parsedName выше)
        user_metadata: { first_name: parsedName.first_name, last_name: parsedName.last_name },
      })

      if (createError || !created?.user) {
        results.push({
          email,
          status: 'error',
          name: displayName,
          plan,
          subscription_status: sub.status,
          current_period_end: periodEndIso ?? '—',
          reason: `создание аккаунта: ${createError?.message ?? 'нет user в ответе'}`,
        })
        continue
      }

      profileId = created.user.id
    }

    const updateData = {
      stripe_customer_id: customer.id,
      stripe_subscription_id: sub.id,
      subscription_status: sub.status,
      current_period_end: periodEndIso,
    }

    // Привязка Stripe-данных к профилю
    if (!DRY_RUN && profileId) {
      const { error: updateError } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', profileId)

      if (updateError) {
        results.push({
          email,
          status: 'error',
          name: displayName,
          plan,
          subscription_status: sub.status,
          current_period_end: periodEndIso ?? '—',
          reason: `привязка Stripe: ${updateError.message}`,
        })
        continue
      }
    }

    results.push({
      email,
      status: willCreate ? 'created' : 'updated',
      name: displayName,
      plan,
      subscription_status: sub.status,
      current_period_end: periodEndIso ?? '—',
      stripe_customer_id: customer.id,
    })
  }

  // Итоговый отчёт
  console.log('─'.repeat(70))
  console.log('РЕЗУЛЬТАТ:\n')

  const created = results.filter((r) => r.status === 'created')
  const updated = results.filter((r) => r.status === 'updated')
  const skipped = results.filter((r) => r.status === 'skipped')
  const errors = results.filter((r) => r.status === 'error')

  const printRow = (r: Result) =>
    console.log(
      `  ${r.email.padEnd(34)} | ${r.name.padEnd(22)} | ${r.plan.padEnd(12)} | ${r.subscription_status.padEnd(10)} | ${r.current_period_end}`
    )

  const header = `  ${'email'.padEnd(34)} | ${'имя'.padEnd(22)} | ${'план'.padEnd(12)} | ${'статус'.padEnd(10)} | период до`

  if (created.length) {
    console.log(`${DRY_RUN ? '◇ Будут созданы' : '✓ Созданы'} аккаунты (${created.length}):`)
    console.log(header)
    console.log('  ' + '─'.repeat(100))
    created.forEach(printRow)
  }

  if (updated.length) {
    console.log(`\n✓ Обновлены существующие профили (${updated.length}):`)
    updated.forEach(printRow)
  }

  if (skipped.length) {
    console.log(`\n– Пропущено (${skipped.length}):`)
    skipped.forEach((r) => console.log(`  ${r.email}  (${r.reason})`))
  }

  if (errors.length) {
    console.log(`\n✗ Ошибки (${errors.length}):`)
    errors.forEach((r) => console.log(`  ${r.email}: ${r.reason}`))
  }

  console.log('\n' + '─'.repeat(70))
  console.log(
    `Итого: ${created.length} ${DRY_RUN ? 'к созданию' : 'создано'}, ` +
      `${updated.length} обновлено, ${skipped.length} пропущено, ${errors.length} ошибок`
  )

  if (DRY_RUN) {
    console.log('\nЗапусти без --dry-run чтобы создать аккаунты и применить изменения.')
    console.log('Письма клиентам на этом этапе НЕ отправляются (это фаза 2).')
  } else {
    console.log('\nГотово. Проверь записи в БД, затем запусти рассылку писем (фаза 2).')
  }
}

run().catch((err) => {
  console.error('Критическая ошибка:', err)
  process.exit(1)
})
