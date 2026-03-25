import { createClient } from '@/lib/supabase/server'
import type { Comment, CommentWithProfile } from '../types'

/**
 * Загружает все комментарии поста с профилями авторов.
 * Возвращает дерево 1 уровня: корневые комментарии + их прямые ответы.
 */
export async function fetchPostComments(postId: string): Promise<Comment[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('post_comments')
    .select('*, profiles(id, display_name, avatar_url, role)')
    .eq('post_id', postId)
    .order('created_at', { ascending: true })

  if (error) throw error

  const rows = (data ?? []) as CommentWithProfile[]

  // Группируем в дерево (1 уровень): корневые + их ответы
  const roots: Comment[] = []
  const replyMap = new Map<string, CommentWithProfile[]>()

  for (const row of rows) {
    if (row.parent_id) {
      const list = replyMap.get(row.parent_id) ?? []
      list.push(row)
      replyMap.set(row.parent_id, list)
    } else {
      roots.push({ ...row, replies: [] })
    }
  }

  for (const root of roots) {
    root.replies = replyMap.get(root.id) ?? []
  }

  return roots
}
