# Story 1.6: Onboarding-страница для новых участниц

Status: ready-for-dev

## Story

As a новая участница,
I want после первой успешной оплаты попадать на страницу "Начни здесь" с топ-постами и ссылкой на WhatsApp,
so that сразу вовлечься в жизнь комьюнити.

## Acceptance Criteria

1. **Given** успешная первая оплата в Stripe
   **When** пользователь возвращается на сайт (success url с `?session_id=...`)
   **Then** она перенаправляется на специальный роут онбординга `/onboarding`
   **And** видит приветственное сообщение ("Привет, ты теперь часть PROCONTENT!")
   **And** видит ссылку для перехода в WhatsApp-группу сообщества
   **And** видит список "Топ-5 постов" для старта

2. **Given** пользователь находится на onboarding-странице
   **When** она нажимает на ссылку WhatsApp
   **Then** открывается новая вкладка/приложение WhatsApp с предзаполненной ссылкой группы

3. **Given** пользователь находится на onboarding-странице
   **When** она нажимает на карточку поста из списка "Топ-5"
   **Then** она перенаправляется на детальную страницу поста (или задействуется ленту, если детальные страницы ещё не реализованы — MVP: ссылка на `/feed`)

4. **Given** неавторизованный пользователь пытается зайти на `/onboarding`
   **When** запрос приходит без сессии
   **Then** происходит редирект на `/login`

5. **Given** авторизованный пользователь открывает `/onboarding` без query-параметра `session_id`
   **When** страница загружается
   **Then** контент onboarding отображается нормально (session_id опционален — пользователь может вернуться на страницу позже)

## Tasks / Subtasks

- [ ] **Task 1: Создание маршрута `/onboarding`** (AC: 1, 4, 5)
  - [ ] Subtask 1.1: Создать страницу `src/app/(app)/onboarding/page.tsx` внутри группы `(app)` (защищённая зона, авторизация проверяется через `(app)/layout.tsx`). Страница — **Server Component** (async), делает fetch данных на сервере.
  - [ ] Subtask 1.2: Проверить, что `/onboarding` корректно защищается текущим `(app)/layout.tsx` (auth guard). Неавторизованные пользователи уже редиректятся на `/login`. Дополнительный код защиты **НЕ нужен** — используется существующий.
  - [ ] Subtask 1.3: Убедиться, что маршрут `/onboarding` **НЕ** является публичным в `src/lib/app-routes.ts`. Он должен быть закрытым (только авторизованные). Проверить, что `isPublicPath('/onboarding')` возвращает `false`.
  - [ ] Subtask 1.4: Опционально (если `session_id` передан в URL): вывести лог `console.info('[onboarding] session_id: ...', sessionId)` для отладки. **НЕ** выполнять верификацию session через Stripe API (выходит за scope MVP).

- [ ] **Task 2: Реализация UI onboarding-страницы** (AC: 1, 2, 3)
  - [ ] Subtask 2.1: Создать клиентский компонент `src/features/onboarding/components/OnboardingScreen.tsx`. Структура экрана (сверху вниз):
    1. **Приветственный блок:** Заголовок "Привет, ты теперь часть PROCONTENT!" (шрифт `font-heading` / Cormorant Garamond, стиль editorial). Подзаголовок "Мы рады, что ты здесь. Вот с чего начать:" (шрифт `font-sans` / Barlow Condensed, `uppercase tracking-[0.15em]`).
    2. **CTA WhatsApp:** Кнопка/ссылка "Вступить в WhatsApp-группу" (editorial outline стиль: `border border-primary px-8 py-3 font-sans text-xs font-medium tracking-[0.2em] uppercase`, hover: `bg-primary/10`). Иконка WhatsApp слева (Lucide: `MessageCircle` или SVG). Ссылка открывается в `target="_blank" rel="noopener noreferrer"`.
    3. **Блок "Начни здесь" — Топ-5 постов:** Заголовок секции "Начни здесь" (`font-heading`). Список из 5 карточек (упрощённый вариант `PostCard` или отдельный `OnboardingPostCard`). Каждая карточка: заголовок + категория + иконка типа (видео/фото/текст).
    4. **CTA "Перейти в ленту":** Внизу кнопка "Перейти к ленте" (outline primary) → ссылка на `/feed`.
  - [ ] Subtask 2.2: Реализовать `OnboardingPostCard` — упрощённая карточка поста для блока "Начни здесь":
    - Заголовок поста (`font-heading text-base font-semibold`)
    - Бейдж категории (`bg-muted rounded-full px-3 py-1 text-xs`)
    - Бейдж типа контента (Видео/Фото/Текст)
    - Без кнопок лайков/комментариев (не нужны на onboarding)
    - Min touch target 44x44px
    - `aria-label` на ссылке
  - [ ] Subtask 2.3: Обеспечить Mobile-First дизайн: полноэкранная компоновка на `375px`, центрирование контента с `max-w-xl` на десктопе.
  - [ ] Subtask 2.4: Добавить Skeleton-загрузку (`OnboardingScreenSkeleton`) — отображается пока идёт fetch данных постов.

- [ ] **Task 3: Получение данных "Топ-5 постов" и WhatsApp-ссылки** (AC: 1, 2)
  - [ ] Subtask 3.1: **MVP-подход:** Поскольку таблица `posts` ещё не существует (будет создана в Epic 2), а FR13 (управление топ-5 автором) реализуется в Epic 4, использовать **статические данные** (hardcoded массив из 5 объектов `{ id, title, category, type }`) и **строковую константу** для WhatsApp-ссылки.
  - [ ] Subtask 3.2: Определить конфигурацию в файле `src/features/onboarding/data/onboarding-config.ts`:
    ```typescript
    export const ONBOARDING_CONFIG = {
      whatsappUrl: process.env.NEXT_PUBLIC_WHATSAPP_URL || 'https://chat.whatsapp.com/placeholder',
      topPosts: [
        { id: '1', title: 'Как начать создавать UGC-контент', category: '#insight', type: 'text' as const },
        { id: '2', title: 'Первый питч бренду: пошаговый шаблон', category: '#бренды', type: 'text' as const },
        { id: '3', title: 'Съёмка Reels за 15 минут', category: '#reels', type: 'video' as const },
        { id: '4', title: 'Разбор: как работают алгоритмы в 2026', category: '#разборы', type: 'text' as const },
        { id: '5', title: 'Домашняя фотостудия с бюджетом €50', category: '#съёмка', type: 'photo' as const },
      ],
    } as const
    ```
  - [ ] Subtask 3.3: Добавить `NEXT_PUBLIC_WHATSAPP_URL` в `.env.example` и `.env.local` (placeholder значение).
  - [ ] Subtask 3.4: **ПОДГОТОВКА К FUTURE:** Оставить TODO-комментарий в `onboarding-config.ts` о том, что в Epic 4 (Story 4.3) данные будут подтягиваться из Supabase (таблица `onboarding_posts` или поле `is_onboarding: true` в таблице `posts`).

- [ ] **Task 4: Обновление Stripe Checkout success_url** (AC: 1)
  - [ ] Subtask 4.1: ✅ **УЖЕ РЕАЛИЗОВАНО.** В `src/app/api/checkout/route.ts` success_url уже указывает на `/onboarding?session_id={CHECKOUT_SESSION_ID}`. Никаких изменений не требуется. Проверить, что ссылка корректна при code review.

- [ ] **Task 5: Unit-тестирование** (AC: 1–5)
  - [ ] Subtask 5.1: Написать unit-тест для `OnboardingScreen` — проверить рендер приветствия, WhatsApp-ссылки, списка из 5 карточек, кнопки "Перейти к ленте".
  - [ ] Subtask 5.2: Написать unit-тест для `OnboardingPostCard` — проверить рендер заголовка, категории, типа контента.
  - [ ] Subtask 5.3: Написать интеграционный тест для страницы `/onboarding` — проверить, что Server Component рендерит `OnboardingScreen` с данными из конфигурации.

## Dev Notes

### Критически важный контекст

- **Checkout success_url уже прописан:** В `src/app/api/checkout/route.ts` (строка 54): `success_url: ${siteUrl}/onboarding?session_id={CHECKOUT_SESSION_ID}`. Изменения **НЕ нужны**. [Source: src/app/api/checkout/route.ts#L54]
- **Группа маршрутов `(app)`:** Маршрут `/onboarding` располагается внутри `src/app/(app)/onboarding/page.tsx`. Группа `(app)` уже имеет layout с авторизационным guard'ом (`redirect('/login')` для неавторизованных). [Source: src/app/(app)/layout.tsx]
- **`session_id` — опциональный параметр:** Stripe передаёт его как query-параметр при возврате пользователя. На MVP его **НЕ** нужно верифицировать через Stripe API. Пользователь может зайти на `/onboarding` без него (вернуться позже через меню).
- **Middleware:** `/onboarding` защищён middleware (не в `PUBLIC_PATHS`). Пользователь с `subscription_status = 'inactive'` будет перенаправлен на `/inactive`. Это **корректное поведение**: если пользователь ещё не оплатил — на onboarding попасть нельзя. [Source: src/lib/app-routes.ts, src/lib/supabase/middleware.ts]

### Архитектурные границы

- **Feature-based структура:** Весь код onboarding — в `src/features/onboarding/`. Компоненты: `components/OnboardingScreen.tsx`, `components/OnboardingPostCard.tsx`, `components/OnboardingScreenSkeleton.tsx`. Данные: `data/onboarding-config.ts`.
- **Server Component (page) + Client Component (Screen):** Страница `page.tsx` — Server Component, передаёт props. `OnboardingScreen` — Client Component (`'use client'`) для интерактивных элементов.
- **НЕ использовать:** Zustand (глобальный state не нужен). fetchAPI/Supabase для постов (данные статические на MVP).

### Визуальный дизайн (по UX-спецификации)

- **Эмоция:** "Радостное предвкушение и ясность" — "Меня тут ждали, я знаю, с чего начать". [Source: ux-design-specification.md#Emotional-Journey-Mapping]
- **Типографика:**
  - Заголовок-приветствие: `font-heading` (Cormorant Garamond), `clamp(2rem, 8vw, 3.5rem)`, `font-light leading-none uppercase`. [Source: ux-design-specification.md#Typography-System]
  - UI-текст (подзаголовки, лейблы): `font-sans` (Barlow Condensed), `text-xs tracking-[0.15em] uppercase`. [Source: ux-design-specification.md#Typography-System]
- **Цвета:** Тёплый кремовый фон `bg-background`, терракотовый акцент `text-primary` / `bg-primary`, тёмный текст `text-foreground`. [Source: ux-design-specification.md#Color-System]
- **Кнопки:** Editorial outline стиль: `border border-primary px-8 py-3 font-sans text-xs font-medium tracking-[0.2em] uppercase`, hover: `hover:bg-primary/10`. [Source: ux-design-specification.md#Button-Hierarchy]
- **Воздух:** Обильные отступы `py-16` между секциями. Контейнер: `max-w-xl mx-auto px-5`. [Source: ux-design-specification.md#Spacing-Layout-Foundation]
- **Touch targets:** 44x44px минимум. [Source: ux-design-specification.md#Accessibility-Considerations]

### Plan из Story 1.5 (контекст)

- **Привязка пользователя по checkout:** `handleCheckoutSessionCompleted` в webhook route обновляет `subscription_status = 'active'` и привязывает `stripe_customer_id` / `stripe_subscription_id`. К моменту перехода пользователя на `/onboarding` (success URL) — его профиль уже обновлён webhook'ом (или будет обновлён в ближайшие секунды).
- **Возможный race condition:** Stripe success redirect и webhook могут прийти почти одновременно. Пользователь попадёт на `/onboarding`, но middleware может ещё не видеть `active` статус (webhook ещё не обработан). В этом случае middleware перенаправит на `/inactive`. **Это эпизодическая ситуация** — при обновлении страницы доступ появится. **MVP-решение:** документировать, не решать.
- **Страница `/inactive`:** Текущая реализация содержит ссылку "На главную" → `/`. Если пользователь только что оплатил — middleware проверит его статус повторно и пустит дальше. [Source: src/app/inactive/page.tsx]

### Project Structure Notes

- Всё выровнено с unified project structure:
  - `src/app/(app)/onboarding/page.tsx` — Server Component страницы
  - `src/features/onboarding/components/OnboardingScreen.tsx` — основной UI
  - `src/features/onboarding/components/OnboardingPostCard.tsx` — карточка поста
  - `src/features/onboarding/components/OnboardingScreenSkeleton.tsx` — скелетон
  - `src/features/onboarding/data/onboarding-config.ts` — конфигурация (статические данные)
  - `tests/unit/features/onboarding/` — тесты

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.6] — Acceptance Criteria
- [Source: _bmad-output/planning-artifacts/prd.md#FR10-FR13] — Функциональные требования onboarding
- [Source: _bmad-output/planning-artifacts/prd.md#Journey-1] — User Journey Анны (Happy Path)
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Onboarding-First-Value] — UX-флоу onboarding
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Visual-Design-Foundation] — Визуальный дизайн
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Component-Strategy] — Стратегия компонентов
- [Source: _bmad-output/planning-artifacts/architecture.md] — Feature-based структура, naming conventions
- [Source: src/app/api/checkout/route.ts#L54] — Success URL уже указывает на /onboarding
- [Source: src/app/(app)/layout.tsx] — Auth guard в layout
- [Source: src/lib/app-routes.ts] — Public paths (onboarding НЕ публичный)
- [Source: src/lib/supabase/middleware.ts] — Subscription check middleware
- [Source: _bmad-output/implementation-artifacts/stories/1-5-processing-stripe-webhooks-and-access-management.md] — Контекст webhook processing и subscription management

## Architecture Compliance

- [ ] **Project Structure:** Feature-based организация в `src/features/onboarding/`. Страница в `src/app/(app)/onboarding/`.
- [ ] **Naming Convention:** DB-поля в `snake_case` (не актуально для этой истории — нет работы с БД).
- [ ] **Component Pattern:** Smart Container (page.tsx) / Dumb UI (OnboardingScreen). Skeleton встроен в UI-компонент.
- [ ] **Error Handling:** Toast для системных ошибок (не актуально — нет fetch). Inline для форм (нет форм).
- [ ] **Accessibility:** WCAG 2.1 AA. Touch targets 44x44px. `aria-label` на WhatsApp-ссылке. Семантический HTML (`<main>`, `<section>`, `<nav>`).

## Library / Framework Requirements

- **Нет новых зависимостей.** Используются только уже установленные:
  - `next` (App Router, `next/link`, `next/font`)
  - `tailwindcss` (стилизация)
  - `lucide-react` (иконки: `MessageCircle`, `Video`, `Camera`, `FileText`, `ArrowRight`)
  - `@testing-library/react`, `vitest` (тестирование)

## Latest Tech Information

- Next.js App Router: `searchParams` доступны через `props` Server Component: `export default async function Page({ searchParams }: { searchParams: Promise<{ session_id?: string }> })`. В Next.js 15+ `searchParams` — это `Promise`, нужен `await`.
- Tailwind CSS v4: Использовать `@import 'tailwindcss'` и CSS-переменные в `oklch()`.
- Lucide React: Импорт иконок как `import { MessageCircle } from 'lucide-react'`.

## Project Context Reference

- PRD: FR10 (onboarding после оплаты), FR11 (топ-5 постов), FR12 (WhatsApp-ссылка), FR13 (управление контентом — отложено до Epic 4).
- UX: "Первые 3 минуты" — Анна должна понять структуру клуба, прочитать первый пост и вступить в WhatsApp.
- Architecture: Feature-based structure, Smart Container / Dumb UI pattern, Server + Client component split.

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
