// Чистые портативные хелперы Edge Function `generate-thumbnail`.
//
// БЕЗ Deno-специфичных глобалов и npm:/esm.sh импортов — файл импортируется
// как Vitest-тестами (стратегия «pure TS in Vitest», см. Story 8.5 Testing Notes),
// так и Deno-обработчиком index.ts. Использует только стандартные Web-API
// (Web Crypto, atob/btoa, URL, TextEncoder), доступные и в Node, и в Deno/edge-runtime.

const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.webm'] as const

/** Ошибка с HTTP-статусом для структурированного ответа Edge Function. */
export class ThumbnailHttpError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ThumbnailHttpError'
    this.status = status
  }
}

function base64UrlToBytes(input: string): Uint8Array<ArrayBuffer> {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
  const binary = atob(padded)
  // Явный ArrayBuffer-бэкенд → тип Uint8Array<ArrayBuffer> (BufferSource для crypto.subtle).
  const bytes = new Uint8Array(new ArrayBuffer(binary.length))
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/**
 * Декодирует `Authorization: Bearer <JWT>`, верифицирует HS256-подпись с
 * `jwtSecret` (defense-in-depth: gateway VERIFY_JWT проверяет ЛЮБОЙ валидный JWT)
 * и возвращает claim `role`. Бросает {@link ThumbnailHttpError} при любой проблеме.
 */
export async function decodeJwtRole(
  authHeader: string | null,
  jwtSecret: string
): Promise<string> {
  if (!jwtSecret) {
    throw new ThumbnailHttpError(500, 'JWT_SECRET ni nastavljen')
  }

  const match = /^Bearer\s+(.+)$/i.exec((authHeader ?? '').trim())
  if (!match) {
    throw new ThumbnailHttpError(401, 'Manjka veljaven Authorization Bearer žeton')
  }

  const parts = match[1].trim().split('.')
  if (parts.length !== 3) {
    throw new ThumbnailHttpError(401, 'Neveljaven JWT')
  }
  const [headerB64, payloadB64, signatureB64] = parts

  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(jwtSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  )
  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    base64UrlToBytes(signatureB64),
    encoder.encode(`${headerB64}.${payloadB64}`)
  )
  if (!valid) {
    throw new ThumbnailHttpError(401, 'Neveljaven podpis JWT')
  }

  let payload: { role?: unknown }
  try {
    payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payloadB64)))
  } catch {
    throw new ThumbnailHttpError(401, 'Neveljaven JWT payload')
  }

  if (typeof payload.role !== 'string') {
    throw new ThumbnailHttpError(403, 'JWT brez role claim')
  }
  return payload.role
}

/** Пропускает только `service_role`; иначе 403 (gateway пропускает любой валидный JWT). */
export function assertServiceRole(role: string): void {
  if (role !== 'service_role') {
    throw new ThumbnailHttpError(403, 'Dostop dovoljen samo za service_role')
  }
}

/**
 * SSRF-allowlist на стороне Edge Function (defense-in-depth). `video_url`
 * приходит с ПУБЛИЧНОГО хоста, поэтому сверяется с `publicUrl` (SUPABASE_PUBLIC_URL),
 * а не с internal `http://kong:8000`. Зеркалит проверку Vercel-route.
 */
export function assertAllowedVideoUrl(videoUrl: string, publicUrl: string): void {
  if (!publicUrl) {
    throw new ThumbnailHttpError(500, 'SUPABASE_PUBLIC_URL ni nastavljen')
  }

  const base = publicUrl.replace(/\/+$/, '')
  const allowedPrefix = `${base}/storage/v1/object/public/post_media/posts/`
  if (!videoUrl.startsWith(allowedPrefix)) {
    throw new ThumbnailHttpError(400, 'Neveljaven video_url')
  }

  const objectPath = videoUrl.split('?')[0].toLowerCase()
  const isVideo = VIDEO_EXTENSIONS.some((ext) => objectPath.endsWith(ext))
  if (!isVideo) {
    throw new ThumbnailHttpError(400, 'Neveljaven video_url')
  }
}

/**
 * Путь thumbnail в bucket `post_media`. ИНВАРИАНТ: результат обязан совпадать с
 * `getThumbnailStoragePath` (src/lib/media/uploadThumbnail.ts) — защищён тестом.
 */
export function buildThumbnailPath(postMediaId: string): string {
  return `thumbnails/${postMediaId}_thumb.jpg`
}
