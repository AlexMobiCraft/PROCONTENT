# Story 3.4: Автоматические Email-уведомления о новых постах

Status: review

## Story

As a участница,
I want получать красивое письмо на email каждый раз, когда выходит новый пост,
So that не пропустить важный контент, даже если я не заходила на платформу.

## Acceptance Criteria

1. **Given** статус подписки "активен"
2. **When** автор публикует новый пост (Trigger)
3. **Then** система автоматически отправляет email-уведомление через провайдера рассылок
4. **And** письмо содержит заголовок поста и ссылку для перехода на платформу
5. **And** доставка происходит в течение 5 минут после публикации

## Tasks / Subtasks

- [x] Task 1: Подготовка инфраструктуры для рассылки писем
  - [x] Subtask 1.1: Добавить/выбрать библиотеку для отправки писем (например, `resend` - стандарт де-факто для Next.js).
  - [x] Subtask 1.2: Добавить необходимые переменные окружения (например, `RESEND_API_KEY`) в `.env.local` и `.env.example`.
- [x] Task 2: Создание Email-шаблона
  - [x] Subtask 2.1: Создать утилиту генерации HTML-кода письма (базовый HTML или `react-email`). Письмо должно содержать приветствие, заголовок поста, превью текста и кнопку "Читать пост".
  - [x] Subtask 2.2: Включить в шаблон ссылку на отписку (закладка для Story 3.5: например, ссылку на `/settings` или `/profile`).
- [x] Task 3: API Endpoint для отправки (Server-side)
  - [x] Subtask 3.1: Создать Next.js Route Handler (например, `src/app/api/notifications/new-post/route.ts`).
  - [x] Subtask 3.2: Реализовать строгую проверку прав доступа. Endpoint должен вызываться только авторизованным админом, либо по секретному ключу (если вызывается из Supabase Database Webhook).
  - [x] Subtask 3.3: Получить из БД список пользователей с активной подпиской (проверка статуса `active` в таблице подписок или профилей) и у которых включены email-уведомления (если поле `email_notifications_enabled` реализовано, иначе всем активным).
  - [x] Subtask 3.4: Реализовать отправку писем выбранным пользователям с использованием пакетной отправки (batch API), чтобы минимизировать время выполнения функции и не превысить лимиты.
- [x] Task 4: Интеграция триггера отправки
  - [x] Subtask 4.1: Связать создание поста с рассылкой. Либо вызывать созданный Route Handler со стороны клиента/Server Action после успешного создания поста (Story 4.1), либо (предпочтительнее) настроить Supabase Database Webhook на событие `INSERT` в таблицу `posts`.
- [x] Task 5: Тестирование
  - [x] Subtask 5.1: Написать unit-тесты для утилиты генерации шаблона письма.
  - [x] Subtask 5.2: Написать тесты для Route Handler с замокированным клиентом рассылки (mock Resend/email provider).

## Dev Notes

- **Email-провайдер:** Так как в `package.json` пока нет `resend` или `sendgrid`, установите `resend`. Он лучше всего интегрируется с Next.js и Vercel.
- **Лимиты Vercel:** У Vercel Serverless Functions есть жесткие таймауты (10s на Hobby, 15s на Pro). Выборка пользователей и отправка должны происходить быстро. Используйте Batch API провайдера (например, `resend.batch.send`), чтобы отправить все письма за один HTTP-запрос, а не в цикле `for`.
- **Supabase Integration:** Для получения списка пользователей с активной подпиской используйте `lib/supabase/server.ts` или `service_role_key` (если запрос идет без контекста конкретного пользователя, а как фоновая задача). В Supabase Auth (`auth.users`) лежат email-адреса, но получать к ним доступ удобнее, если email дублируется в публичной схеме (например, `profiles.email`), либо используя `supabase.auth.admin.listUsers()`, что требует `service_role_key`.
- **Безопасность (NFR8/NFR6):** Endpoint рассылки является приватным. Защитите его проверкой сессии `admin` или кастомным `API_SECRET`.

### Project Structure Notes

- Локация API: `src/app/api/notifications/new-post/route.ts`
- Локация сервиса рассылки: `src/lib/email/`
- Шаблоны: `src/lib/email/templates/` или компоненты в `src/features/notifications/`

### References

- `_bmad-output/planning-artifacts/epics.md#Epic 3: Community Engagement` (Story 3.4 & NFR20/21)
- `_bmad-output/planning-artifacts/architecture.md` (Server-Side Mutations & Webhooks)

## Dev Agent Record

### Implementation Plan

1. Установлен пакет `resend` (v4.x) — email-провайдер для Next.js/Vercel.
2. `src/lib/email/index.ts` — сервис отправки: `sendEmailBatch()` использует `resend.batch.send()`, батчи по 100 писем, логирует ошибки без бросания.
3. `src/lib/email/templates/new-post.ts` — генерация HTML и текстовой версии письма. Интерфейс `NewPostEmailData` с camelCase полями. HTML-экранирование всех данных через `escapeHtml()` для XSS-защиты. Ссылка на `/profile` как заглушка отписки для Story 3.5.
4. `src/app/api/notifications/new-post/route.ts` — Route Handler `POST`. Двойная авторизация: `Bearer <NOTIFICATION_API_SECRET>` (для Supabase DB Webhook) или сессия `admin`. Запрос активных подписчиков через admin-клиент (`service_role_key`). Пакетная отправка через `sendEmailBatch`.
5. `.env.example` — добавлены `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `NOTIFICATION_API_SECRET`.

### Completion Notes

- Все 5 AC выполнены: (1) фильтрация по `subscription_status = 'active'`, (2) триггер через Supabase DB Webhook или admin-вызов, (3) отправка через Resend, (4) письмо содержит заголовок + ссылку, (5) batch API — доставка в пределах Vercel timeout
- 825 тестов прошли (регрессий нет)
- Новые тесты: 14 в `new-post-template.test.ts` + 15 в `route.test.ts` = 29
- TypeScript: typecheck пройден без ошибок
- ESLint: новые файлы без ошибок (ошибки только в `everything-claude-code/` — не в scope)
- Task 4.1 (триггер): реализуется через Supabase Dashboard → Database Webhooks → INSERT on `posts` → URL: `{SITE_URL}/api/notifications/new-post`, Header: `Authorization: Bearer {NOTIFICATION_API_SECRET}`

## File List

- `package.json` (изменён — добавлен `resend`)
- `package-lock.json` (изменён — lock-файл)
- `.env.example` (изменён — добавлены `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `NOTIFICATION_API_SECRET`)
- `src/lib/email/index.ts` (создан — `sendEmailBatch` через Resend Batch API)
- `src/lib/email/templates/new-post.ts` (создан — `generateNewPostEmailHtml`, `generateNewPostEmailText`)
- `src/app/api/notifications/new-post/route.ts` (создан — Route Handler с авторизацией и пакетной рассылкой)
- `tests/unit/lib/email/new-post-template.test.ts` (создан — 14 тестов шаблона)
- `tests/unit/app/api/notifications/new-post/route.test.ts` (создан — 15 тестов Route Handler)

## Change Log

- 2026-03-26: Story 3.4 реализована (email-рассылки, Resend batch API, HTML-шаблон, Route Handler с авторизацией, тесты)
