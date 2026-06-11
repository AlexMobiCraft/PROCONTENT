import 'server-only'

// Тонкий клиент HTTP-контракта Edge Function `generate-thumbnail` (Story 8.5).
//
// SERVER-ONLY: использует SUPABASE_SERVICE_ROLE_KEY — НЕ импортировать в client-код
// (иначе секрет утечёт в браузерный бандл). Цепочка вызова:
//   браузер postThumbnails.ts → /api/admin/generate-thumbnail-fallback (Vercel server)
//                                  → requestServerThumbnail → Edge Function
// Тот же клиент переиспользует 8.3 bulk (concurrency ≤5) — без дублирования движка.

const DEFAULT_TIMEOUT_MS = 25_000

/** Ошибка с HTTP-статусом ответа Edge Function (для маппинга в route: 4xx→500, иначе→502). */
export class ServerThumbnailError extends Error {
  readonly status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'ServerThumbnailError'
    this.status = status
  }
}

interface RequestServerThumbnailArgs {
  postMediaId: string
  videoUrl: string
}

export async function requestServerThumbnail(
  { postMediaId, videoUrl }: RequestServerThumbnailArgs,
  signal?: AbortSignal
): Promise<{ thumbnail_url: string }> {
  // Env-guard ВНЕ try/catch (правило проекта #6: конфиг-ошибки не замалчиваются).
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const functionsBase =
    process.env.SUPABASE_FUNCTIONS_URL ||
    (supabaseUrl ? `${supabaseUrl}/functions/v1` : undefined)
  if (!functionsBase || !serviceKey) {
    throw new Error(
      '[serverThumbnail] Manjkajo okoljske spremenljivke (SUPABASE_FUNCTIONS_URL/NEXT_PUBLIC_SUPABASE_URL ali SUPABASE_SERVICE_ROLE_KEY)'
    )
  }

  const timeoutMs = Number(process.env.SERVER_THUMBNAIL_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS
  const endpoint = `${functionsBase.replace(/\/+$/, '')}/generate-thumbnail`

  // Комбинируем внешний сигнал (бюджет вызывающего) с собственным таймаутом.
  const controller = new AbortController()
  const onExternalAbort = () => controller.abort()
  if (signal) {
    if (signal.aborted) controller.abort()
    else signal.addEventListener('abort', onExternalAbort, { once: true })
  }
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceKey}`,
      },
      // snake_case — серверный контракт Edge Function.
      body: JSON.stringify({ post_media_id: postMediaId, video_url: videoUrl }),
      signal: controller.signal,
    })

    if (!res.ok) {
      let detail = ''
      try {
        const data = await res.json()
        detail = typeof data?.error === 'string' ? data.error : ''
      } catch {
        // тело не JSON — игнорируем
      }
      throw new ServerThumbnailError(
        `Strežniško generiranje sličice ni uspelo: HTTP ${res.status}${detail ? ` — ${detail}` : ''}`,
        res.status
      )
    }

    const data = await res.json()
    if (typeof data?.thumbnail_url !== 'string') {
      throw new ServerThumbnailError('Odgovor Edge Function brez thumbnail_url')
    }
    return { thumbnail_url: data.thumbnail_url }
  } finally {
    clearTimeout(timer)
    if (signal) signal.removeEventListener('abort', onExternalAbort)
  }
}
