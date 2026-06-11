// Edge Function `generate-thumbnail` (Deno, supabase/edge-runtime).
//
// Реализует HTTP-контракт Story 8.5 (движок-за-контрактом):
//   POST /functions/v1/generate-thumbnail
//   Authorization: Bearer <SERVICE_ROLE_KEY>
//   body: { post_media_id: string, video_url: string }
//   → 200 { thumbnail_url } | 4xx/5xx { error }
//
// Потребители контракта: 8.1 save-time fallback (через Vercel-route + serverThumbnail.ts)
// и 8.3 bulk (та же функция, concurrency ≤5). Движок (extractFrame.ts) изолирован.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import {
  decodeJwtRole,
  assertServiceRole,
  assertAllowedVideoUrl,
  buildThumbnailPath,
  ThumbnailHttpError,
} from '../_shared/validation.ts'
import { extractThumbnailJpeg } from './extractFrame.ts'

const STORAGE_BUCKET = 'post_media'
const THUMBNAIL_MIME = 'image/jpeg'

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  // Internal http://kong:8000 для Storage/DB; SUPABASE_PUBLIC_URL — для SSRF-allowlist.
  const jwtSecret = Deno.env.get('JWT_SECRET') ?? ''
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const publicUrl = Deno.env.get('SUPABASE_PUBLIC_URL') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

  try {
    // 1. JWT role (defense-in-depth: gateway VERIFY_JWT пропускает ЛЮБОЙ валидный JWT).
    const role = await decodeJwtRole(req.headers.get('Authorization'), jwtSecret)
    assertServiceRole(role)

    // 2. Body (snake_case — серверный контракт).
    let body: { post_media_id?: unknown; video_url?: unknown }
    try {
      body = await req.json()
    } catch {
      throw new ThumbnailHttpError(400, 'Neveljaven JSON')
    }
    if (typeof body !== 'object' || body === null) {
      throw new ThumbnailHttpError(400, 'Neveljaven body')
    }
    const postMediaId = typeof body.post_media_id === 'string' ? body.post_media_id.trim() : ''
    const videoUrl = typeof body.video_url === 'string' ? body.video_url.trim() : ''
    if (!postMediaId || !videoUrl) {
      throw new ThumbnailHttpError(400, 'Manjka post_media_id ali video_url')
    }

    // 3. SSRF-allowlist (публичный хост — video_url приходит с публичного домена).
    assertAllowedVideoUrl(videoUrl, publicUrl)

    if (!supabaseUrl || !serviceKey) {
      throw new ThumbnailHttpError(500, 'Supabase okolje ni nastavljeno')
    }
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // 4. Скачать видео (abort — клиент мог отменить по бюджету 2500 мс, Subtask 1.5).
    if (req.signal.aborted) throw new ThumbnailHttpError(499, 'Prekinjeno')
    const videoRes = await fetch(videoUrl, { signal: req.signal })
    if (!videoRes.ok) {
      throw new ThumbnailHttpError(502, `Videa ni mogoče prenesti (HTTP ${videoRes.status})`)
    }
    const videoBytes = new Uint8Array(await videoRes.arrayBuffer())

    // 5. Извлечь кадр → JPEG 640×360.
    if (req.signal.aborted) throw new ThumbnailHttpError(499, 'Prekinjeno')
    let jpeg: Uint8Array
    try {
      jpeg = await extractThumbnailJpeg(videoBytes)
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'neznana napaka'
      throw new ThumbnailHttpError(502, `Generiranje sličice ni uspelo: ${detail}`)
    }

    // 6. Upload в Storage (idempotent upsert — повторный/прерванный вызов безопасен).
    if (req.signal.aborted) throw new ThumbnailHttpError(499, 'Prekinjeno')
    const path = buildThumbnailPath(postMediaId)
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, jpeg, { contentType: THUMBNAIL_MIME, upsert: true, cacheControl: '3600' })
    if (uploadError) {
      throw new ThumbnailHttpError(502, `Nalaganje sličice ni uspelo: ${uploadError.message}`)
    }

    const { data: publicData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path)
    const thumbnailUrl = publicData.publicUrl

    // 7. Update post_media.thumbnail_url (throw при 0 строк — паттерн updateThumbnailUrl).
    const { data: updated, error: updateError } = await supabase
      .from('post_media')
      .update({ thumbnail_url: thumbnailUrl })
      .eq('id', postMediaId)
      .select('id')
    if (updateError) {
      throw new ThumbnailHttpError(502, `Shranjevanje sličice ni uspelo: ${updateError.message}`)
    }
    if (!updated || updated.length === 0) {
      throw new ThumbnailHttpError(404, `Vrstica post_media ${postMediaId} ni bila posodobljena`)
    }

    return jsonResponse({ thumbnail_url: thumbnailUrl }, 200)
  } catch (err) {
    if (err instanceof ThumbnailHttpError) {
      return jsonResponse({ error: err.message }, err.status)
    }
    if (err instanceof Error && err.name === 'AbortError') {
      return jsonResponse({ error: 'Prekinjeno' }, 499)
    }
    console.error('[generate-thumbnail] nepričakovana napaka:', err)
    return jsonResponse({ error: 'Notranja napaka' }, 500)
  }
})
