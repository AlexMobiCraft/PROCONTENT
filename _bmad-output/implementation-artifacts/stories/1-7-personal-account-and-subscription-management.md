# Story 1.7: Личный кабинет и управление подпиской

Status: review

## Story

As a участница,
I want иметь возможность зайти в настройки и просмотреть/отменить свою подписку,
so that полностью контролировать свои платежи.

## Acceptance Criteria

1. **Given** авторизованная участница
   **When** она открывает раздел профиля
   **Then** отображается текущий статус её подписки
   **And** присутствует кнопка перехода в Stripe Customer Portal для управления биллингом

2. **Given** участница нажимает кнопку управления подпиской
   **When** отправляется запрос к серверу
   **Then** создается Stripe Customer Portal сессия
   **And** участница перенаправляется на безопасную страницу Stripe Customer Portal

3. **Given** участница находится в Stripe Customer Portal
   **When** она нажимает кнопку возврата
   **Then** она возвращается обратно на страницу профиля в приложении

## Tasks / Subtasks

- [x] **Review Follow-ups (AI) - Round 2**
  - [x] [AI-Review][Medium] Документация: обновить File List в истории, добавить `docs/stripe-supabase-nextjs16-auth-flow.md` и удаление `docs/supabase-magic-link-fix.md`
  - [x] [AI-Review][Medium] Оптимизация URL: использовать объект `Request` (`new URL(request.url).origin`) вместо `process.env.NEXT_PUBLIC_SITE_URL` для большей надежности [src/app/api/stripe/portal/route.ts]
  - [x] [AI-Review][Medium] Улучшить UX: добавить видимую пользователю обработку ошибки загрузки профиля, чтобы не было "Silent Failure" [src/app/(app)/profile/page.tsx]

- [x] **Review Follow-ups (AI)**
  - [x] [AI-Review][High] Обновить миграцию 002_add_subscription_fields.sql: изменить CHECK constraint для subscription_status, чтобы разрешить все статусы Stripe (trialing, past_due, unpaid) [supabase/migrations/002_add_subscription_fields.sql:7]
  - [x] [AI-Review][Medium] Обработать ошибки Supabase: логировать и обрабатывать объект error после вызовов .single() [src/app/(app)/profile/page.tsx:17, src/app/api/stripe/portal/route.ts:19]
  - [x] [AI-Review][Medium] Сделать безопасный парсинг дат: добавить проверку валидности даты в formatDate перед форматированием [src/features/profile/components/SubscriptionCard.tsx:8]
  - [x] [AI-Review][Low] Улучшить Skeleton загрузки: выровнять размеры и отступы в loading.tsx с реальным компонентом ProfileScreen [src/app/(app)/profile/loading.tsx:1]
  - [x] [AI-Review][Low] Улучшить обработку ошибок Stripe: возвращать более детальные и понятные пользователю сообщения об ошибках [src/app/api/stripe/portal/route.ts:43]

- [x] **Task 1: Разработка страницы Профиля (Личного кабинета)**
  - [x] Subtask 1.1: Создать страницу `src/app/(app)/profile/page.tsx` (Server Component). Маршрут должен быть защищен существующим `(app)/layout.tsx`.
  - [x] Subtask 1.2: Создать клиентский или серверный UI компонент (например, `src/features/profile/components/ProfileScreen.tsx` и `ProfileCard.tsx`) для отображения информации.
  - [x] Subtask 1.3: Запросить данные профиля из Supabase: `email` (из `auth.users` или сессии), `subscription_status`, `current_period_end` из таблицы `profiles`.

- [x] **Task 2: Интеграция Stripe Customer Portal**
  - [x] Subtask 2.1: Создать Route Handler (например, `src/app/api/stripe/portal/route.ts`) или Server Action для генерации сессии Stripe Customer Portal.
  - [x] Subtask 2.2: Внутри обработчика проверить авторизацию (через Supabase auth) и получить `stripe_customer_id` пользователя из таблицы `profiles`.
  - [x] Subtask 2.3: Вызвать `stripe.billingPortal.sessions.create({ customer: stripeCustomerId, return_url: '...' })`. `return_url` должен вести обратно на страницу профиля.
  - [x] Subtask 2.4: Вернуть URL портала на клиент для перенаправления. Обработать ошибку, если пользователь не имеет `stripe_customer_id`.

- [x] **Task 3: Интеграция UI и логики портала**
  - [x] Subtask 3.1: Добавить в UI профиля отображение текущего статуса (например, "Активна до [дата]" или "Отменена").
  - [x] Subtask 3.2: Добавить кнопку "Управление подпиской". При нажатии вызывать логику генерации ссылки портала и делать редирект (или использовать `window.location.href`).
  - [x] Subtask 3.3: Добавить Skeleton-загрузки для страницы профиля и состояние загрузки (spinner/disabled) для кнопки перехода в портал.

- [x] **Task 4: Тестирование**
  - [x] Subtask 4.1: Написать Unit-тесты для компонента профиля.
  - [x] Subtask 4.2: Написать тесты для Route Handler / Server Action логики портала.

## Dev Notes

- **Stripe Customer Portal:** Позволяет делегировать всю логику изменения платежных методов, отмены и изменения тарифов самому Stripe. Это соответствует NFR9 (управление картами делегировано Stripe).
- **Архитектурные рамки:** Feature-based структура. Логику и компоненты, специфичные для профиля, размещать в `src/features/profile/`.
- **Component Pattern:** Страница `page.tsx` выступает как Smart Container (Server Component), который получает данные и передает их в Dumb UI компоненты (например, `ProfileScreen` или `SubscriptionCard`).
- **Связь со Story 1.5:** Webhooks из Story 1.5 уже обрабатывают события отмены (`customer.subscription.deleted` и `customer.subscription.updated`). Изменения, сделанные пользователем в Customer Portal, автоматически приведут к отправке вебхуков и обновлению статуса в базе (что мы уже умеем обрабатывать).

### Project Structure Notes

- Страница: `src/app/(app)/profile/page.tsx`
- Компоненты: `src/features/profile/components/...`
- API (если используется Route Handler): `src/app/api/stripe/portal/route.ts`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.7]
- [Source: _bmad-output/planning-artifacts/prd.md#FR2] (Отмена подписки через личный кабинет)
- [Source: _bmad-output/planning-artifacts/prd.md#FR4] (Просмотр статуса)
- [Source: src/lib/stripe/index.ts] - инициализированный клиент Stripe.

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

_нет_

### Completion Notes List

- Реализована страница профиля `src/app/(app)/profile/page.tsx` (Server Component) — запрашивает email, display_name, subscription_status, current_period_end, stripe_customer_id из таблицы `profiles`.
- Создан `ProfileScreen.tsx` (Client Component) — layout страницы с блоком аккаунта и карточкой подписки.
- Создан `SubscriptionCard.tsx` (Client Component) — показывает статус подписки с датой окончания, кнопку "Управление подпиской" (скрыта если нет stripe_customer_id), состояние загрузки, отображение ошибок.
- Реализован Route Handler `POST /api/stripe/portal` — проверяет авторизацию через Supabase, получает stripe_customer_id из profiles, создаёт Stripe Customer Portal сессию, возвращает URL.
- Создан `loading.tsx` для Skeleton-загрузки страницы профиля.
- Написано 14 unit-тестов для SubscriptionCard (все ✓).
- Написано 7 unit-тестов для portal route handler (все ✓).
- TypeScript: без ошибок. Lint: новые файлы чистые (pre-existing ошибки в других файлах).
- ✅ Resolved review finding [High]: Создана миграция 005 — добавлены `past_due` и `unpaid` в CHECK constraint subscription_status (финализирует набор всех Stripe-статусов).
- ✅ Resolved review finding [Medium]: Логирование ошибок Supabase добавлено в page.tsx и portal/route.ts после вызовов `.single()`.
- ✅ Resolved review finding [Medium]: `formatDate` в SubscriptionCard.tsx теперь проверяет валидность даты через `isNaN(date.getTime())`, возвращает исходную строку при невалидном значении.
- ✅ Resolved review finding [Low]: Skeleton в loading.tsx выровнен с реальным ProfileScreen — скорректированы высоты, ширины и отступы блоков.
- ✅ Resolved review finding [Low]: Ошибка Stripe логируется с `error.message`; пользователю возвращается понятное сообщение "Не удалось открыть портал управления подпиской. Попробуйте позже."
- Итого тестов: 23 (15 SubscriptionCard + 8 portal route) — все ✓.
- ✅ Resolved review finding [Medium] Round 2: `POST(request: Request)` — `return_url` теперь формируется через `new URL(request.url).origin` без зависимости от env var; тесты обновлены (7 тестов, +1 тест "использует origin из URL запроса").
- ✅ Resolved review finding [Medium] Round 2: `page.tsx` — при `profileError` рендерит видимое сообщение об ошибке вместо silent failure.
- ✅ Resolved review finding [Medium] Round 2: File List обновлён — добавлен `docs/stripe-supabase-nextjs16-auth-flow.md`, отмечено удаление `docs/supabase-magic-link-fix.md`.

### File List

- `src/app/(app)/profile/page.tsx` (новый)
- `src/app/(app)/profile/loading.tsx` (новый)
- `src/features/profile/components/ProfileScreen.tsx` (новый)
- `src/features/profile/components/SubscriptionCard.tsx` (новый)
- `src/app/api/stripe/portal/route.ts` (новый)
- `tests/unit/features/profile/components/SubscriptionCard.test.tsx` (новый)
- `tests/unit/app/api/stripe/portal/route.test.ts` (новый)
- `_bmad-output/implementation-artifacts/stories/1-7-personal-account-and-subscription-management.md` (обновлён)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (обновлён)
- `supabase/migrations/005_add_past_due_unpaid_status.sql` (новый)
- `src/app/(app)/profile/page.tsx` (обновлён — логирование ошибки Supabase)
- `src/app/api/stripe/portal/route.ts` (обновлён — логирование ошибок Supabase и Stripe, улучшено сообщение об ошибке)
- `src/features/profile/components/SubscriptionCard.tsx` (обновлён — безопасный парсинг дат)
- `src/app/(app)/profile/loading.tsx` (обновлён — выровнен skeleton)
- `tests/unit/features/profile/components/SubscriptionCard.test.tsx` (обновлён — тест невалидной даты)
- `tests/unit/app/api/stripe/portal/route.test.ts` (обновлён — тесты ошибки Supabase и сообщения Stripe)
- `docs/stripe-supabase-nextjs16-auth-flow.md` (новый, добавлен в sprint)
- `docs/supabase-magic-link-fix.md` (удалён)
- `src/app/api/stripe/portal/route.ts` (обновлён — Request param, `new URL(request.url).origin`)
- `src/app/(app)/profile/page.tsx` (обновлён — видимый UI при ошибке загрузки профиля)
- `tests/unit/app/api/stripe/portal/route.test.ts` (обновлён — новая сигнатура POST, тест origin из URL)
