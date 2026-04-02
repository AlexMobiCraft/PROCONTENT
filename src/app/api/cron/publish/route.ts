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

function isAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return false

  const authHeader = request.headers.get('Authorization') ?? ''
  const expected = `Bearer ${cronSecret}`
  const a = createHash('sha256').update(authHeader).digest()
  const b = createHash('sha256').update(expected).digest()
  return timingSafeEqual(a, b)
}

/**
 * POST /api/cron/publish
 *
 * Атомарно публикует все посты со статусом `scheduled`, у которых
 * `scheduled_at <= now()` и `published_at IS NULL`.
 * Для каждого опубликованного поста вызывает /api/notifications/new-post.
 *
 * Авторизация: Authorization: Bearer <CRON_SECRET>
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // Guard: CRON_SECRET должен быть настроен
  if (!process.env.CRON_SECRET) {
    console.error('[cron] CRON_SECRET not configured')
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }

  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let supabase: ReturnType<typeof createAdminClient>
  try {
    supabase = createAdminClient()
  } catch (err) {
    console.error('[cron] Admin client initialization failed:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }

  // Атомарный UPDATE — идемпотентен благодаря условию published_at IS NULL
  const now = new Date().toISOString()
  const { data: published, error } = await supabase
    .from('posts')
    .update({ status: 'published', published_at: now })
    .eq('status', 'scheduled')
    .lte('scheduled_at', now)
    .is('published_at', null)
    .select('id, title, excerpt')

  if (error) {
    console.error('[cron] Failed to publish scheduled posts:', error.message)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  const posts = published ?? []
  console.info(`[cron] Published ${posts.length} scheduled post(s)`)

  // Проверяем env vars перед отправкой уведомлений
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  const notificationSecret = process.env.NOTIFICATION_API_SECRET

  if (!siteUrl) {
    console.error('[cron] NEXT_PUBLIC_SITE_URL not configured — all notifications will fail')
  }
  if (!notificationSecret) {
    console.error('[cron] NOTIFICATION_API_SECRET not configured — all notifications will fail')
  }

  // Отправляем email-уведомления, изолируя ошибки каждого поста
  const emailErrors: Array<{ postId: string; error: string }> = []

  for (const post of posts) {
    if (!siteUrl || !notificationSecret) {
      emailErrors.push({ postId: post.id, error: 'Notification env vars not configured' })
      continue
    }

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10_000)

      let response: Response
      try {
        response = await fetch(`${siteUrl}/api/notifications/new-post`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${notificationSecret}`,
          },
          body: JSON.stringify({ id: post.id, title: post.title, excerpt: post.excerpt }),
          signal: controller.signal,
        })
      } finally {
        clearTimeout(timeoutId)
      }

      // Потребляем body для возврата соединения в пул
      const status = response.status
      const ok = response.ok
      await response.body?.cancel()
      if (!ok) {
        throw new Error(`HTTP ${status}`)
      }
    } catch (err) {
      console.error(`[cron] Email failed for post ${post.id}:`, err)
      emailErrors.push({ postId: post.id, error: String(err) })
    }
  }

  return NextResponse.json({ published: posts.length, emailErrors })
}
