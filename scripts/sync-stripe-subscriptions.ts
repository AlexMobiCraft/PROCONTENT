/**
 * Скрипт синхронизации существующих Stripe-клиентов с профилями Supabase.
 *
 * Алгоритм:
 * 1. Получает все активные подписки из Stripe
 * 2. Для каждой подписки находит профиль в Supabase по email клиента
 * 3. Обновляет stripe_customer_id, stripe_subscription_id, subscription_status, current_period_end
 *
 * Запуск:
 *   npx tsx scripts/sync-stripe-subscriptions.ts
 *   npx tsx scripts/sync-stripe-subscriptions.ts --dry-run   (только просмотр, без записи)
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
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

type Result = {
  email: string
  status: 'updated' | 'not_found' | 'skipped' | 'error'
  reason?: string
  stripe_customer_id?: string
  subscription_status?: string
}

async function run() {
  console.log(DRY_RUN ? '=== DRY RUN — изменения не сохраняются ===\n' : '=== Синхронизация Stripe → Supabase ===\n')

  const results: Result[] = []

  // Получаем все подписки из Stripe (все статусы кроме draft)
  const subscriptions = await stripe.subscriptions.list({
    limit: 100,
    expand: ['data.customer'],
  })

  console.log(`Найдено подписок в Stripe: ${subscriptions.data.length}\n`)

  for (const sub of subscriptions.data) {
    const customer = sub.customer as Stripe.Customer

    // Удалённые клиенты — пропускаем
    if (customer.deleted) {
      results.push({ email: customer.id, status: 'skipped', reason: 'customer deleted' })
      continue
    }

    const email = customer.email
    if (!email) {
      results.push({ email: customer.id, status: 'skipped', reason: 'нет email у клиента' })
      continue
    }

    // Ищем профиль в Supabase по email
    const { data: profile, error: fetchError } = await supabase
      .from('profiles')
      .select('id, email, stripe_customer_id, subscription_status')
      .eq('email', email)
      .maybeSingle()

    if (fetchError) {
      results.push({ email, status: 'error', reason: fetchError.message })
      continue
    }

    if (!profile) {
      results.push({ email, status: 'not_found', reason: 'профиль не найден в Supabase' })
      continue
    }

    const updateData = {
      stripe_customer_id: customer.id,
      stripe_subscription_id: sub.id,
      subscription_status: sub.status,
      current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
    }

    if (!DRY_RUN) {
      const { error: updateError } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', profile.id)

      if (updateError) {
        results.push({ email, status: 'error', reason: updateError.message })
        continue
      }
    }

    results.push({
      email,
      status: 'updated',
      stripe_customer_id: customer.id,
      subscription_status: sub.status,
    })
  }

  // Итоговый отчёт
  console.log('─'.repeat(60))
  console.log('РЕЗУЛЬТАТ:\n')

  const updated = results.filter((r) => r.status === 'updated')
  const notFound = results.filter((r) => r.status === 'not_found')
  const skipped = results.filter((r) => r.status === 'skipped')
  const errors = results.filter((r) => r.status === 'error')

  if (updated.length) {
    console.log(`✓ Обновлено (${updated.length}):`)
    updated.forEach((r) => console.log(`  ${r.email}  →  ${r.stripe_customer_id}  [${r.subscription_status}]`))
  }

  if (notFound.length) {
    console.log(`\n? Не найдены в Supabase (${notFound.length}):`)
    notFound.forEach((r) => console.log(`  ${r.email}`))
    console.log('  → Эти клиенты есть в Stripe, но нет в БД. Возможно, не зарегистрировались на сайте.')
  }

  if (skipped.length) {
    console.log(`\n– Пропущено (${skipped.length}):`)
    skipped.forEach((r) => console.log(`  ${r.email ?? r.email}  (${r.reason})`))
  }

  if (errors.length) {
    console.log(`\n✗ Ошибки (${errors.length}):`)
    errors.forEach((r) => console.log(`  ${r.email}: ${r.reason}`))
  }

  console.log('\n─'.repeat(60))
  console.log(`Итого: ${updated.length} обновлено, ${notFound.length} не найдено, ${errors.length} ошибок`)

  if (DRY_RUN) {
    console.log('\nЗапусти без --dry-run чтобы применить изменения.')
  }
}

run().catch((err) => {
  console.error('Критическая ошибка:', err)
  process.exit(1)
})
