export const dynamic = 'force-dynamic'

import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'
import { sendEmailBatch } from '@/lib/email'
import {
  generateNewPostEmailHtml,
  generateNewPostEmailText,
} from '@/lib/email/templates/new-post'
import type { Database } from '@/types/supabase'

interface PostPayload {
  id: string
  title: string
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('[notifications] Missing Supabase env vars (URL / SERVICE_ROLE_KEY)')
  }

  return createSupabaseAdminClient<Database>(url, key)
}

/**
 * POST /api/notifications/new-post
 *
 * Отправляет email-уведомление о новом посте всем активным подписчикам.
 *
 * Авторизация (одно из двух):
 *   1. Header: Authorization: Bearer <NOTIFICATION_API_SECRET>  (Supabase DB Webhook)
 *   2. Supabase session с ролью admin (ручной вызов)
 *
 * Body (JSON):
 *   { "id": "post-uuid", "title": "Заголовок поста" }
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
  let post: PostPayload
  try {
    post = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!post.id || !post.title || typeof post.id !== 'string' || typeof post.title !== 'string') {
    return NextResponse.json({ error: 'Missing required fields: id, title' }, { status: 400 })
  }

  if (!UUID_REGEX.test(post.id)) {
    return NextResponse.json({ error: 'Invalid post id: must be a valid UUID' }, { status: 400 })
  }

  // --- Валидация SITE_URL ---
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  if (!siteUrl) {
    console.error('[notifications] NEXT_PUBLIC_SITE_URL is not configured')
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }

  // --- Получение активных подписчиков ---
  const supabase = createAdminClient()
  const { data: subscribers, error: dbError } = await supabase
    .from('profiles')
    .select('email, display_name')
    .eq('subscription_status', 'active')

  if (dbError) {
    console.error('[notifications] Failed to fetch subscribers:', dbError.message)
    return NextResponse.json({ error: 'Failed to fetch subscribers' }, { status: 500 })
  }

  // Фильтруем подписчиков без валидного email
  const validSubscribers = (subscribers ?? []).filter(
    (s): s is typeof s & { email: string } => Boolean(s.email && s.email.trim() !== '')
  )

  if (validSubscribers.length === 0) {
    return NextResponse.json({ sent: 0, message: 'No active subscribers' })
  }

  // --- Формирование писем ---
  const postUrl = `${siteUrl}/feed/${post.id}`
  const unsubscribeUrl = `${siteUrl}/profile`

  const messages = validSubscribers.map((s) => ({
    to: s.email,
    subject: `Nova objava: ${post.title}`,
    html: generateNewPostEmailHtml({
      postTitle: post.title,
      postUrl,
      recipientName: s.display_name,
      unsubscribeUrl,
    }),
    text: generateNewPostEmailText({
      postTitle: post.title,
      postUrl,
      recipientName: s.display_name,
      unsubscribeUrl,
    }),
  }))

  // --- Пакетная отправка ---
  try {
    const result = await sendEmailBatch(messages)
    console.info(`[notifications] Sent ${result.sent}/${messages.length}, failed: ${result.failed}`)
    return NextResponse.json({ sent: result.sent, failed: result.failed })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[notifications] Batch send failed:', message)
    return NextResponse.json({ error: 'Failed to send emails' }, { status: 500 })
  }
}

async function isAuthorized(request: NextRequest): Promise<boolean> {
  // 1. Проверка секретного ключа (для Supabase Database Webhook)
  const apiSecret = process.env.NOTIFICATION_API_SECRET
  if (apiSecret) {
    const authHeader = request.headers.get('Authorization') ?? ''
    const expected = `Bearer ${apiSecret}`
    const a = Buffer.from(authHeader)
    const b = Buffer.from(expected)
    if (a.length === b.length && timingSafeEqual(a, b)) {
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
