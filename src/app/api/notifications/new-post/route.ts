export const dynamic = 'force-dynamic'

import { timingSafeEqual, createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { sendNewPostNotification } from '@/lib/notifications/sendNewPostNotification'

interface PostPayload {
  id: string
  title: string
  excerpt?: string
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * POST /api/notifications/new-post
 *
 * Тонкая обёртка для admin/ручного вызова рассылки о новом посте.
 * Внутренние публикации (cron/publish, posts/publish) вызывают
 * sendNewPostNotification напрямую — БЕЗ HTTP self-fetch, поэтому этот route
 * остаётся непубличным (не добавляется в PUBLIC_PATH_PREFIXES).
 *
 * Авторизация (одно из двух):
 *   1. Header: Authorization: Bearer <NOTIFICATION_API_SECRET>  (Supabase DB Webhook)
 *   2. Supabase session с ролью admin (ручной вызов)
 *
 * Body (JSON):
 *   { "id": "post-uuid", "title": "Заголовок поста", "excerpt"?: "..." }
 *   или Supabase DB Webhook: { "type": "INSERT", "table": "posts", "record": { id, title, ... } }
 *
 * Note: partial send failures intentionally return HTTP 200.
 * Returning non-2xx would cause Supabase webhook retries and duplicate emails
 * to subscribers who were already successfully notified.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // --- Авторизация ---
  const authorized = await isAuthorized(request)
  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // --- Парсинг тела ---
  // Поддерживаем два формата:
  //   1. Прямой: { id, title, excerpt? }  (ручной вызов / Server Action)
  //   2. Supabase DB Webhook: { type: "INSERT", table: "posts", record: { id, title, ... } }
  let post: PostPayload
  try {
    const rawBody = await request.json()
    if (rawBody === null || typeof rawBody !== 'object' || Array.isArray(rawBody)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }
    post = (rawBody as Record<string, unknown>).record ?? rawBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!post.id || !post.title || typeof post.id !== 'string' || typeof post.title !== 'string') {
    return NextResponse.json({ error: 'Missing required fields: id, title' }, { status: 400 })
  }

  if (!UUID_REGEX.test(post.id)) {
    return NextResponse.json({ error: 'Invalid post id: must be a valid UUID' }, { status: 400 })
  }

  // --- Делегирование рассылки ---
  // env-guard, загрузка подписчиков, сборка писем и отправка — внутри функции.
  // partial-fail → функция возвращает { sent, failed } → HTTP 200.
  // hard-ошибки (нет env / ошибка БД / Resend) → throw → HTTP 500.
  try {
    const result = await sendNewPostNotification({
      id: post.id,
      title: post.title,
      excerpt: post.excerpt,
    })
    console.info(
      `[notifications] Sent ${result.sent}/${result.sent + result.failed}, failed: ${result.failed}`
    )
    return NextResponse.json({ sent: result.sent, failed: result.failed })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[notifications] Notification failed:', message)
    return NextResponse.json({ error: 'Failed to send notification' }, { status: 500 })
  }
}

async function isAuthorized(request: NextRequest): Promise<boolean> {
  // 1. Проверка секретного ключа (для Supabase Database Webhook)
  const apiSecret = process.env.NOTIFICATION_API_SECRET
  if (apiSecret && apiSecret.trim()) {
    const authHeader = request.headers.get('Authorization') ?? ''
    const expected = `Bearer ${apiSecret}`
    // Hash both values to avoid leaking the secret length via timing
    const a = createHash('sha256').update(authHeader).digest()
    const b = createHash('sha256').update(expected).digest()
    if (timingSafeEqual(a, b)) {
      return true
    }
  } else {
    console.warn(
      '[notifications] NOTIFICATION_API_SECRET is not set — only admin session auth is available'
    )
  }

  // 2. Проверка сессии admin
  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return false

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    return profile?.role === 'admin'
  } catch (err) {
    console.error('[notifications] isAuthorized error:', err instanceof Error ? err.message : err)
    return false
  }
}
