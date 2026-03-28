You are a Blind Hunter adversarial reviewer. Review the following diff. No project context is provided. Look for security, logic, performance, or structural bugs.
Provide a clear markdown list of findings.

### Diff:
```diff
diff --git a/src/app/api/notifications/new-post/route.ts b/src/app/api/notifications/new-post/route.ts
index 2186a8d..2a67ccf 100644
--- a/src/app/api/notifications/new-post/route.ts
+++ b/src/app/api/notifications/new-post/route.ts
@@ -132,6 +132,15 @@ export async function POST(request: NextRequest): Promise<NextResponse> {
     return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
   }
 
+  // --- Валидация NOTIFICATION_API_SECRET ---
+  // Секрет обязателен для генерации signed unsubscribe URL (RFC 8058, AC #4).
+  // Без него нельзя добавить List-Unsubscribe заголовки и выполнить one-click unsubscribe.
+  const notificationSecret = process.env.NOTIFICATION_API_SECRET
+  if (!notificationSecret) {
+    console.error('[notifications] NOTIFICATION_API_SECRET is not configured')
+    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
+  }
+
   // --- Получение активных подписчиков ---
   let supabase: ReturnType<typeof createAdminClient>
   try {
@@ -168,19 +177,13 @@ export async function POST(request: NextRequest): Promise<NextResponse> {
   // Санитизируем заголовок: удаляем CR/LF для защиты от SMTP header injection
   const safeTitle = post.title.replace(/[\r\n]/g, '')
 
-  const notificationSecret = process.env.NOTIFICATION_API_SECRET
-
   const messages = validSubscribers.map((s) => {
-    const unsubscribeUrl = notificationSecret
-      ? generateUnsubscribeUrl(normalizedSiteUrl, s.id, notificationSecret)
-      : `${normalizedSiteUrl}/profile`
-
-    const headers: Record<string, string> | undefined = notificationSecret
-      ? {
-          'List-Unsubscribe': `<${unsubscribeUrl}>`,
-          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
-        }
-      : undefined
+    const unsubscribeUrl = generateUnsubscribeUrl(normalizedSiteUrl, s.id, notificationSecret)
+
+    const headers: Record<string, string> = {
+      'List-Unsubscribe': `<${unsubscribeUrl}>`,
+      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
+    }
 
     return {
       to: s.email,
diff --git a/src/lib/app-routes.ts b/src/lib/app-routes.ts
index 1c625a4..5c284ab 100644
--- a/src/lib/app-routes.ts
+++ b/src/lib/app-routes.ts
@@ -5,9 +5,9 @@ export const DEFAULT_AUTH_REDIRECT_PATH = '/feed'
 export const ONBOARDING_PATH = '/onboarding'
 // /update-password: в PUBLIC_PATHS чтобы middleware пропускал пользователей с неактивной подпиской
 // (recovery-flow), дополнительная защита от неавторизованных — серверная проверка в самой странице
-export const PUBLIC_PATHS = [ROOT_PATH, LOGIN_PATH, INACTIVE_PATH, '/update-password', '/register', '/forgot-password'] as const
+export const PUBLIC_PATHS = [ROOT_PATH, LOGIN_PATH, INACTIVE_PATH, '/update-password', '/register', '/forgot-password', '/email-preferences'] as const
 
-const PUBLIC_PATH_PREFIXES = ['/auth/', '/api/webhooks/', '/api/checkout'] as const
+const PUBLIC_PATH_PREFIXES = ['/auth/', '/api/webhooks/', '/api/checkout', '/api/email/'] as const
 
 function normalizeInternalPath(path: string | undefined, fallback: string) {
   if (!path || !path.startsWith('/')) {
diff --git a/tests/unit/app/api/notifications/new-post/route.test.ts b/tests/unit/app/api/notifications/new-post/route.test.ts
index 0213acf..712d878 100644
--- a/tests/unit/app/api/notifications/new-post/route.test.ts
+++ b/tests/unit/app/api/notifications/new-post/route.test.ts
@@ -133,8 +133,8 @@ describe('POST /api/notifications/new-post', () => {
     })
 
     it('принимает сессию admin', async () => {
-      vi.stubEnv('NOTIFICATION_API_SECRET', '')
-
+      // NOTIFICATION_API_SECRET задан в beforeEach — обязателен для генерации unsubscribe URL.
+      // Тест проверяет авторизацию через admin сессию (без Authorization header).
       const adminUser = { id: 'admin-user-id' }
       mockGetUser.mockResolvedValue({ data: { user: adminUser } })
 
diff --git a/tests/unit/middleware.test.ts b/tests/unit/middleware.test.ts
index 0a22b02..8f78bc5 100644
--- a/tests/unit/middleware.test.ts
+++ b/tests/unit/middleware.test.ts
@@ -136,6 +136,25 @@ describe('middleware', () => {
 
       expect(response.status).not.toBe(307)
     })
+
+    // [AI-Review][Critical] Story 3.5: unsubscribe маршруты должны быть публичными
+    it('пропускает на /email-preferences без редиректа (публичная страница результата unsubscribe)', async () => {
+      mockGetUser.mockResolvedValue({ data: { user: null } })
+
+      const req = new NextRequest('http://localhost:3000/email-preferences?status=unsubscribed')
+      const response = await updateSession(req)
+
+      expect(response.status).not.toBe(307)
+    })
+
+    it('пропускает на /api/email/unsubscribe без редиректа (GET unsubscribe endpoint)', async () => {
+      mockGetUser.mockResolvedValue({ data: { user: null } })
+
+      const req = new NextRequest('http://localhost:3000/api/email/unsubscribe?uid=test&ts=123&sig=abc')
+      const response = await updateSession(req)
+
+      expect(response.status).not.toBe(307)
+    })
   })
 
   describe('потеря сессии при редиректе', () => {
```
