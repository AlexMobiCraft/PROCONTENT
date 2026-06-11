import { createHmac } from 'crypto'
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'
import { sendEmailBatch } from '@/lib/email'
import {
  generateNewPostEmailHtml,
  generateNewPostEmailText,
} from '@/lib/email/templates/new-post'
import type { Database } from '@/types/supabase'

export const PAGE_SIZE = 1000

export interface NewPostInput {
  id: string
  title: string
  excerpt?: string | null
}

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('[notifications] Missing Supabase env vars (URL / SERVICE_ROLE_KEY)')
  }

  return createSupabaseAdminClient<Database>(url, key)
}

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
  data: Array<{ id: string; email: string | null; display_name: string | null }> | null
  error: SubscriberQueryError | null
}> {
  const all: Array<{ id: string; email: string | null; display_name: string | null }> = []
  let offset = 0

  for (;;) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, display_name')
      .in('subscription_status', ['active', 'trialing'])
      .not('email', 'is', null)
      .eq('email_notifications_enabled', true)
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
 * Генерирует signed unsubscribe URL для конкретного подписчика.
 * Canonical string: `${uid}:${ts}`, подпись HMAC-SHA256 в hex (RFC 8058).
 */
function generateUnsubscribeUrl(baseUrl: string, uid: string, secret: string): string {
  const ts = Math.floor(Date.now() / 1000)
  const canonical = `${uid}:${ts}`
  const sig = createHmac('sha256', secret).update(canonical).digest('hex')
  return `${baseUrl}/api/email/unsubscribe?uid=${encodeURIComponent(uid)}&ts=${ts}&sig=${encodeURIComponent(sig)}`
}

/**
 * Отправляет email-уведомление о новом посте всем активным подписчикам.
 *
 * Чистая async-функция без зависимости от NextRequest/NextResponse —
 * вызывается напрямую из cron/publish и posts/publish (без HTTP self-fetch),
 * а также из тонкой обёртки-route /api/notifications/new-post (admin/ручной вызов).
 *
 * Контракт ошибок:
 *   - partial-fail (часть писем не доставлена) → возвращает `{ sent, failed }`
 *     (НЕ бросает, чтобы не триггерить ретраи/откат публикации);
 *   - hard-ошибки (нет env-конфигурации, ошибка БД при загрузке подписчиков,
 *     ошибка Resend-конфигурации) → бросает исключение.
 *
 * env-guard выполняется ВНЕ try/catch — ошибки конфигурации не замалчиваются.
 * NOTIFICATION_API_SECRET обязателен даже без self-fetch: используется для
 * HMAC-подписи unsubscribe-URL (RFC 8058, List-Unsubscribe).
 */
export async function sendNewPostNotification(
  post: NewPostInput
): Promise<{ sent: number; failed: number }> {
  // --- env-guard (вне try/catch) ---
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  if (!siteUrl) {
    throw new Error('[notifications] NEXT_PUBLIC_SITE_URL is not configured')
  }

  // Секрет обязателен для генерации signed unsubscribe URL (RFC 8058).
  // Без него нельзя добавить List-Unsubscribe заголовки и выполнить one-click unsubscribe.
  const notificationSecret = process.env.NOTIFICATION_API_SECRET
  if (!notificationSecret || !notificationSecret.trim()) {
    throw new Error('[notifications] NOTIFICATION_API_SECRET is not configured')
  }

  // --- Получение активных подписчиков (service-role клиент) ---
  const supabase = createAdminClient()
  const { data: subscribers, error: dbError } = await fetchAllSubscribers(supabase)

  if (dbError) {
    throw new Error(`[notifications] Failed to fetch subscribers: ${dbError.message}`)
  }

  // Фильтруем подписчиков без валидного email (null, пустой, без символа @)
  const validSubscribers = (subscribers ?? []).filter(
    (s): s is typeof s & { id: string; email: string } =>
      Boolean(s.email && s.email.trim() !== '' && s.email.includes('@'))
  )

  if (validSubscribers.length === 0) {
    return { sent: 0, failed: 0 }
  }

  // --- Формирование писем ---
  // Удаляем все trailing slashes (в т.ч. https://example.com//)
  const normalizedSiteUrl = siteUrl.replace(/\/+$/, '')
  const postUrl = `${normalizedSiteUrl}/feed/${post.id}`

  // Санитизируем заголовок: удаляем CR/LF для защиты от SMTP header injection
  const safeTitle = post.title.replace(/[\r\n]/g, '')

  // Нормализуем excerpt: принимаем только непустую строку
  const normalizedExcerpt: string | undefined =
    typeof post.excerpt === 'string' && post.excerpt.trim() !== '' ? post.excerpt : undefined

  const messages = validSubscribers.map((s) => {
    const unsubscribeUrl = generateUnsubscribeUrl(normalizedSiteUrl, s.id, notificationSecret)

    const headers: Record<string, string> = {
      'List-Unsubscribe': `<${unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    }

    return {
      to: s.email,
      subject: `Nova objava: ${safeTitle}`,
      html: generateNewPostEmailHtml({
        postTitle: safeTitle,
        postUrl,
        postExcerpt: normalizedExcerpt,
        recipientName: s.display_name,
        unsubscribeUrl,
      }),
      text: generateNewPostEmailText({
        postTitle: safeTitle,
        postUrl,
        postExcerpt: normalizedExcerpt,
        recipientName: s.display_name,
        unsubscribeUrl,
      }),
      headers,
    }
  })

  // --- Пакетная отправка (sendEmailBatch бросает на hard-ошибках Resend-конфигурации) ---
  return sendEmailBatch(messages)
}
