# Stripe + Supabase Auth: флоу активации подписки (Next.js 16)

> Справочный документ на основе реального опыта внедрения.
> Описывает паттерны, ловушки и готовые решения для быстрого старта в новых проектах.

---

## Пользовательский путь к закрытой части сайта

```
Лендинг
  └─ Пользователь выбирает план подписки
       └─ Переход на Stripe Checkout (оплата)
            └─ Пользователь оплачивает
                 ├─ Stripe отправляет webhook checkout.session.completed
                 │    └─ Если пользователь уже зарегистрирован → активируем профиль сразу
                 │    └─ Если нет → выходим без ошибки, ждём подтверждения email
                 │
                 └─ Stripe редиректит на success_url → страница регистрации
                      └─ Пользователь регистрируется (email + пароль)
                           └─ Supabase отправляет письмо с подтверждением email
                                └─ Пользователь переходит по ссылке из письма
                                     └─ /auth/confirm: верифицирует email + находит подписку в Stripe
                                          └─ Активирует профиль (subscription_status = 'active')
                                               └─ Редирект в закрытую часть сайта (/feed)
```

**Ключевые моменты:**

- `success_url` в Stripe Checkout Session нужно явно указывать — Stripe не знает куда редиректить после оплаты. Обычно это страница регистрации или специальная onboarding-страница.
- Webhook и `/auth/confirm` — **два независимых механизма** активации подписки. Webhook срабатывает немедленно после оплаты, но пользователя в базе ещё может не быть. `/auth/confirm` — резервный путь, который гарантирует активацию при подтверждении email.
- Доступ в закрытую часть сайта защищён на уровне `proxy.ts`: каждый запрос проверяет `subscription_status` в `profiles`. Если статус не `active` и не `trialing` — редирект на страницу неактивной подписки.

---

## Архитектура флоу

Ключевая проблема: оплата в Stripe и регистрация в Supabase — это два **независимых и асинхронных** события. Пользователь может оплатить подписку до того, как создаст аккаунт, поэтому нельзя активировать профиль только в webhook — нужен второй механизм активации при подтверждении email.

```
1. Stripe Checkout (оплата)
   └─ checkout.session.completed webhook
        ├─ пользователь уже есть в auth.users → активируем профиль сразу
        └─ пользователя ещё нет → логируем, выходим без ошибки
           (активация произойдёт позже, при подтверждении email)

2. Регистрация (signUp)
   └─ Supabase trigger on_auth_user_created
        └─ INSERT в profiles (subscription_status = null)

3. Подтверждение email (переход по ссылке из письма)
   └─ /auth/confirm route
        ├─ PKCE flow: ?code=XXX → exchangeCodeForSession(code)
        └─ OTP flow:  ?token_hash=XXX&type=signup → verifyOtp(...)
             └─ После установки сессии: проверить Stripe по email пользователя
                  └─ найден customer + активная/trialing подписка
                       └─ обновить profiles: subscription_status, stripe IDs, current_period_end
```

Оба пути (webhook и `/auth/confirm`) должны уметь активировать профиль независимо друг от друга — какой сработает первым, тот и активирует. Второй должен быть идемпотентным (не перезаписывать уже активный статус).

---

## Реализация `/auth/confirm` route

Полный шаблон route handler с учётом всех описанных ниже ловушек:

```typescript
// src/app/auth/confirm/route.ts
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { type EmailOtpType } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

// Admin client обходит RLS — нужен для записи subscription_status
function createAdminSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(request: NextRequest) {
  // Env guard ОБЯЗАТЕЛЕН до любой логики — иначе ошибка поглотится catch ниже
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    console.error('[auth/confirm] Missing Supabase env vars')
    return NextResponse.redirect(new URL('/login?error=config', request.url))
  }

  const { searchParams } = request.nextUrl
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null

  const redirectUrl = request.nextUrl.clone()
  redirectUrl.pathname = '/feed'
  redirectUrl.search = ''

  const response = NextResponse.redirect(redirectUrl)

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) =>
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          ),
      },
    }
  )

  // 1. Подтверждаем email и устанавливаем сессию
  let verifyError = null
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    verifyError = error
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    verifyError = error
  } else {
    return NextResponse.redirect(new URL('/login?error=missing_params', request.url))
  }

  if (verifyError) {
    console.error('[auth/confirm] Ошибка верификации:', verifyError.message)
    return NextResponse.redirect(new URL('/login?error=verification_failed', request.url))
  }

  // 2. Получаем пользователя из только что установленной сессии
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return response

  // 3. Идемпотентность: пропускаем Stripe если подписка уже активна
  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_status')
    .eq('id', user.id)
    .single()

  if (profile?.subscription_status === 'active' || profile?.subscription_status === 'trialing') {
    return response
  }

  // 4. Ищем активную подписку в Stripe по email
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
    const customers = await stripe.customers.list({ email: user.email, limit: 1 })

    if (customers.data.length === 0) return response

    const customerId = customers.data[0].id

    // subscriptions.list не принимает массив статусов — два последовательных запроса
    let subs = await stripe.subscriptions.list({ customer: customerId, status: 'active', limit: 1 })
    if (subs.data.length === 0) {
      subs = await stripe.subscriptions.list({ customer: customerId, status: 'trialing', limit: 1 })
    }

    if (subs.data.length === 0) {
      // Customer найден, но подписки нет — сохраняем хотя бы customer ID
      await createAdminSupabaseClient()
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id)
      return response
    }

    const sub = subs.data[0]

    // current_period_end присутствует в ответе API но отсутствует в TypeScript типах
    const rawPeriodEnd = (sub as unknown as { current_period_end?: number }).current_period_end
    const currentPeriodEnd = rawPeriodEnd ? new Date(rawPeriodEnd * 1000).toISOString() : null

    const { error: updateError, count } = await createAdminSupabaseClient()
      .from('profiles')
      .update(
        {
          subscription_status: sub.status as 'active' | 'trialing',
          stripe_customer_id: customerId,
          stripe_subscription_id: sub.id,
          current_period_end: currentPeriodEnd,
        },
        { count: 'exact' }
      )
      .eq('id', user.id)

    if (updateError) {
      console.error('[auth/confirm] Ошибка обновления профиля:', updateError.message)
    } else if (count === 0) {
      console.error('[auth/confirm] Профиль не найден, user.id:', user.id)
    } else {
      console.log('[auth/confirm] Профиль активирован, user.id:', user.id)
    }
  } catch (e) {
    console.error('[auth/confirm] Ошибка Stripe lookup:', e)
  }

  return response
}
```

---

## Критические ловушки

### Ловушка 1: RangeError от `current_period_end`

Поле `current_period_end` **присутствует в ответе** Stripe API, но **отсутствует в TypeScript типах** — в зависимости от версии API и типа подписки может быть `undefined`.

**Опасный код (молча ломает активацию):**
```typescript
current_period_end: new Date((sub as any).current_period_end * 1000).toISOString()
// undefined * 1000 = NaN → new Date(NaN).toISOString() → RangeError
// RangeError поглощается catch → update не выполняется → subscription_status остаётся null
```

**Правильно:**
```typescript
const rawPeriodEnd = (sub as unknown as { current_period_end?: number }).current_period_end
const currentPeriodEnd = rawPeriodEnd ? new Date(rawPeriodEnd * 1000).toISOString() : null
```

### Ловушка 2: `trialing` подписка не находится при запросе `status: 'active'`

Stripe создаёт подписку в статусе `trialing` если в продукте настроен trial period. `subscriptions.list` не принимает массив статусов. Запрос только `active` вернёт пустой результат — профиль не активируется.

Решение — два последовательных запроса (см. шаблон выше).

### Ловушка 3: Одноразовый токен сгорает в proxy.ts

Supabase email confirmation использует одноразовый `code` (PKCE) или `token_hash`. Если `proxy.ts` вызовет `updateSession` до того, как `/auth/confirm` успеет обработать токен — он будет израсходован и верификация провалится.

**Обязательно пропускать `/auth/confirm` в proxy.ts:**
```typescript
export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/auth/confirm')) return
  return await updateSession(request)
}
```

### Ловушка 4: Env guard должен быть до `try/catch`

Если проверить env vars внутри блока `try` — ошибка об отсутствующем ключе будет поглощена `catch` и залогирована без редиректа, пользователь получит непредсказуемое поведение. Проверять в самом начале handler'а, до любой логики.

---

## Next.js 16: proxy.ts вместо middleware.ts

**Breaking change в Next.js 16:** файл перехвата запросов переименован.

| До (Next.js ≤15) | После (Next.js 16+) |
|---|---|
| `src/middleware.ts` | `src/proxy.ts` |
| `export function middleware()` | `export function proxy()` |

```typescript
// src/proxy.ts
import { type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/auth/confirm')) return
  // ... логика проверки сессии/подписки
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
```

Автоматическая миграция с v15: `npx @next/codemod@canary middleware-to-proxy .`

Официальная документация: https://nextjs.org/docs/app/api-reference/file-conventions/proxy

---

## Структура таблицы profiles

```sql
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  stripe_customer_id text,
  stripe_subscription_id text,
  -- 'trialing' нужен с самого начала: webhook пишет его раньше, чем пользователь подтвердит email
  subscription_status text check (
    subscription_status in ('active', 'inactive', 'canceled', 'trialing')
  ),
  current_period_end timestamptz,
  created_at timestamptz default now() not null
);

alter table public.profiles enable row level security;

create policy "users_select_own" on public.profiles
  for select using (auth.uid() = id);

create policy "users_update_own" on public.profiles
  for update using (auth.uid() = id);

-- Автоматически создаёт строку профиля при регистрации пользователя
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

---

## Webhook: `checkout.session.completed`

Пользователь может оплатить до регистрации — webhook придёт раньше, чем появится строка в `auth.users`. Корректное поведение: не падать с ошибкой, тихо выйти. Активация произойдёт при подтверждении email.

```typescript
// Порядок поиска пользователя: client_reference_id → customer_id → email
// Если пользователь не найден ни одним способом:
console.warn('[webhook] Пользователь не найден в Supabase, email:', email,
  '— активация произойдёт при подтверждении email')
return // выходим без ошибки — HTTP 200 для Stripe
```

Оба пути активации (webhook и `/auth/confirm`) должны быть идемпотентными: проверять текущий `subscription_status` перед записью и не перезаписывать уже активный профиль.

---

## Необходимые переменные окружения

| Переменная | Где используется |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | везде |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | SSR client, proxy.ts |
| `SUPABASE_SERVICE_ROLE_KEY` | webhook, `/auth/confirm` admin client |
| `STRIPE_SECRET_KEY` | Stripe SDK |
| `STRIPE_WEBHOOK_SECRET` | верификация подписи входящих webhook |
| `COOKIE_SECRET` | HMAC-подпись кеш-куки `subscription_status` (опционально) |
| `NEXT_PUBLIC_SITE_URL` | формирование redirect URL |

---

## Диагностика проблем

| Симптом | Наиболее вероятная причина |
|---|---|
| `subscription_status` остаётся `null` после confirm, ошибок в логах нет | RangeError от `new Date(NaN)` поглощён `catch` — нет null guard для `current_period_end` |
| `subscription_status` остаётся `null`, Stripe customer найден | Подписка в статусе `trialing`, а запрос только к `status: 'active'` |
| Пользователь попадает на `/inactive` несмотря на оплату | Webhook не нашёл пользователя, а `/auth/confirm` не выполнил Stripe lookup |
| `update` без ошибки, но `count === 0` | Строка в `profiles` не создана: trigger `on_auth_user_created` не выполнился |
| Admin client бросает исключение, пойманное `catch` | `SUPABASE_SERVICE_ROLE_KEY` не задан в переменных окружения (Vercel/локально) |
| Верификация токена падает с "invalid token" | `proxy.ts` не пропустил `/auth/confirm`, одноразовый токен сгорел в `updateSession` |
