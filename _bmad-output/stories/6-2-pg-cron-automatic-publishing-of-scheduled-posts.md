# Story 6.2: pg_cron — Автоматическая публикация запланированных постов

Status: ready-for-dev

## Story

As a автор,
I want посты со статусом `scheduled` автоматически публиковались в назначенное время,
so that контент выходит без моего присутствия онлайн, а участницы получают стандартное email-уведомление.

## Acceptance Criteria

1. **Авторизация cron endpoint:**
   - `POST /api/cron/publish` без заголовка `Authorization` → `401 Unauthorized`
   - `POST /api/cron/publish` с неверным токеном → `401 Unauthorized`
   - `POST /api/cron/publish` с валидным `Authorization: Bearer {CRON_SECRET}` → обработка запроса (NFR6.4)

2. **Атомарная публикация:**
   - Выполняется SQL: `UPDATE posts SET status='published', published_at=now() WHERE status='scheduled' AND scheduled_at <= now() AND published_at IS NULL RETURNING id, title, excerpt`
   - Возвращает список опубликованных постов (race condition исключён — одна транзакция) (NFR6.13)

3. **Email-уведомления:**
   - Для каждого опубликованного поста вызывается `POST /api/notifications/new-post` с `{ id, title, excerpt }` и `Authorization: Bearer {NOTIFICATION_API_SECRET}` (FR6.17)

4. **Идемпотентность:**
   - Повторный запуск через 5 минут не затрагивает посты с `published_at IS NOT NULL` — повторный email не отправляется (FR6.18, NFR6.7)

5. **Изоляция ошибок email:**
   - Сбой email одного поста (например, сбой Resend) логируется, но остальные посты публикуются и получают email (NFR6.9)

6. **Обработка downtime:**
   - `scheduled_at <= now()` автоматически захватывает все пропущенные посты при следующем запуске — специальный catch-up не нужен (FR6.11, NFR6.8)

7. **pg_cron задача:**
   - В Supabase создана задача `cron.schedule('publish-scheduled-posts', '*/5 * * * *', ...)` вызывающая endpoint каждые 5 минут

## Tasks / Subtasks

- [ ] Task 1: Создать Route Handler `src/app/api/cron/publish/route.ts` (AC: 1, 2, 3, 4, 5, 6)
  - [ ] 1.1 `export const dynamic = 'force-dynamic'` и импорты
  - [ ] 1.2 Функция `isAuthorized(request)` — проверка `Authorization: Bearer {CRON_SECRET}` через `timingSafeEqual`
  - [ ] 1.3 `createAdminClient()` — service role key, типизация `Database`
  - [ ] 1.4 Атомарный UPDATE через `supabase.from('posts').update(...).eq('status', 'scheduled').lte('scheduled_at', new Date().toISOString()).is('published_at', null).select('id, title, excerpt')`
  - [ ] 1.5 Цикл по опубликованным постам: `fetch('/api/notifications/new-post', ...)` per post в try/catch (изоляция ошибок)
  - [ ] 1.6 Возврат `{ published: N, emailErrors: [...] }` с `200`
  - [ ] 1.7 Guard: если `CRON_SECRET` не задан в env → `500` с логом `[cron] CRON_SECRET not configured`

- [ ] Task 2: Добавить `CRON_SECRET` в конфигурацию окружения (AC: 1)
  - [ ] 2.1 Добавить `CRON_SECRET` в `.env.local` (генерировать: `openssl rand -hex 32`)
  - [ ] 2.2 Добавить в Vercel Environment Variables (Production + Preview)

- [ ] Task 3: Зарегистрировать pg_cron задачу в Supabase (AC: 7)
  - [ ] 3.1 Выполнить SQL в Supabase SQL Editor для создания cron-задачи
  - [ ] 3.2 Убедиться, что `pg_net` extension включён в Supabase проекте

- [ ] Task 4: Написать тесты (AC: 1–5)
  - [ ] 4.1 401 при отсутствии/неверном Authorization
  - [ ] 4.2 200 + список published постов при валидном запросе
  - [ ] 4.3 Идемпотентность: посты с `published_at IS NOT NULL` не затрагиваются
  - [ ] 4.4 Изоляция ошибок: сбой email одного поста не прерывает цикл

## Dev Notes

### Обязательная предварительная зависимость

**Story 6.1 ДОЛЖНА быть выполнена до этой story.** Без миграции Story 6.1 поля `status`, `scheduled_at`, `published_at` в таблице `posts` не существуют. Убедись, что миграция применена до начала разработки.

### Структура нового файла

```
src/app/api/cron/publish/route.ts   ← новый файл
```

Не создавай никаких других файлов — вся логика в одном Route Handler.

### Паттерн Route Handler (ОБЯЗАТЕЛЬНО следовать)

Следуй паттерну из `src/app/api/webhooks/stripe/route.ts` и `src/app/api/notifications/new-post/route.ts`:

```typescript
export const dynamic = 'force-dynamic'

import { timingSafeEqual, createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('[cron] Missing Supabase env vars')
  }
  return createSupabaseAdminClient<Database>(url, key)
}
```

Используй `@supabase/supabase-js` напрямую (не `@/lib/supabase/server`) — нужен service role key для обхода RLS.

### Авторизация через timingSafeEqual (ОБЯЗАТЕЛЬНО)

```typescript
function isAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return false
  
  const authHeader = request.headers.get('Authorization') ?? ''
  const expected = `Bearer ${cronSecret}`
  const a = createHash('sha256').update(authHeader).digest()
  const b = createHash('sha256').update(expected).digest()
  return timingSafeEqual(a, b)
}
```

Тот же паттерн что в `notifications/new-post/route.ts:232-246` — hashing перед сравнением для защиты от timing attacks.

### Атомарный SQL-запрос (КРИТИЧНО для идемпотентности)

НЕ использовать два отдельных запроса (SELECT потом UPDATE). Используй Supabase `.update().eq().lte().is().select()` цепочку или raw SQL через `supabase.rpc()`.

Вариант через Supabase query builder:
```typescript
const { data: published, error } = await supabase
  .from('posts')
  .update({ status: 'published', published_at: new Date().toISOString() })
  .eq('status', 'scheduled')
  .lte('scheduled_at', new Date().toISOString())
  .is('published_at', null)
  .select('id, title, excerpt')
```

Это эквивалентно `UPDATE ... WHERE status='scheduled' AND scheduled_at <= now() AND published_at IS NULL RETURNING id, title, excerpt`.

Условие `published_at IS NULL` — ключевое для идемпотентности: повторный запуск не трогает уже опубликованные посты.

### Email-интеграция: ПЕРЕИСПОЛЬЗУЙ существующий endpoint

**НЕ дублировать email-логику.** Существующий `POST /api/notifications/new-post` (`src/app/api/notifications/new-post/route.ts`) уже делает всё:
- Получает активных подписчиков с `email_notifications_enabled=true`
- Генерирует письма с unsubscribe URL
- Отправляет через Resend

Вызывай его для каждого опубликованного поста:
```typescript
await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/notifications/new-post`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.NOTIFICATION_API_SECRET}`,
  },
  body: JSON.stringify({ id: post.id, title: post.title, excerpt: post.excerpt }),
})
```

Endpoint принимает `{ id, title, excerpt? }` (прямой формат, не Supabase webhook формат). Аутентификация через `NOTIFICATION_API_SECRET` (уже существует в env).

### Изоляция ошибок email (NFR6.9)

```typescript
for (const post of published) {
  try {
    // fetch к notifications endpoint
  } catch (err) {
    console.error(`[cron] Email failed for post ${post.id}:`, err)
    emailErrors.push({ postId: post.id, error: String(err) })
    // продолжаем цикл — не прерываем остальные посты
  }
}
```

Ошибка email логируется, но `published_at` уже установлен — повторный запуск не вернёт этот пост в очередь. Таким образом, email при сбое будет потерян (acceptable для MVP, см. NFR6.9).

### pg_cron SQL для Supabase (выполнить в SQL Editor)

```sql
-- Убедись, что pg_net extension включён (Settings > Extensions)
-- Затем создай cron-задачу:
SELECT cron.schedule(
  'publish-scheduled-posts',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_APP_URL/api/cron/publish',
    headers := '{"Authorization": "Bearer YOUR_CRON_SECRET", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  )
  $$
);
```

Замени `YOUR_APP_URL` на `NEXT_PUBLIC_SITE_URL` из окружения. Замени `YOUR_CRON_SECRET` на значение из `CRON_SECRET`.

Проверить активные задачи: `SELECT * FROM cron.job;`

### snake_case (ОБЯЗАТЕЛЬНО)

Поля из БД используются напрямую: `post.status`, `post.scheduled_at`, `post.published_at`. **Не маппить в camelCase** (eslint правило `camelcase` отключено для DB-полей).

### Новая переменная окружения

`CRON_SECRET` — новая переменная, нужно добавить:
- В `.env.local` для локальной разработки (генерировать: `openssl rand -hex 32`)
- В Vercel Environment Variables (Production + Preview)

Уже существующие и используемые:
- `NOTIFICATION_API_SECRET` — для вызова email endpoint
- `SUPABASE_SERVICE_ROLE_KEY` — для admin client
- `NEXT_PUBLIC_SUPABASE_URL` — для admin client
- `NEXT_PUBLIC_SITE_URL` — для формирования URL endpoint

### Производительность (NFR6.3)

Функция должна выполняться ≤ 30 секунд. При большом количестве постов (маловероятно для PROCONTENT MVP) рассмотри `Promise.allSettled` вместо sequential loop для email-вызовов. Для MVP sequential достаточно.

### Project Structure Notes

- **Новый файл:** `src/app/api/cron/publish/route.ts` — Route Handler в директории `cron/publish/`
- **Не трогать:** `src/app/api/notifications/new-post/route.ts` — переиспользуется без изменений
- **Не трогать:** `src/features/admin/` — будет расширен в Story 6.3 и 6.4
- Директория `src/app/api/cron/` создаётся впервые

### References

- [Source: epics.md#Epic-6-Story-6.2] — полные Acceptance Criteria и технические требования
- [Source: epics.md#Additional-Requirements-Epic-6] — pg_cron, cron endpoint, атомарность
- [Source: src/app/api/notifications/new-post/route.ts] — email endpoint паттерн, авторизация
- [Source: src/app/api/webhooks/stripe/route.ts] — паттерн createAdminClient, service role
- [Source: epics.md#NFR6.4, NFR6.7, NFR6.9, NFR6.13] — требования безопасности и идемпотентности
- [Source: _bmad-output/planning-artifacts/product-brief-scheduled-publishing.md] — бизнес-контекст

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6[1m]

### Debug Log References

### Completion Notes List

### File List
