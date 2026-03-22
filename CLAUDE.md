# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start dev server (Next.js)
npm run build      # Production build
npm run lint       # ESLint check
npm run typecheck  # TypeScript type check (tsc --noEmit)
npm run test       # Vitest (run once)
npm run test:watch # Vitest (watch mode)
```

### Тесты

**Vitest** + `@testing-library/react` + `jsdom`. Конфиг: `vitest.config.ts`. Файлы тестов: `tests/unit/**/*.{test,spec}.{ts,tsx}`.

Паттерны мокирования:
- Supabase server client: `vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(() => ({ from, auth })) }))`
- Supabase client (browser): `vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ rpc }) }))`
- React `cache()`: мокировать через `vi.mock('react', async (importOriginal) => ({ ...await importOriginal(), cache: (fn) => fn }))` в тестах серверных функций, обёрнутых в `cache`
- Next.js навигация: `vi.mock('next/navigation', () => ({ redirect, notFound, useRouter, ... }))`

## Architecture

**PROCONTENT** — закрытый клуб для создателей контента. Next.js 16 app на React 19 с App Router.

### Stack

- **Framework**: Next.js 16 (App Router) + React 19
- **Styling**: Tailwind CSS v4 + `tw-animate-css` + Shadcn design tokens
- **UI primitives**: `@base-ui/react` (headless, a11y-first) — NOT Radix UI
- **Component variants**: `class-variance-authority` (CVA)
- **Class merging**: `clsx` + `tailwind-merge` → утилита `cn()` в `src/lib/utils.ts`
- **Fonts**: Inter (`--font-sans`) + DM Sans (`--font-heading`) через `next/font/google`
- **Language**: `lang="ru"`, контент на русском

### Design System

Тема "Warm Minimalism" определена в `src/app/globals.css` через CSS-переменные oklch. Основные токены: `--primary` (Muted Terracotta), `--background` (теплый кремовый). Темная тема через класс `.dark`.

Tailwind использует `@theme inline` для маппинга CSS-переменных → Tailwind-токены. Shadcn-токены подключаются через `@import 'shadcn/tailwind.css'`.

### Структура `src/`

```
src/
  app/
    layout.tsx      # Root layout: шрифты, метаданные, lang="ru"
    page.tsx        # Главная (placeholder)
    globals.css     # Tailwind + CSS-переменные темы
    error.tsx       # Top-level error boundary
    loading.tsx     # Top-level loading boundary
  components/
    ui/
      button.tsx    # Базовый Button поверх @base-ui/react
    navigation/     # Навигационные компоненты
      DesktopSidebar.tsx  # Фиксированный sidebar (md+), содержит nav-items
  lib/
    utils.ts        # cn() helper
```

### Язык

Вся коммуникация, комментарии в коде, документация и commit-сообщения ведутся на **русском языке**. Технические термины, идентификаторы кода и названия инструментов остаются на английском.

### Соглашения

- **Компоненты `ui/`**: строятся поверх `@base-ui/react` (не Radix), оборачиваются в CVA-варианты, всегда `'use client'`
- **Минимальный touch target**: `min-h-[44px] min-w-[44px]` для всех интерактивных элементов
- **Naming — CRITICAL**:
  - **Database fields**: используем `snake_case` напрямую из Supabase БД. НЕ маппим в `camelCase`.
  - **Good:** `post.created_at`, `user.first_name` (прямые из БД)
  - **Bad:** `const post = { createdAt: data.created_at }` (маппинг запрещён)
  - ESLint настроен: `camelcase` отключен для свойств объектов БД
- **Prettier**: `singleQuote`, `semi: false`, `trailingComma: 'es5'`, плагин сортировки Tailwind-классов
- **Переменная окружения**: `NEXT_PUBLIC_SITE_URL` — базовый URL сайта

### Data Layer: Supabase

Два паттерна работы с Supabase:

**Server-side (SSR, Server Components)**:
```typescript
// src/features/feed/api/serverPosts.ts
import { createClient } from '@/lib/supabase/server'  // ← server auth context

export async function fetchPostById(id: string) {
  const supabase = await createClient()  // ← requires await
  const { data, error } = await supabase.from('posts').select(...).eq(...).single()
}
```

**Client-side (Browser, Client Components)**:
```typescript
// src/features/feed/components/FeedContainer.tsx
const supabase = createClient()  // ← no await, client key
const { data } = await supabase.rpc('toggle_like', { p_post_id: postId })
```

Ключевые паттерны:
- **Пагинация**: составной курсор `created_at|id` (file: `src/features/feed/api/posts.ts`)
- **RPC calls**: `toggle_like` (like/unlike с Supabase-side логикой)
- **Оптимистичные обновления**: изменить UI сразу, потом синхронизировать с сервером (rollback при ошибке) — file: `src/features/feed/components/FeedContainer.tsx`
- **Auth**: `supabase.auth.getUser()` — возвращает текущего пользователя (используется в RSC для проверки доступа)

### State Management: Zustand

`useFeedStore` в `src/features/feed/store.ts` — единственный глобальный store. Паттерн:
```typescript
// Select specific fields to avoid re-renders (granular subscriptions)
const posts = useFeedStore((s) => s.posts)
const hasMore = useFeedStore((s) => s.hasMore)

// Optimistic updates:
store.updatePost(postId, { is_liked: true, likes_count: newCount })
// Rollback on error:
store.updatePost(postId, { is_liked: oldValue, likes_count: oldCount })
```

### Architecture Patterns

**Smart Container / Dumb UI (MANDATORY)**:
- **Dumb UI** (`PostCard`, `PostDetail`): Визуальные компоненты, получают только `props`, вызывают `callbacks`. НЕ импортируют Zustand/Supabase. Сами рендерят Skeleton-состояние при `isLoading=true` (не обёртываются в Skeleton снаружи).
- **Smart Containers** (`FeedContainer`): Подписываются на Zustand, вызывают Supabase API, прокидывают данные и `isLoading` в Dumb компоненты.
- **Бан:** `src/components/ui/` **НЕ может** импортировать из `src/features/` (обратное импортирование разрешено).

**RSC + Client Components**:
- Page (`page.tsx`) = React Server Component → загружает данные, затем передаёт в Client Component
- Client Component (`FeedContainer`, `PostDetail`) = `'use client'` → интерактивность, клиентский state
- Пример: `src/app/(app)/feed/page.tsx` (RSC) → `src/features/feed/components/FeedContainer.tsx` (Client)

**Feature-driven structure** (`src/features/*/`):
- `api/` — функции загрузки данных (server + client)
- `components/` — React компоненты (разделены на Containers и Views/Dumb)
- `store.ts` — Zustand store (бизнес-стейт, кэш)
- `types.ts` — TypeScript типы
- Пример: `src/features/feed/` (posts, likes, pagination), `src/features/auth/` (login, signup, password reset)

**State Boundaries (CRITICAL)**:
- **Global UI State** (открыта ли навигация, активный таб) → глобальный Zustand в `src/app/(app)/layout.tsx`
- **Business State** (закэшированная лента, текущий пользователь) → изолирован в `src/features/[name]/store.ts`

**API Boundaries (CRITICAL)**:
- **Client-side reads** (лента, комментарии, профиль): напрямую через `lib/supabase/client.ts` из `'use client'` компонентов — БЕЗ Route Handlers
- **Server-side mutations & webhooks**: `lib/supabase/server.ts` + Next.js Route Handlers (`/api/`) — ТОЛЬКО для Stripe Webhooks, email confirmation, auth callbacks

**Пример workflow** (добавить лайк):
1. `FeedContainer` (client) — `handleLike()` → оптимистичное обновление store
2. `supabase.rpc('toggle_like')` → отправить на сервер
3. При ошибке → rollback store к старым значениям
4. При успехе → store уже обновлён, синхронизируем с ответом сервера

### Authentication

- **Sign Up / Login**: `src/features/auth/components/` (LoginForm, SignupForm) → вызывают `supabase.auth.signUp/signInWithPassword`
- **Email confirmation**: `GET /auth/confirm?token_hash&type` → OTP/magic link, затем обновляет session
- **Password Reset**: PasswordResetCard → `supabase.auth.resetPasswordForEmail(email, { redirectTo: '/auth/update-password' })` → пользователь подтверждает email → `GET /auth/update-password` → UpdatePasswordForm
- **Middleware**: `src/middleware.ts` — проверка auth status, редирект на `/inactive` если подписка истекла
- **Session cookies**: `@supabase/ssr` управляет refresh token в cookies (автоматически)

### Error Handling (Hybrid Approach)

**Система ошибок разделяется**:
- **Системные ошибки** (ошибки загрузки данных, API, мутации): → глобальный Toast (уведомление для пользователя)
  - Пример: `catch (err) { toast.error(err.message) }` в обработчике Supabase
  - Toast — встроен в глобальный layout
- **Ошибки валидации** (форма, пароль слишком короткий): → инлайн текст под полем
  - Пример: `<input /> {errors.password && <p>{errors.password}</p>}`
- **Бан:** НЕ использовать `useState` для системных ошибок и НЕ использовать Toast для ошибок форм

### Stripe Integration

- **Checkout**: `POST /api/checkout` → создаёт Stripe сессию, редирект на Stripe
- **Webhooks**: `POST /api/webhooks/stripe` → обновляет профиль при `checkout.session.completed`
- **Customer Portal**: `POST /api/stripe/portal` → link для управления подпиской
- Обновление статуса подписки: профиль (`subscription_status`, `current_period_end`, `stripe_customer_id`)

### `_bmad/`

Директория содержит BMAD-фреймворк для AI-агентов (workflows, templates, agents). Не является частью приложения Next.js — это инструментарий разработки процессов.
