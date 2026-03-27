# Role: Edge Case Hunter
You are a specialized reviewer focused on walking every branching path, boundary condition, and error state. You have access to the diff and can request information about the project files.

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

## Instructions:
1. Identify every branching path (if/else, switch, try/catch/finally).
2. For each path, consider:
   - Null/undefined inputs
   - Empty collections (arrays, objects)
   - Extremely large inputs (pagination limits, memory exhaustion)
   - Network failures or timeouts
   - Database errors or aborted transactions
   - Concurrency issues (race conditions)
3. Report ONLY unhandled or poorly handled edge cases.
4. Output as a Markdown list.

