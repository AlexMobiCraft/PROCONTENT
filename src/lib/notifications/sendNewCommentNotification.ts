import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'
import { sendEmailBatch } from '@/lib/email'
import {
  generateNewCommentEmailHtml,
  generateNewCommentEmailText,
} from '@/lib/email/templates/new-comment'
import type { Database } from '@/types/supabase'

export interface NewCommentInput {
  post_id: string
  commenter_id: string
  commenter_name: string
}

export type NewCommentResult =
  | { sent: number; failed: number }
  | { skipped: 'self' | 'no_email' }

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('[notifications] Missing Supabase env vars (URL / SERVICE_ROLE_KEY)')
  }

  return createSupabaseAdminClient<Database>(url, key)
}

function resolveDisplayName(profile: {
  display_name: string | null
  first_name: string
  last_name: string | null
}): string {
  if (profile.display_name && profile.display_name.trim()) {
    return profile.display_name.trim()
  }
  const full = [profile.first_name, profile.last_name].filter(Boolean).join(' ')
  return full || profile.first_name
}

/**
 * Отправляет email-уведомление автору поста о новом комментарии.
 *
 * Контракт:
 *   - self-comment (commenter_id === author_id) → { skipped: 'self' }
 *   - нет email у автора → { skipped: 'no_email' }
 *   - успешная отправка → { sent, failed }
 *   - hard-ошибки (нет env, ошибка БД) → бросает исключение
 */
export async function sendNewCommentNotification(
  input: NewCommentInput
): Promise<NewCommentResult> {
  // --- env-guard (вне try/catch) ---
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  if (!siteUrl) {
    throw new Error('[notifications] NEXT_PUBLIC_SITE_URL is not configured')
  }

  const supabase = createAdminClient()

  // --- Загрузка поста ---
  const { data: post, error: postError } = await supabase
    .from('posts')
    .select('title, author_id')
    .eq('id', input.post_id)
    .single()

  if (postError || !post) {
    throw new Error(
      `[notifications] Post not found: ${input.post_id} — ${postError?.message ?? 'no data'}`
    )
  }

  // --- Пропустить, если автор комментирует свой пост ---
  if (post.author_id === input.commenter_id) {
    return { skipped: 'self' }
  }

  // --- Загрузка профиля автора ---
  const { data: authorProfile, error: profileError } = await supabase
    .from('profiles')
    .select('email, display_name, first_name, last_name')
    .eq('id', post.author_id)
    .single()

  if (profileError || !authorProfile) {
    throw new Error(
      `[notifications] Author profile not found: ${post.author_id} — ${profileError?.message ?? 'no data'}`
    )
  }

  const authorEmail = authorProfile.email
  if (!authorEmail || !authorEmail.trim() || !authorEmail.includes('@')) {
    return { skipped: 'no_email' }
  }

  // --- Формирование письма ---
  const normalizedSiteUrl = siteUrl.replace(/\/+$/, '')
  const postUrl = `${normalizedSiteUrl}/feed/${input.post_id}`
  const safeTitle = post.title.replace(/[\r\n]/g, '')
  const safeCommenterName = input.commenter_name.replace(/[\r\n]/g, '')
  const recipientName = resolveDisplayName({
    display_name: authorProfile.display_name,
    first_name: authorProfile.first_name,
    last_name: authorProfile.last_name,
  })

  const message = {
    to: authorEmail,
    subject: `Nov komentar k vaši objavi: ${safeTitle}`,
    html: generateNewCommentEmailHtml({
      postTitle: safeTitle,
      postUrl,
      commenterName: safeCommenterName,
      recipientName,
    }),
    text: generateNewCommentEmailText({
      postTitle: safeTitle,
      postUrl,
      commenterName: safeCommenterName,
      recipientName,
    }),
  }

  return sendEmailBatch([message])
}
