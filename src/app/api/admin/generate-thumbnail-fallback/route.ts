export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface FallbackBody {
  videoUrl?: string
  postMediaId?: string
}

/**
 * POST /api/admin/generate-thumbnail-fallback
 *
 * Серверный fallback генерации thumbnail из видео (Story 8.1, AC 4).
 * Вызывается, когда Canvas-генерация на клиенте не удалась (CORS / неподдерживаемый формат).
 *
 * Авторизация: только admin (Supabase session + profiles.role === 'admin').
 *
 * ⚠️ Извлечение кадра на сервере (ffmpeg.wasm / системный ffmpeg / внешний сервис)
 * НЕ реализовано по решению (Story 8.1 — вариант "skeleton без новой зависимости") и
 * возвращает 501. Контракт готов к подключению движка: auth, валидация входа,
 * SSRF-защита и путь Storage уже на месте. После подключения движка останется:
 *   1) скачать видео по videoUrl, 2) извлечь кадр, 3) uploadThumbnail(blob, postMediaId),
 *   4) updateThumbnailUrl(postMediaId, url).
 *
 * Body: { videoUrl: string, postMediaId: string }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Auth: сессия пользователя
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Проверка роли admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 3. Парсинг и валидация body
  let body: FallbackBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const videoUrl = typeof body.videoUrl === 'string' ? body.videoUrl.trim() : ''
  const postMediaId = typeof body.postMediaId === 'string' ? body.postMediaId.trim() : ''

  if (!videoUrl || !postMediaId) {
    return NextResponse.json({ error: 'Missing videoUrl or postMediaId' }, { status: 400 })
  }

  // 4. SSRF-защита: videoUrl обязан указывать на наш Supabase Storage
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl || !videoUrl.startsWith(`${supabaseUrl}/storage/`)) {
    return NextResponse.json({ error: 'Invalid videoUrl' }, { status: 400 })
  }

  // 5. Серверное извлечение кадра пока не реализовано (см. JSDoc)
  return NextResponse.json(
    { error: 'Server-side thumbnail generation is not implemented yet' },
    { status: 501 }
  )
}
