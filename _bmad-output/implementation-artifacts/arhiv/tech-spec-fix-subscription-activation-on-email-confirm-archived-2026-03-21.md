---
title: 'Исправить баг: subscription_status не активируется после подтверждения email'
slug: 'fix-subscription-activation-on-email-confirm'
created: '2026-03-15'
status: 'completed'
stepsCompleted: [1, 2, 3, 4]
tech_stack: ['Next.js 16', 'Supabase SSR', '@supabase/ssr', 'Stripe 2026-02-25.clover', 'TypeScript', 'PostgreSQL RLS']
files_to_modify:
  - 'src/app/auth/confirm/route.ts → MODIFY'
  - 'supabase/migrations/004_fix_subscription_status_check.sql → CREATE'
code_patterns:
  - 'createAdminClient() из src/app/api/webhooks/stripe/route.ts (service role key, обходит RLS)'
  - 'null-guard для current_period_end: periodEndTs ? new Date(periodEndTs * 1000).toISOString() : null'
  - 'NextResponse.redirect + response.cookies pattern в Route Handlers'
test_patterns: []
---

# Tech-Spec: Исправить баг: subscription_status не активируется после подтверждения email

**Создан:** 2026-03-15

## Overview

### Problem Statement

После оплаты через Stripe → регистрации → подтверждения email по ссылке пользователь попадает на `/inactive`.
В таблице `profiles` поле `subscription_status` остаётся `null` (не становится `active`).

**Корневая причина установлена через исследование кода:**

Флоу после оплаты:
1. `checkout.session.completed` webhook → пользователь ещё не существует в Supabase → webhook логирует "Ожидание Story 1.7" и **выходит без активации**
2. Пользователь регистрируется → `auth.users` INSERT → trigger создаёт `profiles` строку с `subscription_status = null`
3. Пользователь подтверждает email → `auth/confirm` route запускает "Story 1.7" Stripe-проверку:
   - Stripe customer найден ✅
   - Активная подписка найдена ✅
   - **ПАДАЕТ с `RangeError`** при построении объекта update:
     ```typescript
     current_period_end: new Date((sub as any).current_period_end * 1000).toISOString()
     // sub.current_period_end → undefined (API 2026-02-25.clover)
     // undefined * 1000 → NaN
     // new Date(NaN).toISOString() → бросает RangeError: Invalid time value
     ```
   - Исключение поглощается внешним `catch (e)` → логируется → `profiles.update` **никогда не выполняется**
4. Редирект на `/feed` → middleware видит `subscription_status = null` → редирект на `/inactive`

### Solution

Три точечных исправления в `src/app/auth/confirm/route.ts` + одна новая SQL-миграция:

1. **Fix null-guard для `current_period_end`** — как в webhook handler
2. **Заменить anon-клиент на admin-клиент** (service role) для записи `subscription_status`
3. **Удалить мёртвый код** — неиспользуемый вызов `stripe.subscriptions.list({ customer: undefined })`
4. **Новая миграция** — добавить `'trialing'` в CHECK constraint `subscription_status`

### Scope

**In Scope:**
- `src/app/auth/confirm/route.ts` — три исправления (null-guard, admin client, dead code)
- `supabase/migrations/004_fix_subscription_status_check.sql` — новая миграция

**Out of Scope:**
- Рефакторинг структуры `auth/confirm` route
- Изменение email-шаблонов в Supabase Dashboard
- Переработка webhook логики
- Добавление тестов (нет test runner)

---

## Context for Development

### Codebase Patterns

- **Admin client pattern** — `createAdminClient()` определён в `src/app/api/webhooks/stripe/route.ts:18-27`. Использует `createClient<Database>(url, SUPABASE_SERVICE_ROLE_KEY)` из `@supabase/supabase-js` (НЕ `@supabase/ssr`). Обходит RLS. Этот паттерн нужно воспроизвести в `auth/confirm`.
- **null-guard для period_end** — webhook handler (`handleSubscriptionUpdated`, строки 503-506): `const periodEndTs = cancelAt ?? rawCurrentPeriodEnd; const periodEnd = periodEndTs ? new Date(periodEndTs * 1000).toISOString() : null`. Тот же паттерн нужен в `auth/confirm`.
- **Stripe API `2026-02-25.clover`** — `current_period_end` присутствует в ответе API, но ОТСУТСТВУЕТ в TypeScript типах → нужен type cast `(sub as unknown as { current_period_end?: number }).current_period_end`.

### Ключевые файлы

| Файл | Роль |
|------|------|
| `src/app/auth/confirm/route.ts` | Route с багом — Story 1.7 Stripe-проверка (строки 60–107) |
| `src/app/api/webhooks/stripe/route.ts:18-27` | Источник `createAdminClient()` паттерна |
| `src/app/api/webhooks/stripe/route.ts:503-506` | Источник null-guard паттерна для `current_period_end` |
| `supabase/migrations/001_create_profiles.sql` | Trigger + RLS политики |
| `supabase/migrations/002_add_subscription_fields.sql` | CHECK constraint (нужно исправить) |
| `src/lib/app-routes.ts` | `getAuthSuccessRedirectPath()` → `/feed` |

### Технические решения

- `createAdminClient` нужно объявить локально в `auth/confirm/route.ts` (не импортировать из webhook — это был бы плохой coupling). Паттерн идентичный: `createClient<Database>(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)`.
- После update через admin-клиент getUser() по-прежнему использует anon-клиент (это правильно — только запись профиля требует admin).
- `'trialing'` надо добавить в CHECK constraint через `ALTER TABLE ... DROP CONSTRAINT ... / ADD CONSTRAINT`.

---

## Implementation Plan

### Tasks

**Task 1: Добавить `createAdminClient` в `auth/confirm/route.ts`**

Файл: `src/app/auth/confirm/route.ts`

Добавить импорт `createClient` из `@supabase/supabase-js` и локальную функцию:

```typescript
import { createClient } from '@supabase/supabase-js'
// ... (рядом с существующими импортами)

function createAdminSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('[auth/confirm] Missing Supabase admin env vars')
  return createClient<Database>(url, key)
}
```

**Task 2: Удалить мёртвый код (строки 66–71)**

Удалить:
```typescript
const subscriptions = await stripe.subscriptions.list({
  customer: undefined, // ищем по email через поиск клиентов (ниже)
  status: 'active',
  limit: 10,
})
```
Этот вызов не используется — `subscriptions` переменная нигде не читается.

**Task 3: Исправить null-guard для `current_period_end` + заменить клиент**

Найти блок (строки 87–100):
```typescript
if (activeSubs.data.length > 0) {
  const sub = activeSubs.data[0]
  await supabase                          // ← anon клиент
    .from('profiles')
    .update({
      subscription_status: 'active',
      stripe_customer_id: customerId,
      stripe_subscription_id: sub.id,
      current_period_end: new Date((sub as any).current_period_end * 1000).toISOString()  // ← БАГИ
    })
    .eq('id', user.id)
}
```

Заменить на:
```typescript
if (activeSubs.data.length > 0) {
  const sub = activeSubs.data[0]
  const rawPeriodEnd = (sub as unknown as { current_period_end?: number }).current_period_end
  const currentPeriodEnd = rawPeriodEnd ? new Date(rawPeriodEnd * 1000).toISOString() : null

  const adminSupabase = createAdminSupabaseClient()   // ← admin клиент
  const { error: updateError } = await adminSupabase
    .from('profiles')
    .update({
      subscription_status: 'active',
      stripe_customer_id: customerId,
      stripe_subscription_id: sub.id,
      ...(currentPeriodEnd && { current_period_end: currentPeriodEnd }),
    })
    .eq('id', user.id)

  if (updateError) {
    console.error('[auth/confirm] Ошибка обновления профиля:', updateError.message)
  }
}
```

**Task 4: Создать миграцию `004_fix_subscription_status_check.sql`**

Файл: `supabase/migrations/004_fix_subscription_status_check.sql`

```sql
-- Migration: 004_fix_subscription_status_check.sql
-- Добавить 'trialing' в CHECK constraint subscription_status
-- Причина: webhook и middleware используют 'trialing', но старый constraint его не разрешает

alter table public.profiles
  drop constraint if exists profiles_subscription_status_check;

alter table public.profiles
  add constraint profiles_subscription_status_check
  check (subscription_status in ('active', 'inactive', 'canceled', 'trialing'));
```

### Acceptance Criteria

**AC1 — Корневой баг исправлен:**
- Given: пользователь оплатил Stripe подписку, затем зарегистрировался и подтвердил email
- When: переходит по ссылке из письма подтверждения
- Then: `profiles.subscription_status = 'active'`, редирект на `/feed` (не `/inactive`)

**AC2 — null-guard работает:**
- Given: Stripe API не вернул `current_period_end` в объекте subscription
- When: `auth/confirm` выполняет update
- Then: update проходит успешно с `current_period_end = null` (не бросает исключение)

**AC3 — Ошибки апдейта видны в логах:**
- Given: admin client update завершился с ошибкой
- When: проверяем серверные логи
- Then: `[auth/confirm] Ошибка обновления профиля: <message>` присутствует в логах

**AC4 — Мёртвый код удалён:**
- Given: `auth/confirm` route
- When: смотрим код
- Then: `stripe.subscriptions.list({ customer: undefined })` отсутствует

**AC5 — CHECK constraint включает 'trialing':**
- Given: применена миграция 004
- When: webhook пытается записать `subscription_status = 'trialing'`
- Then: запись проходит без ошибок constraint violation

---

## Additional Context

### Dependencies

- `SUPABASE_SERVICE_ROLE_KEY` — env var уже используется в webhook, должен быть в Vercel env vars
- `@supabase/supabase-js` — уже установлен (используется в webhook)
- Нет новых зависимостей

### Testing Strategy

Ручное тестирование (нет test runner):
1. Создать тестового пользователя через Stripe checkout
2. Пройти полный флоу: оплата → регистрация → подтверждение email
3. Проверить в Supabase Dashboard: `profiles.subscription_status = 'active'`
4. Убедиться что редирект ведёт на `/feed`

### Notes

**Подтверждённые факты (от Alex, 2026-03-15):**
- Email-шаблон использует `{{ .ConfirmationURL }}` → PKCE/code flow → `/auth/confirm?code=XXXX` → ветка `exchangeCodeForSession(code)`
- Профиль в `profiles` создаётся trigger'ом сразу при `signUp` с `subscription_status = null` ✅
- Email в Stripe совпадает с email в Supabase ✅
- Тип — `signup` (верификация email нового пользователя) ✅

**Вывод:** Route `auth/confirm` выполняется, сессия создаётся успешно. `getUser()` возвращает пользователя. Stripe customer и активная подписка находятся. Падает именно при построении объекта для `update` — `RangeError` от `new Date(NaN)`.

- Причина бага в `auth/confirm` никогда не всплывала т.к. `catch (e)` только логирует, не перебрасывает — ошибка была невидима в UI
- Webhook правильно обрабатывает этот кейс (`Ожидание Story 1.7`) — Story 1.7 = этот же `auth/confirm` fallback
- Ожидаемое поведение после фикса: webhook по-прежнему не находит юзера при первом запуске, `auth/confirm` успешно активирует профиль при подтверждении email
- Если `SUPABASE_SERVICE_ROLE_KEY` не настроен на Vercel — `createAdminSupabaseClient()` бросит ошибку, которая будет поймана внешним `catch` в `auth/confirm`. Нужно убедиться что env var настроен.
