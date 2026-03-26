import { createClient } from '@/lib/supabase/client'
import type { CommentWithProfile } from '../types'

interface InsertCommentParams {
  post_id: string
  content: string
  parent_id?: string | null
}

/**
 * Вставляет новый комментарий в post_comments от имени текущего пользователя.
 * Используется на клиенте для оптимистичного UI (Story 3.2).
 */
export async function insertPostComment(
  params: InsertCommentParams
): Promise<CommentWithProfile> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('post_comments')
    .insert({
      post_id: params.post_id,
      content: params.content,
      parent_id: params.parent_id ?? null,
      user_id: user.id,
    })
    .select('*, profiles(id, display_name, avatar_url, role)')
    .single()

  if (error) throw error
  return data as CommentWithProfile
}
