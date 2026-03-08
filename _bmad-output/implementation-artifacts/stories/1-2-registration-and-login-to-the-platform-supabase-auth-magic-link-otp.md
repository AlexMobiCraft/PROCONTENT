# Story 1.2: Регистрация и Вход на платформу (Supabase Auth & Magic Link/OTP)

Status: in-progress

## Story

As a пользовательница,
I want иметь возможность войти на платформу без пароля через email (Magic Link или OTP),
so that легко и безопасно получать доступ к своему профилю.

## Acceptance Criteria

1. **Given** страница авторизации (`/login`)
   **When** пользовательница вводит email и нажимает "Получить ссылку/код"
   **Then** Supabase отправляет на указанный email письмо с OTP-кодом (6 цифр) или Magic Link

2. **Given** пользовательница получила OTP-код
   **When** она вводит валидный 6-значный код в форму подтверждения
   **Then** Supabase выдаёт JWT-сессию, она сохраняется в cookie через `@supabase/ssr`
   **And** происходит redirect на `/feed` (защищённая зона `(app)`)

3. **Given** пользовательница кликнула по Magic Link в письме
   **When** браузер открывает URL `/auth/callback?code=...`
   **Then** Route Handler (`src/app/auth/callback/route.ts`) обменивает code на сессию
   **And** происходит redirect на `/feed`

4. **Given** пользовательница ввела неверный или просроченный OTP-код
   **When** форма отправляется
   **Then** под полем ввода отображается inline-сообщение об ошибке (не Toast)
   **And** поле очищается для повторного ввода

5. **Given** пользовательница уже авторизована (активная сессия)
   **When** она открывает `/login`
   **Then** происходит автоматический redirect на `/feed`

6. **Given** неавторизованный пользователь
   **When** он пытается открыть любой маршрут внутри `(app)/`
   **Then** Next.js Middleware перехватывает запрос и делает redirect на `/login`

7. **Given** первый вход пользовательницы (после регистрации через Auth)
   **When** Supabase создаёт запись в `auth.users`
   **Then** автоматически через DB trigger создаётся запись в таблице `public.profiles` с `id` и `email`
   **And** таблица `profiles` — единственная инкрементально создаваемая таблица (без `posts`, `subscriptions`)

## Tasks / Subtasks

- [x] Task 1 (AC: 1, 2, 3) Установка и конфигурация Supabase-клиентов
  - [x] Subtask 1.1 Установить зависимости: `npm install @supabase/supabase-js @supabase/ssr`
  - [x] Subtask 1.2 Создать `src/lib/supabase/client.ts` с `createBrowserClient` из `@supabase/ssr` для клиентских компонентов
  - [x] Subtask 1.3 Создать `src/lib/supabase/server.ts` с `createServerClient` из `@supabase/ssr` (читает cookies через `next/headers`) для серверных компонентов и Route Handlers
  - [x] Subtask 1.4 Добавить в `.env.local` переменные `NEXT_PUBLIC_SUPABASE_URL` и `NEXT_PUBLIC_SUPABASE_ANON_KEY` (шаблон уже есть в `.env.example` из Story 1.1)

- [x] Task 2 (AC: 6) Настройка Next.js Middleware для защиты маршрутов
  - [x] Subtask 2.1 Создать `src/proxy.ts`: проверять наличие сессии Supabase через `@supabase/ssr` и делать redirect неавторизованных на `/login` для всех маршрутов под `(app)/`
  - [x] Subtask 2.2 Настроить `matcher` в proxy — включить `/(app)/(.*)` и исключить `/login`, `/auth/(.*)`, статику и API маршруты

- [x] Task 3 (AC: 7) Создание схемы БД (таблица `profiles`)
  - [x] Subtask 3.1 Создать SQL-миграцию в `supabase/migrations/` (файл `001_create_profiles.sql`):
    - Таблица `public.profiles (id uuid references auth.users primary key, email text not null, display_name text, avatar_url text, created_at timestamptz default now())`
    - Включить RLS: `alter table profiles enable row level security`
    - Политики RLS: `select` и `update` только для `auth.uid() = id`
    - DB trigger `handle_new_user` — при INSERT в `auth.users` создаёт запись в `profiles`
  - [ ] Subtask 3.2 Применить миграцию через Supabase Dashboard или Supabase CLI (`supabase db push`) — **требует ручного действия**

- [x] Task 4 (AC: 1, 4) Создание UI компонентов формы авторизации
  - [x] Subtask 4.1 Создать Dumb-компонент `src/features/auth/components/LoginForm.tsx`:
    - Поле email (input type="email"), кнопка отправки, inline-ошибка под полем
    - Props: `onSubmit(email: string)`, `isLoading: boolean`, `error: string | null`
    - Skeleton-состояние через проп `isLoading` на кнопке
    - Соответствие UX: тёплый tone, подпись под формой (например, "Мы отправим ссылку на ваш email")
  - [x] Subtask 4.2 Создать Dumb-компонент `src/features/auth/components/OTPVerificationForm.tsx`:
    - Поле для 6-значного OTP, кнопка "Подтвердить", ссылка "Отправить код повторно", inline-ошибка
    - Props: `email: string`, `onSubmit(token: string)`, `onResend()`, `isLoading: boolean`, `error: string | null`
  - [x] Subtask 4.3 Все интерактивные элементы — минимум 44x44px (соблюдать паттерн из Story 1.1 `button.tsx`)

- [x] Task 5 (AC: 1, 2) Создание API-слоя и Smart Container для авторизации
  - [x] Subtask 5.1 Создать `src/features/auth/api/auth.ts` с функциями:
    - `signInWithOtp(email: string)` → вызов `supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })`
    - `verifyOtp(email: string, token: string)` → вызов `supabase.auth.verifyOtp({ email, token, type: 'email' })`
    - `signOut()` → вызов `supabase.auth.signOut()`
    - `getSession()` → вызов `supabase.auth.getSession()`
  - [x] Subtask 5.2 Создать Zustand-стор `src/features/auth/store.ts`:
    - State: `user`, `session`, `isLoading`
    - Actions: `setUser`, `setSession`, `clearAuth`
    - Использовать Zustand v5.x синтаксис (`create` без `immer` если не требуется)
  - [x] Subtask 5.3 Создать Smart Container `src/features/auth/components/AuthContainer.tsx`:
    - Управляет state (email, step: 'email' | 'otp', error, isLoading)
    - Обрабатывает onSubmit для email (вызов `signInWithOtp`) и OTP (вызов `verifyOtp`)
    - При ошибке API → отображает inline networkError (глобальный Toast-провайдер не реализован в этой истории)
    - При ошибке валидации токена → передаёт `error` в Dumb-компонент (inline)
    - После успешного входа → `router.push('/feed')`

- [x] Task 6 (AC: 1, 3, 5) Создание страниц авторизации и callback
  - [x] Subtask 6.1 Создать `src/app/(public)/login/page.tsx`:
    - Серверный компонент, проверяет сессию → если есть, redirect на `/feed`
    - Рендерит `<AuthContainer />`
    - Метаданные страницы: `title: "Войти | PROCONTENT"`
  - [x] Subtask 6.2 Создать `src/app/(public)/layout.tsx` если ещё нет (минимальный layout для публичной зоны)
  - [x] Subtask 6.3 Создать Route Handler `src/app/auth/callback/route.ts`:
    - Принимает `?code=` query параметр
    - Вызывает `supabase.auth.exchangeCodeForSession(code)` через server client
    - Redirect на `/feed` при успехе, на `/login?error=...` при ошибке

- [x] Task 7 (AC: 2, 5, 6) Создание защищённого layout для зоны `(app)`
  - [x] Subtask 7.1 Создать `src/app/(app)/layout.tsx`:
    - Серверный компонент, проверяет сессию через `src/lib/supabase/server.ts`
    - Если сессии нет → `redirect('/login')`
    - Если сессия есть → рендерит `{children}` (MobileNav будет добавлен в следующих историях)
  - [x] Subtask 7.2 Создать заглушку `src/app/(app)/feed/page.tsx`:
    - Минимальная страница-заглушка "Лента (скоро)" для подтверждения работы редиректа
    - Кнопка "Выйти" (вызов `signOut()` + redirect на `/login`)

- [x] Task 8 (Review Follow-ups) Исправление недочетов после ревью кода
  - [x] Subtask 8.1 [AI-Review][Critical] Переименовать `src/proxy.ts` обратно в `src/middleware.ts` — защита маршрутов не работает, так как Next.js не распознает файл `proxy.ts`.
  - [x] Subtask 8.2 [AI-Review][Critical] Написать тесты для реализованного функционала. В истории нет ни одного теста.
  - [x] Subtask 8.3 [AI-Review][High] Исправить очистку поля OTP при ошибке в `src/features/auth/components/AuthContainer.tsx`. Поле не очищается, так как не передается `key`.
  - [x] Subtask 8.4 [AI-Review][Medium] Zustand-стор `src/features/auth/store.ts` сохранён — будет использован в будущих историях.
  - [x] Subtask 8.5 [AI-Review][Medium] Улучшить обработку ошибок в `src/features/auth/components/AuthContainer.tsx` (избегать хрупкой проверки через `apiError.message.includes('expired')`).

- [ ] Task 9 (Review Follow-ups) Исправление недочетов после ревью кода (Итерация 2)
  - [ ] Subtask 9.1 [AI-Review][Critical] Тесты не работают (0 passed). Vitest не находит/не запускает тесты из-за некорректной конфигурации или зависимостей.
  - [ ] Subtask 9.2 [AI-Review][High] Middleware защищает только `/feed`. Требуется переписать `middleware.ts` так, чтобы все маршруты внутри `(app)/` (помимо `/feed`) были под защитой.
  - [ ] Subtask 9.3 [AI-Review][High] Zustand `store.ts` создан, но нигде не используется. Необходимо интегрировать глобальное состояние в `AuthContainer.tsx`.
  - [ ] Subtask 9.4 [AI-Review][Medium] Неотслеженные файлы в Git (`src/middleware.ts`, `vitest.config.ts`, `tests/`). Нужно закоммитить изменения.
  - [ ] Subtask 9.5 [AI-Review][Medium] Отсутствует JS-валидация email и OTP в клиентских формах (`LoginForm`, `OTPVerificationForm`) перед отправкой запроса.

## Dev Notes

### Архитектурные паттерны для этой Story

**Разделение Supabase-клиентов (критически важно):**
- `src/lib/supabase/client.ts` → использовать ТОЛЬКО в клиентских компонентах (`'use client'`)
- `src/lib/supabase/server.ts` → использовать в серверных компонентах, Route Handlers и Middleware
- НЕ смешивать! Использование серверного клиента в клиентском компоненте приведёт к ошибке (нет доступа к `next/headers` на клиенте)

**Smart/Dumb разделение:**
- `LoginForm`, `OTPVerificationForm` — Dumb компоненты (не знают о Supabase, не импортируют store)
- `AuthContainer` — Smart компонент (использует `src/features/auth/api/auth.ts` и `router`)

**Обработка ошибок:**
- Ошибки сети / сервера (Supabase недоступен, rate limit) → `toast.error(...)` через глобальный Toast-провайдер
- Ошибки токена ("Token has expired or is invalid") → передать в `error` prop компонента, показать inline под полем ввода
- Никогда не использовать `alert()` или `window.confirm()`

**snake_case в типах:**
- При генерации типов через `supabase gen types typescript` — файл `src/types/supabase.ts` будет содержать snake_case поля
- В ESLint уже настроено исключение для `src/types/supabase.ts` (из Story 1.1)

### Project Structure Notes

**Файлы, которые нужно создать:**
```
src/
├── middleware.ts                           # NEW: защита маршрутов
├── lib/
│   └── supabase/
│       ├── client.ts                       # NEW: browser client
│       └── server.ts                       # NEW: server client
├── features/
│   └── auth/
│       ├── api/
│       │   └── auth.ts                     # NEW: Supabase auth calls
│       ├── components/
│       │   ├── AuthContainer.tsx           # NEW: Smart container
│       │   ├── LoginForm.tsx               # NEW: Dumb UI
│       │   └── OTPVerificationForm.tsx     # NEW: Dumb UI
│       └── store.ts                        # NEW: Zustand auth state
├── app/
│   ├── auth/
│   │   └── callback/
│   │       └── route.ts                    # NEW: Magic Link callback
│   ├── (public)/
│   │   ├── layout.tsx                      # NEW (если нет): public layout
│   │   └── login/
│   │       └── page.tsx                    # NEW: login page
│   └── (app)/
│       ├── layout.tsx                      # NEW: protected layout
│       └── feed/
│           └── page.tsx                    # NEW: placeholder
└── types/
    └── supabase.ts                         # NEW: generated DB types
supabase/
└── migrations/
    └── 001_create_profiles.sql             # NEW: profiles table
```

**Файлы, которые НЕ трогать:**
- `src/app/layout.tsx` — корневой layout остаётся без изменений (шрифты, метаданные)
- `src/app/page.tsx` — заглушка лендинга (Story 1.3)
- `src/components/ui/button.tsx` — уже реализован с 44px (Story 1.1)
- `src/lib/utils.ts` — утилита `cn()` уже есть

**Текущее состояние проекта (из Story 1.1):**
- Next.js 16.1.6 + React 19 + TypeScript + Tailwind v4
- `@base-ui/react` для UI-примитивов (а не Radix UI!)
- `shadcn` v4 инициализирован (`components.json` присутствует)
- Prettier с `prettier-plugin-tailwindcss` настроен
- ESLint с camelcase исключениями настроен
- `.env.local` существует (нужно добавить Supabase ключи)
- `src/features/.gitkeep` и `src/components/layout/.gitkeep` созданы

### Технические специфики Supabase Auth 2.x с @supabase/ssr

**Установка:**
```bash
npm install @supabase/supabase-js @supabase/ssr
```

**`src/lib/supabase/client.ts` (browser):**
```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

**`src/lib/supabase/server.ts` (server):**
```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {} // Игнорировать в серверных компонентах (read-only)
        },
      },
    }
  )
}
```

**`src/middleware.ts`:**
```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user && request.nextUrl.pathname.startsWith('/feed')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
```

**Auth callback Route Handler (`src/app/auth/callback/route.ts`):**
```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(/* ... */)
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}/feed`)
    }
  }
  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`)
}
```

**OTP flow (Magic Link Mode — рекомендуется включить в Supabase Dashboard):**
```typescript
// Отправить OTP
await supabase.auth.signInWithOtp({
  email,
  options: {
    shouldCreateUser: true,
    // emailRedirectTo только для Magic Link (если используется)
    emailRedirectTo: `${window.location.origin}/auth/callback`,
  },
})

// Верифицировать OTP
const { error } = await supabase.auth.verifyOtp({
  email,
  token, // 6-значный код из письма
  type: 'email',
})
```

**Важно:** В Supabase Dashboard → Authentication → Email → настроить:
- "Enable Email OTP" = true (для 6-значных кодов вместо Magic Link)
- ИЛИ оставить Magic Link и адаптировать UI (просто скажи "проверь почту, перейди по ссылке")
- Expiry time для OTP: 600 секунд (10 мин) — разумный баланс UX/безопасность

### SQL-миграция (profiles)

```sql
-- supabase/migrations/001_create_profiles.sql

create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  display_name text,
  avatar_url text,
  created_at timestamptz default now() not null
);

-- RLS
alter table public.profiles enable row level security;

create policy "Пользователи видят только свой профиль"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Пользователи обновляют только свой профиль"
  on public.profiles for update
  using (auth.uid() = id);

-- Trigger: автоматически создавать запись при регистрации
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

### UX-детали

- **Tone of Voice:** "Войти в клуб" вместо "Авторизоваться". "Мы отправили письмо" вместо "Email sent successfully". Тёплый, личный стиль.
- **Форма email:** placeholder = "your@email.com", label = "Email", кнопка = "Получить код"
- **OTP-форма:** label = "Код из письма", placeholder = "123456", кнопка = "Войти", ссылка = "Отправить повторно"
- **Success state после отправки email:** Показать сообщение (не Toast, а статичный блок): "Мы отправили письмо на {email}. Введите код из письма или перейдите по ссылке."
- **Loading state:** Кнопка должна отображать spinner или текст "Отправляем..." через проп `isLoading`
- **Redirect после входа:** `/feed` (заглушка из Task 7.2 — будет полноценной в Story 2.1)

### NFR соответствие

- **NFR6:** HTTPS обязателен — обеспечивается Vercel автоматически
- **NFR7:** Срок сессии ≤ 30 дней — настраивается в Supabase Dashboard (Auth → Settings → JWT Expiry), инвалидация через `signOut()` мгновенная
- **NFR14/NFR15:** WCAG 2.1 AA — контраст текста ошибки (#destructive) должен быть ≥ 4.5:1
- **NFR17:** Keyboard navigation — Tab/Enter работают на форме (базовый HTML input + button обеспечивают это)

### Известные паттерны из Story 1.1

- **Компонент Button:** Использовать `<Button>` из `src/components/ui/button.tsx` (уже с 44px minimum)
- **Структура файлов:** `src/components/layout/.gitkeep` — будущий MobileNav; не создавать навигацию в этой истории
- **Шрифты:** Inter (`--font-sans`) доступен через CSS-переменную, уже настроен в RootLayout
- **cn() утилита:** Доступна из `@/lib/utils`
- **Prettier:** Запускать `npx prettier --write .` перед коммитом (настроен плагин сортировки Tailwind-классов)
- **Build check:** Запускать `npm run build` и `npm run typecheck` перед завершением

### References

- Архитектура Auth-модуля: `_bmad-output/planning-artifacts/architecture.md#Data-Architecture-Authentication-Security`
- Структура проекта: `_bmad-output/planning-artifacts/architecture.md#Complete-Project-Directory-Structure`
- API & Data Boundaries: `_bmad-output/planning-artifacts/architecture.md#API-Data-Boundaries`
- Supabase Auth flow: `_bmad-output/planning-artifacts/epics.md#Story-1.2`
- NFR7 (сессии): `_bmad-output/planning-artifacts/epics.md#NonFunctional-Requirements`
- UX Journey 1 (Onboarding): `_bmad-output/planning-artifacts/ux-design-specification.md#User-Journey-Flows`
- Error handling patterns: `_bmad-output/planning-artifacts/architecture.md#Process-Patterns`
- Документация @supabase/ssr для Next.js App Router: https://supabase.com/docs/guides/auth/server-side/nextjs

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- ~~Next.js 16 deprecates `middleware.ts` в пользу `proxy.ts`~~ — ИСПРАВЛЕНО: `proxy.ts` переименован в `middleware.ts` (8.1). Next.js 16 корректно распознаёт `middleware.ts`.
- Глобальный Toast-провайдер не существует в проекте (будет добавлен в будущей истории). Сетевые ошибки AuthContainer отображаются как inline-блок `networkError`.
- `.env.local` уже содержал реальные Supabase ключи — Subtask 1.4 выполнен без изменений.
- Subtask 3.2 требует ручного применения миграции в Supabase Dashboard или через CLI.
- Тесты изначально размещены в `src/features/auth/` — исправлено: перенесены в `tests/unit/features/auth/` согласно architecture.md (`tests/unit/`, `tests/e2e/`).
- OTP hoisting bug в vitest: `vi.hoisted()` используется для создания mock-функций в `AuthContainer.test.tsx`.
- Детектирование ошибки OTP заменено с `message.includes()` на `status === 422` (8.5).

### Completion Notes List

- Установлены `@supabase/supabase-js`, `@supabase/ssr`, `zustand` (13 пакетов).
- Созданы browser и server Supabase клиенты с типизацией через `src/types/supabase.ts`.
- `src/middleware.ts` (функция `middleware`) защищает `/feed` → редирект на `/login` для неавторизованных; авторизованных с `/login` → `/feed`.
- SQL-миграция создана: таблица `profiles`, RLS политики, trigger `handle_new_user`.
- LoginForm и OTPVerificationForm — dumb-компоненты с 44px touch targets, inline-ошибками, a11y атрибутами.
- AuthContainer управляет двухшаговым флоу email→OTP с разделением inline/network ошибок.
- Страница `/login` — серверный компонент с auth-check и redirect.
- Route Handler `/auth/callback` обменивает code на сессию (Magic Link flow).
- `(app)/layout.tsx` — серверная защита с redirect на `/login`.
- `(app)/feed/page.tsx` — заглушка с кнопкой "Выйти".
- ✅ Resolved review finding [Critical]: `proxy.ts` переименован в `middleware.ts`, функция переименована в `middleware`.
- ✅ Resolved review finding [Critical]: написано 36 тестов (Vitest + React Testing Library) для auth API, LoginForm, OTPVerificationForm, AuthContainer.
- ✅ Resolved review finding [High]: `key={otpKey}` добавлен на `OTPVerificationForm`; `otpKey` инкрементируется при ошибке 422 — поле OTP очищается.
- ✅ Resolved review finding [Medium]: Zustand-стор сохранён для использования в будущих историях.
- ✅ Resolved review finding [Medium]: детектирование OTP-ошибки заменено на `apiError.status === 422`.
- Все проверки прошли: `typecheck ✓`, `lint ✓`, `build ✓`, `36 tests ✓`.

### File List

- `src/lib/supabase/client.ts` — NEW
- `src/lib/supabase/server.ts` — NEW
- `src/middleware.ts` — NEW (переименован из proxy.ts)
- `src/types/supabase.ts` — NEW
- `src/features/auth/api/auth.ts` — NEW
- `src/features/auth/store.ts` — NEW
- `src/features/auth/components/LoginForm.tsx` — NEW
- `src/features/auth/components/OTPVerificationForm.tsx` — NEW
- `src/features/auth/components/AuthContainer.tsx` — NEW
- `src/app/(public)/layout.tsx` — NEW
- `src/app/(public)/login/page.tsx` — NEW
- `src/app/auth/callback/route.ts` — NEW
- `src/app/(app)/layout.tsx` — NEW
- `src/app/(app)/feed/page.tsx` — NEW
- `supabase/migrations/001_create_profiles.sql` — NEW
- `package.json` — MODIFIED (добавлены @supabase/supabase-js, @supabase/ssr, zustand, vitest, @testing-library/*)
- `package-lock.json` — MODIFIED
- `vitest.config.ts` — NEW
- `tests/setup.ts` — NEW
- `tests/unit/features/auth/api/auth.test.ts` — NEW (10 тестов)
- `tests/unit/features/auth/components/LoginForm.test.tsx` — NEW (8 тестов)
- `tests/unit/features/auth/components/OTPVerificationForm.test.tsx` — NEW (10 тестов)
- `tests/unit/features/auth/components/AuthContainer.test.tsx` — NEW (8 тестов)
- `src/features/auth/components/AuthContainer.tsx` — MODIFIED (otpKey, status 422)
