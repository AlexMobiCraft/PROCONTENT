# Story 3.5: Управление email-предпочтениями

Status: ready-for-dev

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
   **Then** выполняется `GET` на signed unsubscribe URL, система отключает email-уведомления при валидном токене и перенаправляет участницу на `/profile?email_unsubscribed=1#email-preferences`

4. **Given** полученное email-уведомление
   **When** email-клиент (Gmail, Yahoo и др.) предлагает one-click unsubscribe в заголовке
   **Then** система обрабатывает запрос через `POST /api/email/unsubscribe?uid=...&ts=...&sig=...`, отключает уведомления без авторизации и возвращает `200 text/plain`

5. **Given** signed unsubscribe token невалиден, повреждён или истёк
   **When** система получает запрос на unsubscribe
   **Then** `GET` перенаправляет на `/profile?email_unsubscribe_error=invalid_or_expired#email-preferences`, а `POST` возвращает `400 text/plain` без изменения данных

6. **Given** участница уже отписана от email-уведомлений
   **When** приходит повторный `GET` или `POST` запрос на unsubscribe с валидным токеном
   **Then** операция считается идемпотентной, возвращает успешный результат и оставляет `email_notifications_enabled = false`

## Tasks / Subtasks

- [ ] Task 1: Миграция БД — добавить поле `email_notifications_enabled` (AC: #1)
  - [ ] 1.1: Создать SQL-миграцию: `ALTER TABLE profiles ADD COLUMN email_notifications_enabled boolean DEFAULT true NOT NULL`
  - [ ] 1.2: Обновить типы в `src/types/supabase.ts` (добавить поле в `profiles` Row/Insert/Update)

- [ ] Task 2: Компонент `EmailPreferencesCard` (AC: #1)
  - [ ] 2.1: Создать `src/features/profile/components/EmailPreferencesCard.tsx` — Dumb UI, `'use client'`
  - [ ] 2.2: Реализовать toggle (Switch из @base-ui/react или стилизованный checkbox) с оптимистичным обновлением
  - [ ] 2.3: Обработка ошибок: Toast при сбое мутации, rollback toggle к предыдущему значению
  - [ ] 2.4: Добавить `EmailPreferencesCard` в `ProfileScreen.tsx` (между SubscriptionCard и PasswordResetCard)

- [ ] Task 3: Обновить серверную страницу профиля (AC: #1)
  - [ ] 3.1: В `src/app/(app)/profile/page.tsx` добавить `email_notifications_enabled` в select-запрос
  - [ ] 3.2: Передать значение в `ProfileScreen` → `EmailPreferencesCard`

- [ ] Task 4: Фильтрация при рассылке (AC: #2)
  - [ ] 4.1: В `src/app/api/notifications/new-post/route.ts` → `fetchAllSubscribers()` добавить `.eq('email_notifications_enabled', true)` в Supabase-запрос
  - [ ] 4.2: Обновить тесты route.test.ts — добавить тест-кейс "пользователь с отключенными уведомлениями исключён из рассылки"

- [ ] Task 5: One-click Unsubscribe API (AC: #4)
  - [ ] 5.1: Создать `src/app/api/email/unsubscribe/route.ts` — endpoint с обработкой `GET` и `POST`
  - [ ] 5.2: Авторизация через signed token (`uid`, `ts`, `sig`), НЕ через сессию; canonical string: `${uid}:${ts}`
  - [ ] 5.3: Валидировать HMAC-SHA256 подпись (`NOTIFICATION_API_SECRET`), `ts` в формате Unix seconds и TTL = 30 дней
  - [ ] 5.4: При валидном токене — обновить `profiles.email_notifications_enabled = false` через admin client; операция должна быть идемпотентной
  - [ ] 5.5: `GET` при успехе — redirect на `/profile?email_unsubscribed=1#email-preferences`, при невалидном/истекшем токене — redirect на `/profile?email_unsubscribe_error=invalid_or_expired#email-preferences`
  - [ ] 5.6: `POST` при успехе — вернуть `200 text/plain`, при невалидном/истекшем токене — `400 text/plain` (RFC 8058)

- [ ] Task 6: Обновить email-шаблоны и заголовки (AC: #3, #4)
  - [ ] 6.1: В route handler добавить email-заголовки `List-Unsubscribe` и `List-Unsubscribe-Post` (RFC 8058) с индивидуальным signed URL для каждого подписчика в формате `/api/email/unsubscribe?uid=...&ts=...&sig=...`
  - [ ] 6.2: Обновить footer в `new-post.ts` — ссылка "Отписаться" ведёт на тот же signed URL (GET → unsubscribe + redirect на `/profile?email_unsubscribed=1#email-preferences`)
  - [ ] 6.3: Обновить `EmailMessage` интерфейс в `src/lib/email/index.ts` — добавить опциональное поле `headers`

- [ ] Task 7: Тестирование
  - [ ] 7.1: Unit-тесты для `EmailPreferencesCard` (рендер, toggle, ошибки, rollback)
  - [ ] 7.2: Unit-тесты для unsubscribe route (валидный токен, невалидный, истекший, отсутствующий профиль, идемпотентный повторный запрос)
  - [ ] 7.3: Обновить тесты email-шаблонов — проверить наличие unsubscribe URL и заголовков
  - [ ] 7.4: Обновить тесты route handler — фильтрация по `email_notifications_enabled`

## Dev Notes

### Критические guardrails

- **НЕ создавать отдельную страницу `/settings`** — email-предпочтения размещаются на существующей странице `/profile` как новая карточка `EmailPreferencesCard`
- **НЕ использовать `'use server'`** на lib-модулях — это превращает экспорты в публичные Server Action endpoints (lesson из Story 3.4)
- **snake_case для БД** — поле называется `email_notifications_enabled`, НЕ `emailNotificationsEnabled`
- **Оптимистичное обновление** — toggle меняется мгновенно, при ошибке — rollback + Toast
- **One-click unsubscribe обязателен** — Gmail и Yahoo требуют RFC 8058 `List-Unsubscribe-Post` заголовок с февраля 2024. Без него письма могут попадать в спам (NFR21)

### Архитектурные решения

**Signed Token для Unsubscribe (НЕ session auth):**
- Email-клиенты отправляют `GET`/`POST` без cookies/сессии
- Query params: `uid`, `ts`, `sig`
- Canonical string для подписи: `${uid}:${ts}`
- Алгоритм подписи: HMAC-SHA256 с секретом `NOTIFICATION_API_SECRET`
- `ts` хранится в формате Unix seconds
- `sig` кодируется в hex
- TTL токена: 30 дней
- `GET` используется для перехода из footer-ссылки, `POST` — для one-click unsubscribe из email-клиентов
- Операция unsubscribe идемпотентна; отдельная replay-защита в рамках этой истории не требуется
- `NOTIFICATION_API_SECRET` уже существует в `.env` (Story 3.4)

**Контракт Unsubscribe endpoint:**
- `GET /api/email/unsubscribe?uid=...&ts=...&sig=...`
- При валидном токене: обновить `email_notifications_enabled = false`, затем redirect на `/profile?email_unsubscribed=1#email-preferences`
- При невалидном/истекшем токене: redirect на `/profile?email_unsubscribe_error=invalid_or_expired#email-preferences`
- `POST /api/email/unsubscribe?uid=...&ts=...&sig=...`
- При валидном токене: `200 text/plain`
- При невалидном/истекшем токене: `400 text/plain`
- Если профиль не найден: `GET` ведёт на error redirect, `POST` возвращает `400 text/plain`

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
  email_notifications_enabled: boolean
  onToggle: (enabled: boolean) => void
  isLoading?: boolean
}
```

**ProfileScreen (Smart Container)** — управляет мутацией:
```typescript
// Оптимистичное обновление через локальный useState
const [emailEnabled, setEmailEnabled] = useState(initialValue)

async function handleToggle(enabled: boolean) {
  const prev = emailEnabled
  setEmailEnabled(enabled) // optimistic
  const supabase = createClient()
  const { error } = await supabase
    .from('profiles')
    .update({ email_notifications_enabled: enabled })
    .eq('id', user.id)
  if (error) {
    setEmailEnabled(prev) // rollback
    toast.error('Napaka pri shranjevanju nastavitev')
  }
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
     и затем redirect на /profile?email_unsubscribed=1#email-preferences -->
```

**`src/app/(app)/profile/page.tsx`** — Select (строка ~25):
```typescript
// ТЕКУЩЕЕ:
.select('email, display_name, subscription_status, current_period_end, stripe_customer_id')

// НУЖНО ДОБАВИТЬ email_notifications_enabled:
.select('email, display_name, subscription_status, current_period_end, stripe_customer_id, email_notifications_enabled')
```

**`src/features/profile/components/ProfileScreen.tsx`** — Добавить карточку (строка ~40):
```tsx
// После SubscriptionCard, перед PasswordResetCard
<EmailPreferencesCard
  email_notifications_enabled={profile.email_notifications_enabled}
  onToggle={handleEmailToggle}
/>
```

### Текст UI (словенский язык)

- Заголовок карточки: "E-poštna obvestila"
- Описание: "Prejemajte obvestila o novih objavah na vaš e-poštni naslov"
- Toggle label: "Obvestila o novih objavah"
- Toast success (вкл): "E-poštna obvestila so vklopljena"
- Toast success (выкл): "E-poštna obvestila so izklopljena"
- Toast error: "Napaka pri shranjevanju nastavitev"
- Unsubscribe page confirmation: "Uspešno ste se odjavili od e-poštnih obvestil"
- Unsubscribe page error: "Povezava za odjavo je neveljavna ali je potekla"

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
  tests/unit/features/profile/EmailPreferencesCard.test.tsx
  tests/unit/app/api/email/unsubscribe/route.test.ts

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

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
