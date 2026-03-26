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

  // Группируем в дерево (1 уровень): корневые + их ответы.
  // Вложенные ответы (reply to reply) флаттенятся к корневому предку.
  const roots: Comment[] = []
  const rootIdSet = new Set<string>()
  const parentOf = new Map<string, string>()
  const replyMap = new Map<string, CommentWithProfile[]>()

  for (const row of rows) {
    if (row.parent_id) {
      parentOf.set(row.id, row.parent_id)
    } else {
      roots.push({ ...row, replies: [] })
      rootIdSet.add(row.id)
    }
  }

  // Находим корневого предка для любого комментария
  function getRootId(id: string): string {
    let current = id
    while (!rootIdSet.has(current)) {
      const parent = parentOf.get(current)
      if (!parent) return current
      current = parent
    }
    return current
  }

  for (const row of rows) {
    if (row.parent_id) {
      const rootId = getRootId(row.id)
      if (rootIdSet.has(rootId)) {
        const list = replyMap.get(rootId) ?? []
        list.push(row)
        replyMap.set(rootId, list)
      }
    }
  }

  for (const root of roots) {
    root.replies = replyMap.get(root.id) ?? []
  }

  return roots
}
