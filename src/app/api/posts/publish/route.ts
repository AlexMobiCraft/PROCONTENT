export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'
import { sendNewPostNotification } from '@/lib/notifications/sendNewPostNotification'
import type { Database } from '@/types/supabase'

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('[publish] Missing Supabase env vars')
  }

  return createSupabaseAdminClient<Database>(url, key)
}

/**
 * POST /api/posts/publish
 *
 * Немедленная публикация scheduled поста.
 * Вызывается с клиента — авторизация через Supabase user session (cookies).
 * Обновляет статус на published и отправляет email-уведомление.
 *
 * Body: { postId: string }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // Auth: verify user session via Supabase cookies
  const supabaseAuth = await createClient()
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { postId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.postId) {
    return NextResponse.json({ error: 'Missing postId' }, { status: 400 })
  }

  let supabase: ReturnType<typeof createAdminClient>
  try {
    supabase = createAdminClient()
  } catch (err) {
    console.error('[publish] Admin client init failed:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }

  // Verify post exists and is scheduled
  const { data: post, error: fetchError } = await supabase
    .from('posts')
    .select('id, title, excerpt, status, published_at')
    .eq('id', body.postId)
    .single()

  if (fetchError || !post) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  if (post.status !== 'scheduled') {
    return NextResponse.json({ error: 'Post is not scheduled' }, { status: 409 })
  }

  if (post.published_at) {
    return NextResponse.json({ error: 'Post already published' }, { status: 409 })
  }

  // Publish the post
  const now = new Date().toISOString()
  const { error: updateError } = await supabase
    .from('posts')
    .update({
      status: 'published',
      is_published: true,
      published_at: now,
      scheduled_at: null,
    })
    .eq('id', body.postId)

  if (updateError) {
    console.error('[publish] Failed to publish post:', updateError.message)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  // Send email notification — прямой вызов функции (без HTTP self-fetch).
  // Провал рассылки изолируется и НЕ откатывает публикацию поста.
  let emailError: string | null = null

  try {
    await sendNewPostNotification({ id: post.id, title: post.title, excerpt: post.excerpt })
  } catch (err) {
    console.error(`[publish] Email failed for post ${post.id}:`, err)
    emailError = err instanceof Error ? err.message : String(err)
  }

  return NextResponse.json({ published: true, emailError })
}
