# Story 1.5: Обработка Stripe Webhooks и управление доступом

Status: review

## Story

As a создательница,
I want Stripe автоматически передавать данные об оплате на платформу через Webhooks,
so that система могла автоматически выдавать доступ к контенту (active) или забирать его (inactive) без моего ручного вмешательства.

## Acceptance Criteria

1. **Given** Stripe отправляет событие `checkout.session.completed` или `invoice.payment_succeeded`
   **When** платформа получает webhook
   **Then** webhook валидируется по цифровой подписи Stripe (NFR8)
   **And** базовая информация о подписке обновляется в базе данных Supabase (если возможно привязать к пользователю по email или через сессию)

2. **Given** Stripe отправляет событие `customer.subscription.deleted`, `customer.subscription.canceled` или `invoice.payment_failed`
   **When** платформа получает webhook
   **Then** webhook валидируется по цифровой подписи Stripe
   **And** профиль пользователя в Supabase обновляется (статус подписки = `inactive`)
   **And** текущая активная сессия пользователя должна принудительно истечь / доступ блокируется (NFR7 - в течение 60 секунд)

3. **Given** webhook отправляется повторно (Stripe retries)
   **When** платформа получает webhook
   **Then** система не падает и не дублирует данные
   **And** обработка идемпотентна (NFR18) на базе события из Stripe

4. **Given** возникает ошибка при обработке webhook (например, БД недоступна или Stripe secret неверен)
   **When** система пытается обработать событие
   **Then** возвращается код ошибки (400 или 500) для Stripe
   **And** ошибка логируется для последующего административного анализа (NFR19)

5. **Given** пользователь отменяет подписку, но оплаченный период еще не истек (Stripe event `customer.subscription.updated` с `cancel_at_period_end: true`)
   **When** Stripe отправляет событие об актуальном статусе
   **Then** статус подписки обновляется в БД, но доступ (`active`) сохраняется до конца текущего оплаченного периода

## Tasks / Subtasks

- [x] **Task 1: Настройка базы данных Supabase** (AC: 1, 2, 5)
  - [x] Subtask 1.1: Создать SQL-скрипт/миграцию для добавления полей подписки в таблицу пользователей (например, `public.users`). Необходимо: `subscription_status` (enum: 'active', 'inactive', 'canceled'), `stripe_customer_id` (string), `stripe_subscription_id` (string), `current_period_end` (timestamptz).
  - [x] Subtask 1.2: Обновить сгенерированные типы TypeScript (`src/types/supabase.ts`) или вручную добавить нужные эндпоинты, убедившись в использовании паттерна `snake_case` (в соответствии с архитектурными решениями).
  - [x] Subtask 1.3: Настроить RLS политики: webhook (через Service Role Key) имеет право обновлять эти поля `users`, а обычный пользователь может только делать SELECT своих собственных записей (для проверки доступа).

- [x] **Task 2: Реализация основы Stripe Webhook Route Handler** (AC: 1, 3, 4)
  - [x] Subtask 2.1: Создать Route Handler `src/app/api/webhooks/stripe/route.ts` (POST-обработчик).
  - [x] Subtask 2.2: Использовать `request.text()` для извлечения сырого (raw) payload, чтобы валидация подписи прошла успешно (JSON parsing ломает подпись webhook'а в Stripe).
  - [x] Subtask 2.3: Реализовать проверку подписи с использованием `stripe.webhooks.constructEvent(payload, signature, process.env.STRIPE_WEBHOOK_SECRET!)`. В случае ошибки проверки возвращать `400 Bad Request`.
  - [x] Subtask 2.4: Реализовать идемпотентность (NFR18). Операции с БД (Update/Upsert) должны опираться на уникальный ID подписки или клиента из Stripe.

- [x] **Task 3: Обработка специфических событий Stripe** (AC: 1, 2, 5)
  - [x] Subtask 3.1: Обрабатывать событие `checkout.session.completed`. Сохранять `stripe_customer_id` и `stripe_subscription_id`. Примечание: так как сессия создается *ДО* авторизации, связывать запись нужно по email (из `session.customer_details.email`), обновляя таблицу `users`, если такой email уже зарегистрирован, либо ожидать, что Story 1.7 (Onboarding) завершит привязку при регистрации. В рамках текущей задачи - написать функцию `handleCheckoutSessionCompleted`, выполняющую обновление БД (Supabase), если пользователь найден по email.
  - [x] Subtask 3.2: Обрабатывать событие `invoice.payment_succeeded`. Продлевать/обновлять `current_period_end` у соответствующего пользователя.
  - [x] Subtask 3.3: Обрабатывать событие `customer.subscription.deleted`. Находить пользователя по `stripe_subscription_id` или `stripe_customer_id` и переводить `subscription_status` в `inactive`. (AC: 2)
  - [x] Subtask 3.4: Обрабатывать событие `customer.subscription.updated`. Отслеживать поле `cancel_at_period_end`.
  - [x] Subtask 3.5: Возвращать `200 OK` для неизвестных/необрабатываемых событий Stripe, чтобы предотвратить повторные отправки (retries).

- [x] **Task 4: Реализация принудительной инвалидации сессии (NFR7)** (AC: 2)
  - [x] Subtask 4.1: Определить архитектурный паттерн для отключения пользователя. Один вариант: В `customer.subscription.deleted`, если вы используете `supabase.auth.admin.deleteUser` (радикально, но эффективно). Другой: создать `middleware.ts` (Next.js), который будет проверять статус подписки по API/Cookies и редиректить с `(app)/*` на `/login` при `inactive`. Т.к. NFR7 требует инвалидации за 60 секунд, проще всего проверять статус подписки (из `public.users`) при входе в `layout.tsx` или в Middleware. Сделать реализацию ограничения доступа (отключить сессию/доступ) при статусе `inactive`.

- [x] **Task 5: Логирование и конфигурация** (AC: 4)
  - [x] Subtask 5.1: При ошибке внутри webhook обработчика логировать ошибку (`console.error`) для администраторов (NFR19).
  - [x] Subtask 5.2: Вернуть `500 Internal Server Error`, если ошибка произошла со стороны нашей системы (например, БД Supabase упала), чтобы Stripe мог начать механизм retries.
  - [x] Subtask 5.3: Добавить `STRIPE_WEBHOOK_SECRET` в `.env.local` и `.env.example`.
  - [x] Subtask 5.4: Инициализировать Supabase Admin Client с помощью `SUPABASE_SERVICE_ROLE_KEY` в `route.ts`, чтобы webhook имел права обойти RLS на редактирование полей подписки. (Необходимо добавить в env ключи `SUPABASE_SERVICE_ROLE_KEY`).

- [x] **Task 6: Базовое тестирование Webhook Handler**
  - [x] Subtask 6.1: Написать unit test(s) для `src/app/api/webhooks/stripe/route.ts` проверяющий поведение при валидной подписи, невалидной подписи, необрабатываемом событии, и проверку 500 ошибки при неудаче с БД.

## Dev Notes

### Критически важный контекст
- **Story 1.4:** В `api/checkout` Stripe Checkout сессия создается с `mode: 'subscription'`. Пользователь заходит на Stripe, вводит email, оплачивает. Когда придет вебхук `checkout.session.completed`, у нас **будет `customer_email` от Stripe**. Пользователя в Supabase Auth может еще не быть (так как регистрация/вход через OTP, и он мог еще не регистрироваться).
- **Связка пользователя и подписки:** Если пользователь с таким email уже есть в `public.users`, вебхук должен обновить его статус и привязать `stripe_customer_id`. Если пользователя еще нет, вебхук МОЖЕТ проигнорировать (в этом случае в Story 1.7 "Onboarding" при регистрации мы сами сможем дернуть Stripe/Supabase и привязать статус на основе возвращенного `session_id`). Тем не менее, вебхук обязан корректно обновить существующего пользователя.
- NFR7 (Инвалидация <60 секунд при неуплате/отмене): Если сработает webhook на удаление подписки, БД (Supabase) получает флаг `inactive`. Текущее решение требует проверки подписки! В Next.js можно проверять `subscription_status` на серверных/клиентских рутах перед рендером контента.

### Архитектурные границы
- Route Handler `src/app/api/webhooks/stripe/route.ts` должен быть без директивы `'use client'`.
- Для работы с базой из вебхука ВАЖНО использовать **Supabase Server Client** (желательно admin-клиент для обхода RLS). В `lib/supabase/server.ts` уже может быть клиент. НО `server.ts` обычно использует cookies запроса. Вебхук НЕ имеет cookies.
- **Внимание:** В вебхуке необходимо использовать `createClient` из `@supabase/supabase-js`, передавая туда `NEXT_PUBLIC_SUPABASE_URL` и `SUPABASE_SERVICE_ROLE_KEY` для авторизации на уровне сервиса (admin role). Обычный клиент SSR опирается на хранилище cookies через `cookies()`, чего нет/что не нужно в вебхуке при выполнении фоновых задач. Учтите это при создании сервисного клиента.
```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // !!! использовать его
);
```

### Безопасность и Валидация (Вебхук Stripe)
- В Next.js App Router (Route Handlers) для валидации Stripe Webhook необходим **сырой payload** (тело запроса в виде текста или буфера).
- Использовать `const payload = await request.text()` (или `.arrayBuffer()`). Убедиться, что `constructEvent` не жалуется на формат.

### План для базы данных
Создается структура (если нет):
- `stripe_customer_id` TEXT
- `stripe_subscription_id` TEXT
- `subscription_status` TEXT (enum 'active', 'inactive', 'canceled')
- `current_period_end` TIMESTAMP WITH TIME ZONE

### Тестовый фреймворк
Используется Vitest, `vi.mock` для изоляции Stripe SDK, заглушки для Supabase клиента и `NextRequest`.

## Architecture Compliance

- [x] **Project Structure:** Route Handler для вебхуков Stripe располагается в `src/app/api/webhooks/stripe/route.ts`. SQL добавляется как миграция или исполняемый код локально.
- [x] **Naming Convention:** Supabase колонки остаются в `snake_case` (например, `stripe_subscription_id`).
- [x] **Error Handling Rules:** Системные ошибки (например, сбой БД внутри вебхука) логируются в консоль (`console.error`) и отдаются в Stripe как HTTP 500 для провоцирования Retry. Неизвестные события отдают HTTP 200. Bad signature HTTP 400.
- [x] **Data Fetching/Modifying Boundaries:** Вебхук использует исключительно Server-секреты (Stripe Webhook Secret, Supabase Service Role Key) для безопасной мутации данных (NFR8). Не имеет доступа к данным клиентской сессии (cookie/local Storage).

## Library / Framework Requirements

- `stripe` (уже установлен в Story 1.4)
- `@supabase/supabase-js` (для admin/service-role клиента внутри вебхука).

## Latest Tech Information

- `request.text()` — предпочтительный способ получения raw text from Request в App Router для Stripe `constructEvent`.
- Не использовать `bodyParser: false` в конфигурации маршрутов App Router, эта старая директива из Pages Router (`export const config = { api: { bodyParser: false } }` НЕ работает в App Router). В новой версии мы просто вызываем `request.text()`.

## Project Context Reference

- PRD: NFR7 (auth <60s revocation), NFR8 (Stripe Signature verification), NFR18 (Idempotent webhooks), NFR19 (Logging).
- FR1-FR5: Subscription check logic.
- Architecture: Stripe Webhooks pattern to Supabase Auth. App Router endpoints. Hybrid Error Handling approach.

## Dev Agent Record

### Implementation Plan
- Архитектурное решение: Stripe API 2026-02-25.clover использует `invoice.parent.subscription_details.subscription` вместо прямого `invoice.subscription`. Адаптированы все обработчики invoice событий.
- Для Subscription `current_period_end` в новом API используется `cancel_at` (дата когда подписка будет отменена при `cancel_at_period_end=true`).
- Supabase admin client создаётся без `Database` generic из-за ограничений type inference в `@supabase/ssr` v0.9.0 + `@supabase/supabase-js` v2.98.0.
- Middleware использует явный type cast для результата `.select()` — обходное решение для той же проблемы инференса.
- NFR7 реализован через проверку в `src/lib/supabase/middleware.ts`: аутентифицированный пользователь с `subscription_status = 'inactive'` редиректится на `/`.

### Completion Notes
- Реализованы все 6 Tasks / 15 Subtasks
- 15 новых unit-тестов для webhook route (route.test.ts)
- 4 новых теста для subscription-инвалидации в middleware.test.ts
- TypeCheck: ✅ 0 ошибок
- Все 137 тестов: ✅ 100% pass

## File List

- `supabase/migrations/002_add_subscription_fields.sql` — SQL миграция полей подписки
- `src/types/supabase.ts` — добавлены поля подписки + тип `SubscriptionStatus`
- `src/app/api/webhooks/stripe/route.ts` — новый Route Handler (Tasks 2, 3, 5)
- `src/lib/supabase/middleware.ts` — добавлена проверка subscription_status (Task 4)
- `.env.example` — добавлены `STRIPE_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`
- `.env.local` — добавлены placeholder-значения новых переменных
- `tests/unit/app/api/webhooks/stripe/route.test.ts` — unit-тесты webhook (Task 6)
- `tests/unit/middleware.test.ts` — добавлены тесты subscription-инвалидации

## Change Log

- 2026-03-11: Story 1.5 реализована. Добавлены Stripe Webhook обработчики, SQL миграция полей подписки, middleware-инвалидация при inactive-статусе, unit-тесты. Все AC выполнены.

## Completion Status

- [x] Implementation complete
- [x] Tests passing
- [ ] Code review resolved
- [ ] Ready for next story
