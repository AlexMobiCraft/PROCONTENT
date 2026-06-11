export const dynamic = 'force-dynamic'
// Standalone/bulk-путь даёт движку больше времени, чем дефолтные 10 с Vercel-route.
// Save-time fallback всё равно ограничен клиентским бюджетом 2500 мс (AbortController).
export const maxDuration = 30

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requestServerThumbnail, ServerThumbnailError } from '@/lib/media/serverThumbnail'

interface FallbackBody {
  videoUrl?: string
  postMediaId?: string
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const { videoUrl: rawVideoUrl, postMediaId: rawPostMediaId } = body as FallbackBody
  const videoUrl = typeof rawVideoUrl === 'string' ? rawVideoUrl.trim() : ''
  const postMediaId = typeof rawPostMediaId === 'string' ? rawPostMediaId.trim() : ''

  if (!videoUrl || !postMediaId) {
    return NextResponse.json({ error: 'Missing videoUrl or postMediaId' }, { status: 400 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const allowedPrefix = supabaseUrl
    ? `${supabaseUrl}/storage/v1/object/public/post_media/posts/`
    : null
  if (!allowedPrefix || !videoUrl.startsWith(allowedPrefix)) {
    return NextResponse.json({ error: 'Invalid videoUrl' }, { status: 400 })
  }

  const objectPath = videoUrl.split('?')[0].toLowerCase()
  const isVideoObject = ['.mp4', '.mov', '.webm'].some((ext) =>
    objectPath.endsWith(ext)
  )
  if (!isVideoObject) {
    return NextResponse.json({ error: 'Invalid videoUrl' }, { status: 400 })
  }

  try {
    const { thumbnail_url } = await requestServerThumbnail({ postMediaId, videoUrl })
    return NextResponse.json({ thumbnail_url }, { status: 200 })
  } catch (err) {
    const status = err instanceof ServerThumbnailError ? err.status : undefined
    // Неожиданный 4xx от функции (route уже провалидировал вход) → 500, без проброса
    // сырого ответа движка клиенту.
    if (status && status >= 400 && status < 500) {
      console.error('[generate-thumbnail-fallback] Unexpected 4xx from Edge Function:', err)
      return NextResponse.json({ error: 'Thumbnail generation failed' }, { status: 500 })
    }
    // Сбой движка / недоступность / таймаут → 502.
    console.error('[generate-thumbnail-fallback] Edge Function failure:', err)
    return NextResponse.json({ error: 'Thumbnail generation failed' }, { status: 502 })
  }
}
