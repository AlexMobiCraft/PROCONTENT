export const dynamic = 'force-dynamic'

import { timingSafeEqual, createHash } from 'crypto'
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
  excerpt?: string
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

export const PAGE_SIZE = 1000

type SubscriberQueryError = {
  message: string
  details: string
  hint: string
  code: string
}

/**
 * Загружает всех активных подписчиков постранично, обходя лимит Supabase (1000 строк по умолчанию).
 * Запрашивает PAGE_SIZE+1 строк для обнаружения следующей страницы без лишнего запроса к БД.
 */
async function fetchAllSubscribers(supabase: ReturnType<typeof createAdminClient>): Promise<{
  data: Array<{ email: string | null; display_name: string | null }> | null
  error: SubscriberQueryError | null
}> {
  const all: Array<{ email: string | null; display_name: string | null }> = []
  let offset = 0

  for (;;) {
    const { data, error } = await supabase
      .from('profiles')
      .select('email, display_name')
      .in('subscription_status', ['active', 'trialing'])
      .not('email', 'is', null)
      .order('id')
      .range(offset, offset + PAGE_SIZE)

    if (error) return { data: null, error }
    if (!data || data.length === 0) break

    const hasMore = data.length > PAGE_SIZE
    all.push(...(hasMore ? data.slice(0, PAGE_SIZE) : data))
    if (!hasMore) break

    offset += PAGE_SIZE
  }

  return { data: all, error: null }
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
  // Поддерживаем два формата:
  //   1. Прямой: { id, title, excerpt? }  (ручной вызов / Server Action)
  //   2. Supabase DB Webhook: { type: "INSERT", table: "posts", record: { id, title, ... } }
  let post: PostPayload
  try {
    const rawBody = await request.json()
    post = rawBody?.record ?? rawBody
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
  const { data: subscribers, error: dbError } = await fetchAllSubscribers(supabase)

  if (dbError) {
    console.error('[notifications] Failed to fetch subscribers:', dbError.message)
    return NextResponse.json({ error: 'Failed to fetch subscribers' }, { status: 500 })
  }

  // Фильтруем подписчиков без валидного email (null, пустой, без символа @)
  const validSubscribers = (subscribers ?? []).filter(
    (s): s is typeof s & { email: string } =>
      Boolean(s.email && s.email.trim() !== '' && s.email.includes('@'))
  )

  if (validSubscribers.length === 0) {
    return NextResponse.json({ sent: 0, message: 'No active subscribers' })
  }

  // --- Формирование писем ---
  const normalizedSiteUrl = siteUrl.replace(/\/$/, '')
  const postUrl = `${normalizedSiteUrl}/feed/${post.id}`
  const unsubscribeUrl = `${normalizedSiteUrl}/profile`

  const messages = validSubscribers.map((s) => ({
    to: s.email,
    subject: `Nova objava: ${post.title}`,
    html: generateNewPostEmailHtml({
      postTitle: post.title,
      postUrl,
      postExcerpt: post.excerpt,
      recipientName: s.display_name,
      unsubscribeUrl,
    }),
    text: generateNewPostEmailText({
      postTitle: post.title,
      postUrl,
      postExcerpt: post.excerpt,
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
