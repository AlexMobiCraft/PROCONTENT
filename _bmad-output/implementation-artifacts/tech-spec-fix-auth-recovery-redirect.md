---
title: 'Исправить редирект на /login вместо /update-password при сбросе пароля'
slug: 'fix-auth-recovery-redirect'
created: '2026-03-15'
status: 'ready-for-dev'
stepsCompleted: [1, 2, 3, 4]
tech_stack: ['Next.js 16', 'Supabase SSR', '@supabase/ssr', 'TypeScript', 'Vitest']
files_to_modify:
  - 'src/app/(app)/update-password/page.tsx → DELETE'
  - 'src/app/(public)/update-password/page.tsx → CREATE'
  - 'src/app/auth/confirm/route.ts → REWRITE'
code_patterns:
  - 'NextResponse.redirect() + response.cookies.set() для Route Handlers'
  - 'createServerClient() inline в Route Handler с explicit cookie binding'
  - 'Next.js (public) route group без auth guard'
test_patterns:
  - 'Vitest + vi.hoisted() + vi.mock()'
  - 'confirm/route.test.ts — mockCreateClient без getUser (deferred)'
---

# Tech-Spec: Исправить редирект на /login вместо /update-password при сбросе пароля

**Создан:** 2026-03-15

## Overview

### Problem Statement

При сбросе пароля Supabase отправляет на почту ссылку вида:
```
/auth/confirm?token_hash=<TOKEN>&type=recovery
```
После перехода по ссылке пользователь попадает на `/login` вместо `/update-password`.

**Корневая причина 1 — архитектурное противоречие:**
- `/update-password` объявлен публичным маршрутом в `src/lib/app-routes.ts` (`PUBLIC_PATHS`)
- Но физически расположен в `src/app/(app)/update-password/page.tsx` — внутри `(app)` route group
- `(app)/layout.tsx` имеет серверный auth guard: вызывает `getUser()` → если нет пользователя → `redirect('/login')`

**Корневая причина 2 — неправильный паттерн cookies в Route Handler:**
- `confirm/route.ts` использует `createClient()` из `server.ts`, который устанавливает куки через `cookies()` из `next/headers`
- В Route Handlers куки, установленные через `cookieStore.set()`, могут не попасть в явный `NextResponse.redirect()` — это известная несовместимость
- Следствие: браузер не получает `Set-Cookie` заголовки, следующий запрос к `/update-password` идёт без сессии
- `(app)/layout.tsx` видит неавторизованного пользователя → редиректит на `/login`

**Бонусная проблема:** `getUser()` guard добавленный в `confirm/route.ts` для защиты от двойных запросов использует неправильный паттерн и сломал существующие тесты (`route.test.ts` не имеет мока для `getUser`).

### Solution

**Шаг 1**: Переместить `/update-password` из `(app)` в `(public)` route group.
- Устраняет архитектурное противоречие — страница больше не проходит через auth guard
- `(public)/layout.tsx` = `return children`, никаких проверок
- `UpdatePasswordForm` использует браузерный Supabase клиент, который читает сессию из cookie — это работает без серверного layout

**Шаг 2**: Переписать `confirm/route.ts` — использовать `createServerClient()` из `@supabase/ssr` напрямую с биндингом `setAll → response.cookies.set()`.
- Правильный паттерн Next.js 16 для Route Handlers: создать `NextResponse.redirect()` сначала, куки ставить через `response.cookies.set()`
- Когда `verifyOtp` вызывает `setAll` → куки записываются в `response` → браузер гарантированно получает `Set-Cookie`
- Убрать `getUser()` guard — он ненадёжен и ломает тесты

### Scope

**In Scope:**
- Создать `src/app/(public)/update-password/page.tsx`
- Удалить `src/app/(app)/update-password/page.tsx` и директорию
- Переписать `src/app/auth/confirm/route.ts`

**Out of Scope:**
- Исправление тестов — deferred
- Кнопка "Забыли пароль?" в `LoginForm`
- Изменение Supabase email templates
- Изменение `(app)/layout.tsx`

---

## Context for Development

### Codebase Patterns

- **Route groups**: `(public)` — без auth guard, `layout.tsx` = `return children`. `(app)` — guard через `getUser()` + `getSession()` в layout.
- **Supabase в Route Handlers**: НЕ использовать `createClient()` из `server.ts`. Нужен `createServerClient()` из `@supabase/ssr` с явным биндингом `setAll → response.cookies.set()`.
- **Supabase в Server Components**: `createClient()` из `src/lib/supabase/server.ts` (через `cookies()` из `next/headers`).
- **Supabase на клиенте**: `createClient()` из `src/lib/supabase/client.ts`.
- **Public paths**: `src/lib/app-routes.ts` → `PUBLIC_PATHS` и `isPublicPath()`. `/update-password` уже в списке.
- **proxy.ts**: Next.js 16 middleware (официальная конвенция, подтверждена документацией). Корректно пропускает публичные пути.
- **Тесты**: Vitest, `vi.hoisted()` для mock-фабрик, `vi.mock()` для модулей.

### Files to Reference

| Файл | Назначение |
| ---- | ---------- |
| `src/app/(app)/update-password/page.tsx` | Исходник — удалить |
| `src/app/(public)/layout.tsx` | Целевой layout: `return children`, без guard |
| `src/app/(public)/login/page.tsx` | Образец outer-wrapper разметки для `(public)` страниц |
| `src/app/(app)/layout.tsx` | Auth guard — источник проблемы, не трогать |
| `src/app/auth/confirm/route.ts` | Route Handler — полная перезапись |
| `src/lib/supabase/server.ts` | `createClient()` — для Server Components (НЕ использовать в Route Handlers) |
| `src/lib/supabase/client.ts` | Браузерный клиент |
| `src/lib/app-routes.ts` | `PUBLIC_PATHS`, `getAuthSuccessRedirectPath()` |
| `src/features/auth/components/UpdatePasswordForm.tsx` | Форма — `use client`, не зависит от layout |
| `tests/unit/app/auth/confirm/route.test.ts` | Существующие тесты — deferred |

### Technical Decisions

**TD-1: Переместить `/update-password` в `(public)`**
- Страница уже в `PUBLIC_PATHS` — перемещение устраняет противоречие
- `UpdatePasswordForm` не использует `AuthProvider` и не зависит от `(app)/layout.tsx`
- Клиентский Supabase (`client.ts`) читает сессию из browser cookies — работает независимо от серверного layout

**TD-2: Переписать `confirm/route.ts` с inline `createServerClient()`**
- Создать `response = NextResponse.redirect(redirectUrl)` СНАЧАЛА
- Передать `response.cookies.set` как `setAll` callback в Supabase клиент
- `verifyOtp` → вызывает `setAll` → куки попадают прямо в `response` → браузер получает `Set-Cookie`

**TD-3: Убрать `getUser()` guard**
- Не нужен после перемещения `/update-password` в `(public)` — там нет auth guard
- Существующий тест не имеет мока для `getUser` — guard ломает 6 тестов
- Guard ненадёжен против разных клиентов (Vercel prefetch в другом контексте)

---

## Implementation Plan

### Tasks

- [ ] **Task 1**: Создать `src/app/(public)/update-password/page.tsx`
  - Файл: `src/app/(public)/update-password/page.tsx` (новый)
  - Action: Создать страницу с тем же `UpdatePasswordForm`, но с outer wrapper как в `(public)/login/page.tsx`
  - Точное содержимое:
    ```tsx
    import { UpdatePasswordForm } from '@/features/auth/components/UpdatePasswordForm'

    export const metadata = {
      title: 'Установка пароля | ProContent',
      description: 'Придумайте надежный пароль для доступа в клуб',
    }

    export default function UpdatePasswordPage() {
      return (
        <main className="flex min-h-screen items-center justify-center px-4 py-12">
          <div className="w-full max-w-sm">
            <UpdatePasswordForm />
          </div>
        </main>
      )
    }
    ```

- [ ] **Task 2**: Удалить `src/app/(app)/update-password/page.tsx`
  - Файл: `src/app/(app)/update-password/page.tsx` (удалить)
  - Директорию `src/app/(app)/update-password/` тоже удалить (она станет пустой)
  - Notes: Перед удалением убедиться что Task 1 уже создан

- [ ] **Task 3**: Переписать `src/app/auth/confirm/route.ts`
  - Файл: `src/app/auth/confirm/route.ts` (полная замена)
  - Action: Удалить `getUser()` guard. Использовать `createServerClient()` из `@supabase/ssr` с биндингом кук к response.
  - Точное содержимое:
    ```ts
    import { createServerClient } from '@supabase/ssr'
    import { type EmailOtpType } from '@supabase/supabase-js'
    import { NextRequest, NextResponse } from 'next/server'

    import { getAuthSuccessRedirectPath } from '@/lib/app-routes'

    export async function GET(request: NextRequest) {
      const { searchParams } = request.nextUrl
      const tokenHash = searchParams.get('token_hash')
      const type = searchParams.get('type') as EmailOtpType | null
      const next = searchParams.get('next') ?? getAuthSuccessRedirectPath()

      if (tokenHash && type) {
        // Определяем путь редиректа
        const redirectUrl = request.nextUrl.clone()
        redirectUrl.searchParams.delete('token_hash')
        redirectUrl.searchParams.delete('type')
        redirectUrl.searchParams.delete('next')

        if (type === 'signup' || type === 'recovery') {
          redirectUrl.pathname = '/update-password'
        } else {
          redirectUrl.pathname = next
        }

        // Создаём ответ ПЕРВЫМ — куки будут прикреплены к нему
        const response = NextResponse.redirect(redirectUrl)

        // Supabase клиент для Route Handler: setAll биндится к response
        const supabase = createServerClient(
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

        const { error } = await supabase.auth.verifyOtp({
          type,
          token_hash: tokenHash,
        })

        if (!error) {
          return response
        }

        console.error('[auth/confirm] verifyOtp error:', error.message, '| type:', type)
      }

      // Нет token_hash/type или verifyOtp вернул ошибку
      const errorUrl = request.nextUrl.clone()
      errorUrl.searchParams.delete('token_hash')
      errorUrl.searchParams.delete('type')
      errorUrl.searchParams.delete('next')
      errorUrl.pathname = '/login'
      errorUrl.searchParams.set('error', 'auth_callback_error_v2')
      return NextResponse.redirect(errorUrl)
    }
    ```
  - Notes: `error_description` убран из redirect URL — чтобы не выставлять детали ошибки в адресной строке (security). Лог в консоль сохранён для диагностики.

### Acceptance Criteria

- [ ] **AC 1**: Given пользователь кликает ссылку из recovery-письма `/auth/confirm?token_hash=VALID&type=recovery`, when токен валиден, then HTTP-ответ содержит `Set-Cookie` заголовки с сессией Supabase И редирект идёт на `/update-password`

- [ ] **AC 2**: Given пользователь попал на `/update-password` после recovery-ссылки, when страница рендерится на сервере, then нет серверного `redirect('/login')` — `(public)/layout.tsx` не имеет auth guard

- [ ] **AC 3**: Given пользователь на `/update-password` вводит новый пароль (≥6 символов) и нажимает "Сохранить и войти", when `supabase.auth.updateUser({ password })` выполняется успешно, then `router.push('/feed')` выполняется и пользователь попадает в закрытую зону

- [ ] **AC 4**: Given `token_hash` параметр отсутствует в URL, when GET `/auth/confirm` вызывается, then ответ — редирект на `/login?error=auth_callback_error_v2`

- [ ] **AC 5**: Given `verifyOtp` возвращает ошибку (невалидный/истёкший токен), when GET `/auth/confirm` обрабатывается, then ответ — редирект на `/login?error=auth_callback_error_v2` И ошибка логируется в консоль сервера

- [ ] **AC 6**: Given запрос к `/update-password` без сессии (прямой заход), when страница загружается, then форма показывается (публичная страница без auth guard), updateUser вернёт ошибку — форма отображает "Не удалось обновить пароль"

---

## Additional Context

### Dependencies

- `@supabase/ssr` — уже установлен (используется в `auth-middleware.ts`)
- `@supabase/supabase-js` — уже установлен
- Никаких новых зависимостей

### Testing Strategy

**Deferred** (отдельная задача после реализации):
- Обновить `tests/unit/app/auth/confirm/route.test.ts`:
  - Убрать мок `getUser` (он теперь не используется)
  - Добавить тест на корректную установку кук в redirect ответе
  - Обновить `error` значение с `auth_callback_error` → `auth_callback_error_v2`
  - Добавить тест: нет `error_description` в redirect URL
- Обновить `tests/unit/middleware.test.ts`:
  - Исправить импорт с `@/lib/supabase/middleware` → `@/lib/supabase/auth-middleware`

**Ручное тестирование (после деплоя):**
1. Перейти в Supabase Dashboard → Authentication → Users → выбрать пользователя → "Send recovery email"
2. Открыть письмо → кликнуть ссылку
3. Убедиться: попадаем на `/update-password`, не на `/login`
4. Ввести новый пароль → нажать "Сохранить и войти"
5. Убедиться: попадаем на `/feed`

### Notes

- `proxy.ts` — официальная конвенция Next.js 16 (подтверждено документацией). Проблема НЕ в `proxy.ts`.
- `middleware-manifest.json` пустой — ожидаемо для Next.js 16 с `proxy.ts`.
- Если после фикса пользователь всё ещё попадает на `/login` — проверить: содержит ли URL параметр `error=auth_callback_error_v2` (токен не валиден/сгорел) или нет (другая проблема с сессией).
- **Pre-mortem риск**: Supabase email template для Recovery может использовать старый `{{ .ConfirmationURL }}` (implicit flow с `#` фрагментом вместо `?token_hash=`). В этом случае сервер не получит `token_hash` → `AC 4` сработает. Решение: проверить шаблон в Supabase Dashboard → Authentication → Email Templates → "Reset Password".
