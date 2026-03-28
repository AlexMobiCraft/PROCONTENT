# Story 3.5: Управление email-предпочтениями

Status: in-progress

## Story

As a участница,
I want иметь возможность отписаться от рассылок,
So that контролировать входящий поток писем.

## Acceptance Criteria

1. **Given** авторизованная участница в разделе профиля (`/profile`)
   **When** она переключает тумблер "Email-уведомления"
   **Then** её предпочтение сохраняется в базе данных (`profiles.email_notifications_enabled`)

2. **Given** участница отключила email-уведомления
   **When** автор публикует новый пост и срабатывает рассылка
   **Then** система исключает её из списка получателей

3. **Given** полученное email-уведомление о новом посте
   **When** участница нажимает ссылку "Отписаться" в подвале письма
   **Then** выполняется `GET` на signed unsubscribe URL, система отключает email-уведомления при валидном токене и перенаправляет участницу на публичную страницу результата `/email-preferences?status=unsubscribed`

4. **Given** полученное email-уведомление
   **When** email-клиент (Gmail, Yahoo и др.) предлагает one-click unsubscribe в заголовке
   **Then** система обрабатывает запрос через `POST /api/email/unsubscribe?uid=...&ts=...&sig=...`, отключает уведомления без авторизации и возвращает `200 text/plain; charset=utf-8` с телом `OK`

5. **Given** signed unsubscribe token невалиден, повреждён или истёк
   **When** система получает запрос на unsubscribe
   **Then** `GET` перенаправляет на `/email-preferences?status=invalid_or_expired`, а `POST` возвращает `400 text/plain; charset=utf-8` без изменения данных

6. **Given** участница уже отписана от email-уведомлений
   **When** приходит повторный `GET` или `POST` запрос на unsubscribe с валидным токеном
   **Then** операция считается идемпотентной, возвращает успешный результат и оставляет `email_notifications_enabled = false`

7. **Given** авторизованная участница открывает `/profile`, но строка `profiles` для неё отсутствует (`PGRST116`)
   **When** рендерится страница профиля
   **Then** система не показывает интерактивный toggle email-предпочтений и не пытается выполнять клиентскую мутацию в `profiles`

## Tasks / Subtasks

- [x] Task 1: Миграция БД — добавить поле `email_notifications_enabled` (AC: #1)
  - [x] 1.1: Создать SQL-миграцию: `ALTER TABLE profiles ADD COLUMN email_notifications_enabled boolean DEFAULT true NOT NULL`
  - [x] 1.2: Обновить типы в `src/types/supabase.ts` (добавить поле в `profiles` Row/Insert/Update)

- [x] Task 2: Компонент `EmailPreferencesCard` (AC: #1)
  - [x] 2.1: Создать `src/features/profile/components/EmailPreferencesCard.tsx` — Dumb UI, `'use client'`
  - [x] 2.2: Реализовать контролируемый toggle (Switch из @base-ui/react или стилизованный checkbox) с `checked`, `disabled`, `isLoading` props и `id="email-preferences"`
  - [x] 2.3: Добавить тексты, accessibility-атрибуты и визуальные состояния для enabled / disabled / loading
  - [x] 2.4: Добавить `EmailPreferencesCard` в `ProfileScreen.tsx` (между SubscriptionCard и PasswordResetCard)

- [x] Task 3: Обновить серверную страницу профиля (AC: #1)
  - [x] 3.1: В `src/app/(app)/profile/page.tsx` добавить `email_notifications_enabled` в select-запрос
  - [x] 3.2: Передать в `ProfileScreen` значение `emailNotificationsEnabled`, `userId` и флаг `canManageEmailPreferences`
  - [x] 3.3: В `ProfileScreen.tsx` реализовать optimistic update, rollback, success/error toast и мутацию `profiles.email_notifications_enabled` через client Supabase
  - [x] 3.4: Если профиль отсутствует (`PGRST116`), не рендерить интерактивный `EmailPreferencesCard` и не выполнять мутацию

- [x] Task 4: Фильтрация при рассылке (AC: #2)
  - [x] 4.1: В `src/app/api/notifications/new-post/route.ts` → `fetchAllSubscribers()` добавить `.eq('email_notifications_enabled', true)` в Supabase-запрос
  - [x] 4.2: Обновить тесты route.test.ts — добавить тест-кейс "пользователь с отключенными уведомлениями исключён из рассылки"

- [x] Task 5: Unsubscribe API (AC: #3, #4, #5, #6)
  - [x] 5.1: Создать `src/app/api/email/unsubscribe/route.ts` — endpoint с обработкой `GET` и `POST`
  - [x] 5.2: Авторизация через signed token (`uid`, `ts`, `sig`), НЕ через сессию; canonical string: `${uid}:${ts}`
  - [x] 5.3: Валидировать HMAC-SHA256 подпись (`NOTIFICATION_API_SECRET`), `uid` как UUID, `ts` как Unix seconds integer, TTL = 30 дней; сравнение `sig` выполнять constant-time, timestamp из будущего считать невалидным
  - [x] 5.4: При валидном токене — обновить `email_notifications_enabled = false` через admin client; операция должна быть идемпотентной; отсутствие профиля трактовать как invalid unsubscribe request
  - [x] 5.5: `GET` при успехе — redirect на `/email-preferences?status=unsubscribed`, при невалидном/истекшем токене — redirect на `/email-preferences?status=invalid_or_expired`
  - [x] 5.6: `POST` при успехе — вернуть `200 text/plain; charset=utf-8`, body = `OK`, при невалидном/истекшем токене — `400 text/plain; charset=utf-8`

- [x] Task 6: Публичная страница результата unsubscribe (AC: #3, #5)
  - [x] 6.1: Создать `src/app/(public)/email-preferences/page.tsx` — публичную страницу без требования активной сессии
  - [x] 6.2: Читать `searchParams.status` и отображать success/error state для `unsubscribed` и `invalid_or_expired`
  - [x] 6.3: Добавить fallback UI для неизвестного `status` без раскрытия чувствительных деталей

- [x] Task 7: Обновить email-шаблоны и заголовки (AC: #3, #4)
  - [x] 7.1: В `src/app/api/notifications/new-post/route.ts` добавить email-заголовки `List-Unsubscribe` и `List-Unsubscribe-Post` (RFC 8058) с индивидуальным signed URL для каждого подписчика в формате `/api/email/unsubscribe?uid=...&ts=...&sig=...`
  - [x] 7.2: Обновить footer в `new-post.ts` — ссылка "Отписаться" ведёт на тот же signed URL (GET → unsubscribe + redirect на `/email-preferences?status=unsubscribed`)
  - [x] 7.3: Обновить `EmailMessage` интерфейс в `src/lib/email/index.ts` — добавить опциональное поле `headers`
  - [x] 7.4: Обновить `sendEmailBatch()` — прокидывать `headers` в каждый item `resend.batch.send(...)`

- [x] Task 8: Тестирование
  - [x] 8.1: Unit-тесты для `EmailPreferencesCard` и `ProfileScreen` (рендер, controlled toggle, optimistic update, success/error toast, rollback)
  - [x] 8.2: Unit-тесты для unsubscribe route (валидный токен, невалидный, истекший, timestamp из будущего, malformed params, отсутствующий профиль, идемпотентный повторный запрос)
  - [x] 8.3: Unit-тесты для `src/app/(public)/email-preferences/page.tsx` — `status=unsubscribed`, `status=invalid_or_expired`, unknown status fallback
  - [x] 8.4: Обновить тесты email-шаблонов — проверить наличие signed unsubscribe URL и заголовков `List-Unsubscribe` / `List-Unsubscribe-Post`
  - [x] 8.5: Обновить тесты route handler — фильтрация по `email_notifications_enabled` и уникальный unsubscribe URL на каждого получателя

## Dev Notes

### Критические guardrails

- **НЕ создавать отдельную страницу `/settings`** — email-предпочтения размещаются на существующей странице `/profile` как новая карточка `EmailPreferencesCard`
- **НЕ использовать `'use server'`** на lib-модулях — это превращает экспорты в публичные Server Action endpoints (lesson из Story 3.4)
- **snake_case для БД** — поле называется `email_notifications_enabled`, НЕ `emailNotificationsEnabled`
- **Оптимистичное обновление живёт в `ProfileScreen`, не в `EmailPreferencesCard`** — `EmailPreferencesCard` остаётся Dumb UI; при ошибке — rollback + Toast
- **One-click unsubscribe обязателен** — Gmail и Yahoo требуют RFC 8058 `List-Unsubscribe-Post` заголовок с февраля 2024. Без него письма могут попадать в спам (NFR21)
- **НЕ редиректить email unsubscribe flow на auth-only `/profile`** — результат `GET` должен вести на публичную страницу `/email-preferences`, иначе пользователь без активной сессии попадёт на `/login` и не увидит результат операции
- **Если `profiles` row отсутствует, не делать молчаливый upsert в рамках этой истории** — для `PGRST116` toggle не показывается, а unsubscribe API возвращает invalid outcome без изменения данных

### Архитектурные решения

**Signed Token для Unsubscribe (НЕ session auth):**
- Email-клиенты отправляют `GET`/`POST` без cookies/сессии
- Query params: `uid`, `ts`, `sig`
- Canonical string для подписи: `${uid}:${ts}`
- Алгоритм подписи: HMAC-SHA256 с секретом `NOTIFICATION_API_SECRET`
- `ts` хранится в формате Unix seconds
- `sig` кодируется в hex
- `uid` валидируется как UUID
- Сравнение подписи выполняется constant-time
- `ts` из будущего считается невалидным
- TTL токена: 30 дней
- `GET` используется для перехода из footer-ссылки, `POST` — для one-click unsubscribe из email-клиентов
- Операция unsubscribe идемпотентна; отдельная replay-защита в рамках этой истории не требуется
- `NOTIFICATION_API_SECRET` уже существует в `.env` (Story 3.4)

**Контракт Unsubscribe endpoint:**
- `GET /api/email/unsubscribe?uid=...&ts=...&sig=...`
- При валидном токене: обновить `email_notifications_enabled = false`, затем redirect на `/email-preferences?status=unsubscribed`
- При невалидном/истекшем токене: redirect на `/email-preferences?status=invalid_or_expired`
- `POST /api/email/unsubscribe?uid=...&ts=...&sig=...`
- При валидном токене: `200 text/plain; charset=utf-8`, body = `OK`
- При невалидном/истекшем токене: `400 text/plain; charset=utf-8`
- Если профиль не найден: `GET` ведёт на error redirect, `POST` возвращает `400 text/plain; charset=utf-8`

**Контракт публичной страницы результата:**
- `GET /email-preferences?status=unsubscribed|invalid_or_expired`
- Страница публичная, без требования активной сессии
- `status=unsubscribed` показывает подтверждение успешной отписки
- `status=invalid_or_expired` показывает безопасное сообщение об ошибке без раскрытия деталей токена
- Неизвестный `status` показывает нейтральный fallback UI

**Расширение EmailMessage интерфейса:**
```typescript
// src/lib/email/index.ts
export interface EmailMessage {
  to: string
  subject: string
  html: string
  text: string
  headers?: Record<string, string>  // NEW: для List-Unsubscribe
}
```

**Resend поддерживает headers напрямую:**
```typescript
resend.emails.send({
  from: ...,
  to: ...,
  subject: ...,
  html: ...,
  headers: {
    'List-Unsubscribe': '<https://...unsubscribe?token=...>',
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  }
})
```

### Паттерн Smart/Dumb для новой карточки

**EmailPreferencesCard (Dumb UI)** — принимает props:
```typescript
interface EmailPreferencesCardProps {
  id?: string
  emailNotificationsEnabled: boolean  // camelCase для component props
  onToggle: (enabled: boolean) => void
  isLoading?: boolean
  isDisabled?: boolean
}
```

**ProfileScreen (Smart Container)** — управляет мутацией:
```typescript
// Оптимистичное обновление через локальный useState
const [emailEnabled, setEmailEnabled] = useState(initialValue)
const [isEmailSaving, setIsEmailSaving] = useState(false)

async function handleEmailToggle(enabled: boolean) {
  const prev = emailEnabled
  setEmailEnabled(enabled) // optimistic
  setIsEmailSaving(true)
  const supabase = createClient()
  const { error } = await supabase
    .from('profiles')
    .update({ email_notifications_enabled: enabled })
    .eq('id', userId)
  if (error) {
    setEmailEnabled(prev) // rollback
    toast.error('Napaka pri shranjevanju nastavitev')
    setIsEmailSaving(false)
    return
  }
  toast.success(enabled ? 'E-poštna obvestila so vklopljena' : 'E-poštna obvestila so izklopljena')
  setIsEmailSaving(false)
}
```

### Существующий код для изменения

**`src/app/api/notifications/new-post/route.ts`** — Текущий запрос подписчиков (строка ~55):
```typescript
// ТЕКУЩЕЕ:
.in('subscription_status', ['active', 'trialing'])
.not('email', 'is', null)

// НУЖНО ДОБАВИТЬ:
.eq('email_notifications_enabled', true)
```

**`src/lib/email/templates/new-post.ts`** — Footer (строка ~75):
```html
<!-- ТЕКУЩЕЕ: ссылка без signed unsubscribe flow -->
<a href="${sanitizeHref(unsubscribeUrl)}">nastavitve e-pošte</a>

<!-- НУЖНО: signed unsubscribe URL для каждого подписчика,
     который делает GET /api/email/unsubscribe?uid=...&ts=...&sig=...
     и затем redirect на /email-preferences?status=unsubscribed -->
```

**`src/app/(app)/profile/page.tsx`** — Select (строка ~25):
```typescript
// ТЕКУЩЕЕ:
.select('email, display_name, subscription_status, current_period_end, stripe_customer_id')

// НУЖНО ДОБАВИТЬ email_notifications_enabled и передать user.id / canManageEmailPreferences:
.select('email, display_name, subscription_status, current_period_end, stripe_customer_id, email_notifications_enabled')
```

**`src/features/profile/components/ProfileScreen.tsx`** — Добавить карточку (строка ~40):
```tsx
// После SubscriptionCard, перед PasswordResetCard
{canManageEmailPreferences && (
  <EmailPreferencesCard
    id="email-preferences"
    emailNotificationsEnabled={emailEnabled}
    onToggle={handleEmailToggle}
    isLoading={isEmailSaving}
  />
)}
```

**`src/app/(public)/email-preferences/page.tsx`** — Новая публичная страница результата:
```typescript
interface EmailPreferencesPageProps {
  searchParams: Promise<{ status?: string }>
}

// status=unsubscribed | invalid_or_expired | unknown
```

### Текст UI (словенский язык)

- Заголовок карточки: "E-poštna obvestila"
- Описание: "Prejemajte obvestila o novih objavah na vaš e-poštni naslov"
- Toggle label: "Obvestila o novih objavah"
- Toast success (вкл): "E-poštna obvestila so vklopljena"
- Toast success (выкл): "E-poštna obvestila so izklopljena"
- Toast error: "Napaka pri shranjevanju nastavitev"
- Public unsubscribe page confirmation: "Uspešno ste se odjavili od e-poštnih obvestil"
- Public unsubscribe page error: "Povezava za odjavo je neveljavna ali je potekla"
- Public unsubscribe page fallback: "Status odjave ni na voljo"

### Previous Story Intelligence (Story 3.4)

- **Resend batch API** — `sendEmailBatch()` в `src/lib/email/index.ts` поддерживает батчи по 100 писем
- **Security patterns:** `timingSafeEqual` для сравнения секретов, `sanitizeHref` для URL в письмах, `safeTitle` для CRLF-защиты
- **Pagination:** `fetchAllSubscribers()` использует `.range()` пагинацию с PAGE_SIZE=1000
- **Deferred items из 3.4:** "Unsubscribe link is not one-click" — это основная задача Story 3.5
- **Existing tests:** 52+ тестов в scope Story 3.4 — нужно обновить, не сломать

### Project Structure Notes

```
НОВЫЕ ФАЙЛЫ:
  supabase/migrations/020_add_email_preferences.sql
  src/features/profile/components/EmailPreferencesCard.tsx
  src/app/api/email/unsubscribe/route.ts
  src/app/(public)/email-preferences/page.tsx
  tests/unit/features/profile/EmailPreferencesCard.test.tsx
  tests/unit/features/profile/ProfileScreen.test.tsx
  tests/unit/app/api/email/unsubscribe/route.test.ts
  tests/unit/app/email-preferences/page.test.tsx

ИЗМЕНЯЕМЫЕ ФАЙЛЫ:
  src/types/supabase.ts (добавить поле в profiles)
  src/features/profile/components/ProfileScreen.tsx (добавить карточку)
  src/app/(app)/profile/page.tsx (добавить поле в select)
  src/app/api/notifications/new-post/route.ts (фильтр + headers)
  src/lib/email/index.ts (headers в EmailMessage)
  src/lib/email/templates/new-post.ts (обновить footer URL)
  tests/unit/app/api/notifications/new-post/route.test.ts (обновить тесты)
  tests/unit/lib/email/new-post-template.test.ts (обновить тесты)
```

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.5] — AC и FR27-28
- [Source: _bmad-output/planning-artifacts/architecture.md] — Smart/Dumb, API Boundaries, Error Handling
- [Source: _bmad-output/stories/3-4-automatic-email-notifications-new-posts.md] — реализация email, deferred items
- [Source: src/app/api/notifications/new-post/route.ts] — текущий route handler рассылки
- [Source: src/lib/email/templates/new-post.ts] — шаблон письма с unsubscribe link
- [Source: src/features/profile/components/ProfileScreen.tsx] — текущий layout профиля
- [Source: src/app/(app)/profile/page.tsx] — серверный компонент профиля
- RFC 8058 — One-Click Functionality for List Email Headers (List-Unsubscribe-Post)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Переименованы props `email_notifications_enabled` → `emailNotificationsEnabled` и `can_manage_email_preferences` → `canManageEmailPreferences` в компонентах (camelCase convention для React props, snake_case только для прямого доступа к полям БД в запросах).
- В route.test.ts добавлен `mockAdminEq` в цепочку моков: `.not → .eq → .order` вместо `.not → .order` (из-за добавления `.eq('email_notifications_enabled', true)`).
- ACTIVE_SUBSCRIBERS в тестах обновлены с добавлением поля `id` (subscribers теперь содержат id для генерации signed URL).

### Completion Notes List

- Task 1: SQL-миграция `020_add_email_preferences.sql` + типы Supabase обновлены
- Task 2: `EmailPreferencesCard` — Dumb UI с `role="switch"`, controlled toggle, ARIA, loading state, touch target ≥44px
- Task 3: `ProfileScreen` — optimistic update, rollback, toast. `profile/page.tsx` — `email_notifications_enabled` в select, `canManageEmailPreferences` prop, PGRST116 guard
- Task 4: `fetchAllSubscribers()` — фильтр `.eq('email_notifications_enabled', true)`, select расширен полем `id`
- Task 5: `GET/POST /api/email/unsubscribe` — HMAC-SHA256 signed token, constant-time сравнение, TTL 30 дней, future-ts защита, UUID валидация, идемпотентность, admin client
- Task 6: Публичная `/email-preferences` — `unsubscribed` / `invalid_or_expired` / fallback без раскрытия деталей
- Task 7: `generateUnsubscribeUrl()` генерирует индивидуальный signed URL на подписчика. `EmailMessage.headers` + `sendEmailBatch()` прокидывает `List-Unsubscribe` / `List-Unsubscribe-Post`
- Task 8: 913 тестов (56 файлов) — все прошли. Новые тесты: EmailPreferencesCard (14), ProfileScreen (9 обновлённых), unsubscribe route (15), email-preferences page (7). Обновлены: route.test.ts (mock chain + id + 4 новых теста), new-post-template.test.ts (2 новых теста)
- ✅ Resolved review finding [Critical]: /email-preferences добавлен в PUBLIC_PATHS, /api/email/ в PUBLIC_PATH_PREFIXES (app-routes.ts)
- ✅ Resolved review finding [Major]: NOTIFICATION_API_SECRET теперь обязателен — fail-fast 500 вместо fallback на /profile; убрана условная логика в блоке формирования писем
- ✅ Resolved review finding [Major]: middleware.test.ts дополнен 2 тестами для /email-preferences и /api/email/unsubscribe без авторизации. Тест "принимает сессию admin" обновлён — секрет теперь задаётся через beforeEach. 915 тестов пройдено.

### File List

**Новые файлы:**
- supabase/migrations/020_add_email_preferences.sql
- src/features/profile/components/EmailPreferencesCard.tsx
- src/app/api/email/unsubscribe/route.ts
- src/app/(public)/email-preferences/page.tsx
- tests/unit/features/profile/components/EmailPreferencesCard.test.tsx
- tests/unit/app/api/email/unsubscribe/route.test.ts
- tests/unit/app/email-preferences/page.test.tsx

**Изменённые файлы:**
- src/types/supabase.ts
- src/features/profile/components/ProfileScreen.tsx
- src/app/(app)/profile/page.tsx
- src/app/api/notifications/new-post/route.ts
- src/lib/app-routes.ts
- src/lib/email/index.ts
- tests/unit/features/profile/components/ProfileScreen.test.tsx
- tests/unit/app/api/notifications/new-post/route.test.ts
- tests/unit/lib/email/new-post-template.test.ts
- tests/unit/middleware.test.ts

## Change Log

- 2026-03-28: Story 3.5 реализована — управление email-предпочтениями. Добавлены: SQL-миграция (email_notifications_enabled), EmailPreferencesCard (toggle с optimistic update), GET/POST /api/email/unsubscribe (HMAC-SHA256 signed tokens, RFC 8058 List-Unsubscribe), публичная /email-preferences страница, фильтрация подписчиков при рассылке, индивидуальные signed URL в письмах. 913 тестов пройдено.
- 2026-03-28: Addressed code review findings — 3 items resolved. Исправлен middleware (PUBLIC_PATHS), убран fail-open fallback в new-post route, добавлены middleware тесты для unsubscribe маршрутов. 915 тестов пройдено.

### Review Findings (Round 1: 2026-03-28)

- [x] [Review][Critical] **Public unsubscribe flow сломан middleware** — `/email-preferences` и `/api/email/unsubscribe` не добавлены в `PUBLIC_PATHS`/`PUBLIC_PATH_PREFIXES` в `src/lib/app-routes.ts`. Неавторизованные запросы редиректятся на `/login` через `src/lib/supabase/auth-middleware.ts`. Нарушает AC #3, #4, #5, #6.
- [x] [Review][Major] **Fail-open fallback в email route** — при отсутствии `NOTIFICATION_API_SECRET` код подставляет `unsubscribeUrl = ${normalizedSiteUrl}/profile` и убирает `List-Unsubscribe` заголовки (`src/app/api/notifications/new-post/route.ts:171-183`). Это нарушает guardrail "не редиректить unsubscribe на auth-only `/profile`" и ломает one-click unsubscribe (RFC 8058).
- [x] [Review][Major] **Тесты не покрывают production middleware path** — `tests/unit/app/api/email/unsubscribe/route.test.ts` и `tests/unit/app/email-preferences/page.test.tsx` тестируют только handler/UI, минуя middleware. `tests/unit/middleware.test.ts` не содержит проверок для новых публичных маршрутов, что даёт ложное чувство покрытия.

### Review Findings (Round 2: 2026-03-28)

- [ ] [Review][Patch] Чрезмерно широкие права для префикса `/api/email/` [src/lib/app-routes.ts]
- [ ] [Review][Patch] Валидация пробельной/пустой строки NOTIFICATION_API_SECRET (например, `" "`) [src/app/api/notifications/new-post/route.ts]
