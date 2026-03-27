# Role: Acceptance Auditor
You are an Acceptance Auditor. You must verify that the implementation matches the provided story specification and project context.

## Input Diff:
```patch
diff --git a/_bmad-output/implementation-artifacts/deferred-work.md b/_bmad-output/implementation-artifacts/deferred-work.md
index b850a27..174931e 100644
--- a/_bmad-output/implementation-artifacts/deferred-work.md
+++ b/_bmad-output/implementation-artifacts/deferred-work.md
@@ -1,12 +1,12 @@
-## Deferred from: code review of 3-1-viewing-discussions-under-a-post.md (2026-03-25)
+# Deferred Work
 
-- Нет пагинации или лимитов при загрузке комментариев [src/features/comments/api/comments.ts] — deferred, pre-existing (will be needed when discussions grow large)
-- Ошибки при загрузке комментариев в SSR скрываются без логирования [src/app/(app)/feed/[id]/page.tsx:68] — deferred, pre-existing (better error boundaries needed)
+## Deferred from: code review (2026-03-27) - 3-4-automatic-email-notifications-new-posts.md
 
-## Deferred from: code review of 3-4-automatic-email-notifications-new-posts.md (2026-03-27)
-
-- Нет rate limiting / идемпотентности — at-least-once Supabase webhook может разослать письма дважды по одному посту [src/app/api/notifications/new-post/route.ts:39]
-- Admin auth полагается на user-writable колонку `role` — при некорректном RLS возможна privilege escalation [src/app/api/notifications/new-post/route.ts:113]
-- Последовательные batch sends могут превысить таймаут Vercel при >100 подписчиках [src/lib/email/index.ts:48] — pre-existing
-- Unsubscribe link is not "one-click" [src/app/api/notifications/new-post/route.ts:132] — deferred, Story 3.5
+### Раунды 1 и 2
+- **Нет rate limiting / идемпотентности**: At-least-once доставка Supabase Webhook может привести к дубликатам писем при сбоях. [src/app/api/notifications/new-post/route.ts:39]
+- **Безопасность Admin Auth**: Проверка роли полагается на колонку `role`, которая при ошибках в RLS может быть уязвима. [src/app/api/notifications/new-post/route.ts:113]
+- **Последовательные batch sends**: При большом количестве подписчиков риск превышения таймаута лямбды (10-15с). [src/lib/email/index.ts:48]
+- **Unsubscribe link is not "one-click"**: Текущая ссылка ведет в профиль, а не выполняет мгновенную отписку по токену. Ожидается в Story 3.5. [src/app/api/notifications/new-post/route.ts:132]
 
+### Раунд 3
+- **Потребление памяти при загрузке всех профилей**: Загрузка всех активных пользователей в память через .select() может вызвать OOM на очень больших объемах данных. [src/app/api/notifications/new-post/route.ts:81]
diff --git a/_bmad-output/implementation-artifacts/sprint-status.yaml b/_bmad-output/implementation-artifacts/sprint-status.yaml
index 882bb98..5f77b19 100644
--- a/_bmad-output/implementation-artifacts/sprint-status.yaml
+++ b/_bmad-output/implementation-artifacts/sprint-status.yaml
@@ -40,7 +40,7 @@
 #   - Story 4.1 обновлена: мультимедиа загрузка (до 10 файлов, обложка, порядок)
 #   - Story 5.1 обновлена: группировка медиагрупп, Exponential Backoff, post_media
 
-generated: 2026-03-27T10:10:00+01:00
+generated: 2026-03-27T10:36:00+01:00
 project: PROCONTENT
 project_key: NOKEY
 tracking_system: file-system
@@ -101,6 +101,7 @@ development_status:
   # 2026-03-27: Review Findings resolved (9 items: 1 decision + 8 patch) → review
   # 2026-03-27: Code Review Round 2 (6 patches) → in-progress
   # 2026-03-27: Round 2 Review Findings resolved (6 patches) → review
+  # 2026-03-27: Code Review Round 3 (1 patch: Supabase row limit pagination) → review
   3-4-automatic-email-notifications-about-new-posts: review
   3-5-managing-email-preferences: backlog
   epic-3-retrospective: optional
diff --git a/_bmad-output/stories/3-4-automatic-email-notifications-new-posts.md b/_bmad-output/stories/3-4-automatic-email-notifications-new-posts.md
index 1d4f6e1..f66e8c9 100644
--- a/_bmad-output/stories/3-4-automatic-email-notifications-new-posts.md
+++ b/_bmad-output/stories/3-4-automatic-email-notifications-new-posts.md
@@ -71,7 +71,8 @@ So that не пропустить важный контент, даже если
 - TypeScript: typecheck пройден без ошибок
 - ESLint: новые файлы без ошибок (ошибки только в `everything-claude-code/` — не в scope)
 - Task 4.1 (триггер): реализуется через Supabase Dashboard → Database Webhooks → INSERT on `posts` → URL: `{SITE_URL}/api/notifications/new-post`, Header: `Authorization: Bearer {NOTIFICATION_API_SECRET}`
-- Review Findings: все 9 patch/decision resolved, 3 deferred оставлены
+- Review Findings: все patch/decision resolved (Round 1: 9, Round 2: 6, Round 3: 1), 4 deferred оставлены
+- ✅ Resolved review finding [Patch]: Supabase row limit — `fetchAllSubscribers` с пагинацией `.range()`, тесты multi-page и DB error on page 2
 
 ## File List
 
@@ -80,9 +81,9 @@ So that не пропустить важный контент, даже если
 - `.env.example` (изменён — добавлены `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `NOTIFICATION_API_SECRET`)
 - `src/lib/email/index.ts` (изменён — удалён `'use server'`)
 - `src/lib/email/templates/new-post.ts` (изменён — добавлена `sanitizeHref` для href-атрибутов)
-- `src/app/api/notifications/new-post/route.ts` (изменён — UUID-валидация, SITE_URL-валидация, фильтр null-email, `timingSafeEqual`, предупреждение об отсутствии секрета, логирование в isAuthorized, исправлен URL `/feed/`)
+- `src/app/api/notifications/new-post/route.ts` (изменён — UUID-валидация, SITE_URL-валидация, фильтр null-email, `timingSafeEqual`, предупреждение об отсутствии секрета, логирование в isAuthorized, исправлен URL `/feed/`, пагинация `fetchAllSubscribers`)
 - `tests/unit/lib/email/new-post-template.test.ts` (изменён — добавлены 2 теста на javascript: URL)
-- `tests/unit/app/api/notifications/new-post/route.test.ts` (изменён — VALID_POST использует UUID, добавлены 4 новых теста; Round 2: +4 теста — double slashes, excerpt, timingSafeEqual length)
+- `tests/unit/app/api/notifications/new-post/route.test.ts` (изменён — VALID_POST использует UUID, добавлены 4 новых теста; Round 2: +4 теста — double slashes, excerpt, timingSafeEqual length; Round 3: +2 теста пагинации, обновлён мок-chain с `.range()`)
 - `tests/unit/lib/email/email-service.test.ts` (создан — 6 unit-тестов для sendEmailBatch: partial batch, data=null, empty array)
 
 ## Change Log
@@ -90,6 +91,7 @@ So that не пропустить важный контент, даже если
 - 2026-03-26: Story 3.4 реализована (email-рассылки, Resend batch API, HTML-шаблон, Route Handler с авторизацией, тесты)
 - 2026-03-27: Addressed code review findings — 9 items resolved (1 decision + 8 patch)
 - 2026-03-27: Addressed Round 2 review findings — 6 items resolved (6 patch)
+- 2026-03-27: Addressed Round 3 review findings — 1 item resolved (Supabase row limit pagination)
 
 
 ### Review Findings
@@ -130,3 +132,11 @@ So that не пропустить важный контент, даже если
 -   [x] [Review][Patch] Accuracy of `sent` count when `data` is missing [src/lib/email/index.ts:269] → Resolved: `sent += data?.data?.length ?? 0` (не `chunk.length` как fallback)
 
 -   [x] [Review][Defer] Unsubscribe link is not "one-click" [src/app/api/notifications/new-post/route.ts:132] — deferred, Story 3.5
+
+#### Round 3 (2026-03-27)
+
+- [x] [Review][Patch] Лимит Supabase на количество строк (1000 по умолчанию) [src/app/api/notifications/new-post/route.ts:81] → Resolved: добавлена функция `fetchAllSubscribers` с пагинацией `.range(offset, offset + PAGE_SIZE - 1)` (PAGE_SIZE=1000), цикл до исчерпания данных
+
+- [x] [Review][Defer] Таймаут Vercel (10-15с) при >1000 подписчиков [src/lib/email/index.ts] — deferred, pre-existing
+- [x] [Review][Defer] Потребление памяти при загрузке всех профилей [src/app/api/notifications/new-post/route.ts:81] — deferred, pre-existing
+- [x] [Review][Defer] Отсутствие идемпотентности вебхука [src/app/api/notifications/new-post/route.ts] — deferred, pre-existing
diff --git a/src/app/api/notifications/new-post/route.ts b/src/app/api/notifications/new-post/route.ts
index 23e3cdf..5fc38fe 100644
--- a/src/app/api/notifications/new-post/route.ts
+++ b/src/app/api/notifications/new-post/route.ts
@@ -29,6 +29,37 @@ function createAdminClient() {
   return createSupabaseAdminClient<Database>(url, key)
 }
 
+const PAGE_SIZE = 1000
+
+/**
+ * Загружает всех активных подписчиков постранично, обходя лимит Supabase (1000 строк по умолчанию).
+ */
+async function fetchAllSubscribers(supabase: ReturnType<typeof createAdminClient>): Promise<{
+  data: Array<{ email: string | null; display_name: string | null }> | null
+  error: { message: string } | null
+}> {
+  const all: Array<{ email: string | null; display_name: string | null }> = []
+  let offset = 0
+
+  for (;;) {
+    const { data, error } = await supabase
+      .from('profiles')
+      .select('email, display_name')
+      .eq('subscription_status', 'active')
+      .range(offset, offset + PAGE_SIZE - 1)
+
+    if (error) return { data: null, error }
+    if (!data || data.length === 0) break
+
+    all.push(...data)
+    if (data.length < PAGE_SIZE) break
+
+    offset += PAGE_SIZE
+  }
+
+  return { data: all, error: null }
+}
+
 /**
  * POST /api/notifications/new-post
  *
@@ -77,10 +108,7 @@ export async function POST(request: NextRequest): Promise<NextResponse> {
 
   // --- Получение активных подписчиков ---
   const supabase = createAdminClient()
-  const { data: subscribers, error: dbError } = await supabase
-    .from('profiles')
-    .select('email, display_name')
-    .eq('subscription_status', 'active')
+  const { data: subscribers, error: dbError } = await fetchAllSubscribers(supabase)
 
   if (dbError) {
     console.error('[notifications] Failed to fetch subscribers:', dbError.message)
diff --git a/tests/unit/app/api/notifications/new-post/route.test.ts b/tests/unit/app/api/notifications/new-post/route.test.ts
index 4560dff..c2a2a3a 100644
--- a/tests/unit/app/api/notifications/new-post/route.test.ts
+++ b/tests/unit/app/api/notifications/new-post/route.test.ts
@@ -14,13 +14,15 @@ vi.mock('@/lib/email', () => ({
 
 // Мок admin Supabase-клиента (createClient из @supabase/supabase-js)
 // Используется для запроса активных подписчиков
-const { mockAdminEq, mockAdminSelect, mockAdminFrom, mockCreateAdminClient } = vi.hoisted(() => {
-  const mockAdminEq = vi.fn()
-  const mockAdminSelect = vi.fn(() => ({ eq: mockAdminEq }))
-  const mockAdminFrom = vi.fn(() => ({ select: mockAdminSelect }))
-  const mockCreateAdminClient = vi.fn(() => ({ from: mockAdminFrom }))
-  return { mockAdminEq, mockAdminSelect, mockAdminFrom, mockCreateAdminClient }
-})
+const { mockAdminRange, mockAdminEq, mockAdminSelect, mockAdminFrom, mockCreateAdminClient } =
+  vi.hoisted(() => {
+    const mockAdminRange = vi.fn()
+    const mockAdminEq = vi.fn()
+    const mockAdminSelect = vi.fn(() => ({ eq: mockAdminEq }))
+    const mockAdminFrom = vi.fn(() => ({ select: mockAdminSelect }))
+    const mockCreateAdminClient = vi.fn(() => ({ from: mockAdminFrom }))
+    return { mockAdminRange, mockAdminEq, mockAdminSelect, mockAdminFrom, mockCreateAdminClient }
+  })
 
 vi.mock('@supabase/supabase-js', () => ({
   createClient: mockCreateAdminClient,
@@ -69,7 +71,8 @@ describe('POST /api/notifications/new-post', () => {
     // Дефолтный мок: admin client возвращает активных подписчиков
     mockAdminFrom.mockReturnValue({ select: mockAdminSelect })
     mockAdminSelect.mockReturnValue({ eq: mockAdminEq })
-    mockAdminEq.mockResolvedValue({ data: ACTIVE_SUBSCRIBERS, error: null })
+    mockAdminEq.mockReturnValue({ range: mockAdminRange })
+    mockAdminRange.mockResolvedValue({ data: ACTIVE_SUBSCRIBERS, error: null })
 
     mockSendEmailBatch.mockResolvedValue({ sent: 2, failed: 0 })
   })
@@ -236,7 +239,7 @@ describe('POST /api/notifications/new-post', () => {
     })
 
     it('возвращает { sent: 0 } при отсутствии активных подписчиков', async () => {
-      mockAdminEq.mockResolvedValue({ data: [], error: null })
+      mockAdminRange.mockResolvedValue({ data: [], error: null })
 
       const req = makeRequest(VALID_POST, { Authorization: `Bearer ${API_SECRET}` })
       const res = await POST(req)
@@ -248,7 +251,7 @@ describe('POST /api/notifications/new-post', () => {
     })
 
     it('фильтрует подписчиков с null/пустым email', async () => {
-      mockAdminEq.mockResolvedValue({
+      mockAdminRange.mockResolvedValue({
         data: [
           { email: 'valid@example.com', display_name: 'Valid' },
           { email: null, display_name: 'No Email' },
@@ -266,7 +269,7 @@ describe('POST /api/notifications/new-post', () => {
     })
 
     it('возвращает 500 при ошибке запроса к БД', async () => {
-      mockAdminEq.mockResolvedValue({ data: null, error: { message: 'DB error' } })
+      mockAdminRange.mockResolvedValue({ data: null, error: { message: 'DB error' } })
 
       const req = makeRequest(VALID_POST, { Authorization: `Bearer ${API_SECRET}` })
       const res = await POST(req)
@@ -283,6 +286,44 @@ describe('POST /api/notifications/new-post', () => {
       expect(res.status).toBe(500)
     })
 
+    it('запрашивает вторую страницу, когда первая вернула ровно 1000 строк', async () => {
+      const page1 = Array.from({ length: 1000 }, (_, i) => ({
+        email: `user${i}@example.com`,
+        display_name: null,
+      }))
+      const page2 = [{ email: 'last@example.com', display_name: 'Last' }]
+
+      mockAdminRange
+        .mockResolvedValueOnce({ data: page1, error: null })
+        .mockResolvedValueOnce({ data: page2, error: null })
+      mockSendEmailBatch.mockResolvedValue({ sent: 1001, failed: 0 })
+
+      const req = makeRequest(VALID_POST, { Authorization: `Bearer ${API_SECRET}` })
+      const res = await POST(req)
+      const body = await res.json()
+
+      expect(mockAdminRange).toHaveBeenCalledTimes(2)
+      expect(mockAdminRange).toHaveBeenNthCalledWith(1, 0, 999)
+      expect(mockAdminRange).toHaveBeenNthCalledWith(2, 1000, 1999)
+      expect(body.sent).toBe(1001)
+    })
+
+    it('возвращает 500 при ошибке БД на второй странице', async () => {
+      const page1 = Array.from({ length: 1000 }, (_, i) => ({
+        email: `user${i}@example.com`,
+        display_name: null,
+      }))
+
+      mockAdminRange
+        .mockResolvedValueOnce({ data: page1, error: null })
+        .mockResolvedValueOnce({ data: null, error: { message: 'DB error on page 2' } })
+
+      const req = makeRequest(VALID_POST, { Authorization: `Bearer ${API_SECRET}` })
+      const res = await POST(req)
+
+      expect(res.status).toBe(500)
+    })
+
     it('не создаёт двойной слэш когда SITE_URL заканчивается на /', async () => {
       vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://procontent.si/')
 

```

## Specification (Story 3.4):
```markdown
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
- 848 тестов прошли (регрессий нет); Round 2: +17 новых тестов
- Итого тестов: 23 в `new-post-template.test.ts` + 23 в `route.test.ts` + 6 в `email-service.test.ts` = 52 в scope Story 3.4
- TypeScript: typecheck пройден без ошибок
- ESLint: новые файлы без ошибок (ошибки только в `everything-claude-code/` — не в scope)
- Task 4.1 (триггер): реализуется через Supabase Dashboard → Database Webhooks → INSERT on `posts` → URL: `{SITE_URL}/api/notifications/new-post`, Header: `Authorization: Bearer {NOTIFICATION_API_SECRET}`
- Review Findings: все patch/decision resolved (Round 1: 9, Round 2: 6, Round 3: 1), 4 deferred оставлены
- ✅ Resolved review finding [Patch]: Supabase row limit — `fetchAllSubscribers` с пагинацией `.range()`, тесты multi-page и DB error on page 2

## File List

- `package.json` (изменён — добавлен `resend`)
- `package-lock.json` (изменён — lock-файл)
- `.env.example` (изменён — добавлены `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `NOTIFICATION_API_SECRET`)
- `src/lib/email/index.ts` (изменён — удалён `'use server'`)
- `src/lib/email/templates/new-post.ts` (изменён — добавлена `sanitizeHref` для href-атрибутов)
- `src/app/api/notifications/new-post/route.ts` (изменён — UUID-валидация, SITE_URL-валидация, фильтр null-email, `timingSafeEqual`, предупреждение об отсутствии секрета, логирование в isAuthorized, исправлен URL `/feed/`, пагинация `fetchAllSubscribers`)
- `tests/unit/lib/email/new-post-template.test.ts` (изменён — добавлены 2 теста на javascript: URL)
- `tests/unit/app/api/notifications/new-post/route.test.ts` (изменён — VALID_POST использует UUID, добавлены 4 новых теста; Round 2: +4 теста — double slashes, excerpt, timingSafeEqual length; Round 3: +2 теста пагинации, обновлён мок-chain с `.range()`)
- `tests/unit/lib/email/email-service.test.ts` (создан — 6 unit-тестов для sendEmailBatch: partial batch, data=null, empty array)

## Change Log

- 2026-03-26: Story 3.4 реализована (email-рассылки, Resend batch API, HTML-шаблон, Route Handler с авторизацией, тесты)
- 2026-03-27: Addressed code review findings — 9 items resolved (1 decision + 8 patch)
- 2026-03-27: Addressed Round 2 review findings — 6 items resolved (6 patch)
- 2026-03-27: Addressed Round 3 review findings — 1 item resolved (Supabase row limit pagination)


### Review Findings

- [x] [Review][Decision] Partial send failure возвращает HTTP 200 — Supabase webhook не повторит запрос при частичном сбое (`failed > 0`). Нужно ли возвращать non-2xx? → Resolved: HTTP 200 оставлен намеренно. Non-2xx вызвал бы retry от Supabase webhook и дублирование писем уже отправленным подписчикам. Поведение задокументировано в JSDoc Route Handler.

- [x] [Review][Patch] `'use server'` на утилитарном модуле экспортирует `sendEmailBatch` как публичный Server Action endpoint [src/lib/email/index.ts:1] → Resolved: директива удалена
- [x] [Review][Patch] Неверный URL поста: `/post/{id}` — реальный роут `/feed/{id}` — все ссылки в письмах ведут на 404 [src/app/api/notifications/new-post/route.ts:70] → Resolved: исправлено на `/feed/${post.id}`
- [x] [Review][Patch] `NEXT_PUBLIC_SITE_URL` пустая строка даёт относительные URL во всех письмах без ошибки [src/app/api/notifications/new-post/route.ts:56] → Resolved: добавлена валидация — возвращает 500 при пустом/отсутствующем SITE_URL
- [x] [Review][Patch] Нет фильтрации `email = null/''` перед отправкой в Resend — невалидный адрес может сломать весь батч [src/app/api/notifications/new-post/route.ts:64] → Resolved: добавлен фильтр `validSubscribers` с type guard
- [x] [Review][Patch] Сравнение API secret через `===` уязвимо к timing attack — нужен `crypto.timingSafeEqual` [src/app/api/notifications/new-post/route.ts:105] → Resolved: используется `crypto.timingSafeEqual` с проверкой длины
- [x] [Review][Patch] Отсутствие env var `NOTIFICATION_API_SECRET` переключает режим auth без предупреждения в логах [src/app/api/notifications/new-post/route.ts:101] → Resolved: добавлен `console.warn` при отсутствии переменной
-   [x] [Review][Decision] Partial send failure возвращает HTTP 200 — Supabase webhook не повторит запрос при частичном сбое (`failed > 0`). Нужно ли возвращать non-2xx? → Resolved: HTTP 200 оставлен намеренно. Non-2xx вызвал бы retry от Supabase webhook и дублирование писем уже отправленным подписчикам. Поведение задокументировано в JSDoc Route Handler.

-   [x] [Review][Patch] `'use server'` на утилитарном модуле экспортирует `sendEmailBatch` как публичный Server Action endpoint [src/lib/email/index.ts:1] → Resolved: директива удалена
-   [x] [Review][Patch] Неверный URL поста: `/post/{id}` — реальный роут `/feed/{id}` — все ссылки в письмах ведут на 404 [src/app/api/notifications/new-post/route.ts:70] → Resolved: исправлено на `/feed/${post.id}`
-   [x] [Review][Patch] `NEXT_PUBLIC_SITE_URL` пустая строка даёт относительные URL во всех письмах без ошибки [src/app/api/notifications/new-post/route.ts:56] → Resolved: добавлена валидация — возвращает 500 при пустом/отсутствующем SITE_URL
-   [x] [Review][Patch] Нет фильтрации `email = null/''` перед отправкой в Resend — невалидный адрес может сломать весь батч [src/app/api/notifications/new-post/route.ts:64] → Resolved: добавлен фильтр `validSubscribers` с type guard
-   [x] [Review][Patch] Сравнение API secret через `===` уязвимо к timing attack — нужен `crypto.timingSafeEqual` [src/app/api/notifications/new-post/route.ts:105] → Resolved: используется `crypto.timingSafeEqual` с проверкой длины
-   [x] [Review][Patch] Отсутствие env var `NOTIFICATION_API_SECRET` переключает режим auth без предупреждения в логах [src/app/api/notifications/new-post/route.ts:101] → Resolved: добавлен `console.warn` при отсутствии переменной
-   [x] [Review][Patch] `post.id` не валидируется как UUID — произвольная строка формирует некорректный URL в письме [src/app/api/notifications/new-post/route.ts:44] → Resolved: добавлена валидация `UUID_REGEX`, возвращает 400 при невалидном id
-   [x] [Review][Patch] `isAuthorized` поглощает все исключения без логирования — ошибки инфраструктуры неотличимы от "не admin" [src/app/api/notifications/new-post/route.ts:107] → Resolved: добавлен `console.error` в catch с деталями ошибки
-   [x] [Review][Patch] `escapeHtml` не блокирует `javascript:` схему в href — неполная защита от open redirect в email [src/lib/email/templates/new-post.ts:50] → Resolved: добавлена функция `sanitizeHref`, разрешает только `http:`/`https:` схемы

-   [x] [Review][Defer] Нет rate limiting / идемпотентности — at-least-once Supabase webhook может разослать письма дважды по одному посту [src/app/api/notifications/new-post/route.ts:39] — deferred
-   [x] [Review][Defer] Admin auth полагается на user-writable колонку `role` — при некорректном RLS возможна privilege escalation [src/app/api/notifications/new-post/route.ts:113] — deferred
-   [x] [Review][Defer] Последовательные batch sends могут превысить таймаут Vercel при >100 подписчиках [src/lib/email/index.ts:48] — deferred, pre-existing

#### Round 2 (2026-03-27)

-   [x] [Review][Decision] Хардкод словенского языка в шаблонах — Resolved: Словенский язык выбран намеренно (ориентация на рынок Словении при русскоязычной коммуникации команды).

-   [x] [Review][Patch] `timingSafeEqual` length leak [src/app/api/notifications/new-post/route.ts:171] → Resolved: заменено на `createHash('sha256')` для обоих значений — хэши всегда 32 байта, длина секрета не утекает
-   [x] [Review][Patch] Missing "Excerpt" (превью текста) in email [src/app/api/notifications/new-post/route.ts:45] → Resolved: добавлено поле `excerpt?: string` в `PostPayload`, `postExcerpt?: string` в `NewPostEmailData`, блок превью в HTML и текстовую версию
-   [x] [Review][Patch] Potential double slashes in `postUrl` [src/app/api/notifications/new-post/route.ts:131] → Resolved: добавлен `siteUrl.replace(/\/$/, '')` перед формированием URL
-   [x] [Review][Patch] `sanitizeHref` blocks `/` relative paths [src/lib/email/templates/new-post.ts:394] → Resolved: `sanitizeHref` теперь разрешает корневые `/path` пути, блокирует только `//host` (protocol-relative)
-   [x] [Review][Patch] Partial Batch Send success vs failure [src/lib/email/index.ts:255] → Resolved: `failed += chunk.length - succeededCount` при частичном успехе батча
-   [x] [Review][Patch] Accuracy of `sent` count when `data` is missing [src/lib/email/index.ts:269] → Resolved: `sent += data?.data?.length ?? 0` (не `chunk.length` как fallback)

-   [x] [Review][Defer] Unsubscribe link is not "one-click" [src/app/api/notifications/new-post/route.ts:132] — deferred, Story 3.5

#### Round 3 (2026-03-27)

- [x] [Review][Patch] Лимит Supabase на количество строк (1000 по умолчанию) [src/app/api/notifications/new-post/route.ts:81] → Resolved: добавлена функция `fetchAllSubscribers` с пагинацией `.range(offset, offset + PAGE_SIZE - 1)` (PAGE_SIZE=1000), цикл до исчерпания данных

- [x] [Review][Defer] Таймаут Vercel (10-15с) при >1000 подписчиков [src/lib/email/index.ts] — deferred, pre-existing
- [x] [Review][Defer] Потребление памяти при загрузке всех профилей [src/app/api/notifications/new-post/route.ts:81] — deferred, pre-existing
- [x] [Review][Defer] Отсутствие идемпотентности вебхука [src/app/api/notifications/new-post/route.ts] — deferred, pre-existing

```

## Project Context Highlights:
- Language: Russian communication, Slovenian content/UI.
- Tech: Next.js 16, Supabase, React 19, Resend.
- Conventions: snake_case for DB fields, no mapping to camelCase.

## Instructions:
1. Compare the diff against the Acceptance Criteria (AC) and Tasks in the Story.
2. Check for:
   - Violations of AC
   - Missing tasks or subtasks
   - Deviations from specified behavior/intent
   - Technical debt introduced that contradicts project conventions.
3. Output findings as a Markdown list. Each finding: one-line title, which AC/Task/NFR it violates, and evidence from the diff.

