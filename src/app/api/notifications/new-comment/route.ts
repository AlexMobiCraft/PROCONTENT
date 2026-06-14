export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendNewCommentNotification } from '@/lib/notifications/sendNewCommentNotification'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * POST /api/notifications/new-comment
 *
 * Вызывается клиентом fire-and-forget после успешной вставки комментария.
 * Отправляет email автору поста (если комментатор ≠ автор).
 *
 * Авторизация: Supabase сессия (авторизованный пользователь).
 * Body: { "post_id": "uuid" }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // --- Авторизация через сессию ---
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // --- Парсинг и валидация body ---
  let postId: string
  try {
    const body = await request.json()
    postId = body?.post_id
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!postId || typeof postId !== 'string' || !UUID_REGEX.test(postId)) {
    return NextResponse.json({ error: 'Invalid or missing post_id' }, { status: 400 })
  }

  // --- Имя комментатора из профиля (server-side, не из клиентского body) ---
  const { data: commenterProfile } = await supabase
    .from('profiles')
    .select('display_name, first_name, last_name')
    .eq('id', user.id)
    .single()

  if (!commenterProfile) {
    console.warn(`[notifications/new-comment] Commenter profile not found for user ${user.id}`)
  }

  const commenterName = resolveDisplayName(commenterProfile)

  // --- Отправка уведомления ---
  try {
    const result = await sendNewCommentNotification({
      post_id: postId,
      commenter_id: user.id,
      commenter_name: commenterName,
    })

    if ('skipped' in result) {
      console.info(`[notifications/new-comment] Skipped: ${result.skipped}`)
      return NextResponse.json(result)
    }

    console.info(
      `[notifications/new-comment] Sent ${result.sent}/${result.sent + result.failed}, failed: ${result.failed}`
    )
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[notifications/new-comment] Failed:', message)
    return NextResponse.json({ error: 'Failed to send notification' }, { status: 500 })
  }
}

function resolveDisplayName(
  profile: { display_name: string | null; first_name: string; last_name: string | null } | null
): string {
  if (!profile) return 'Član/-ica'
  if (profile.display_name && profile.display_name.trim()) {
    return profile.display_name.trim()
  }
  const full = [profile.first_name, profile.last_name].filter(Boolean).join(' ')
  return full || 'Član/-ica'
}
