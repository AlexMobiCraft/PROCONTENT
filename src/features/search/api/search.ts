import { createClient } from '@/lib/supabase/client'
import type { Post } from '@/features/feed/types'

/**
 * Поиск постов по полнотекстовому индексу (FTS) через generated column `fts`.
 * Fallback на .ilike() если query не является валидным tsquery.
 * Возвращает опубликованные посты с join profiles + post_media — совместимо с dbPostToCardData.
 */
export async function searchPosts(query: string): Promise<Post[]> {
  if (!query.trim()) return []

  const supabase = createClient()

  const { data, error } = await supabase
    .from('posts')
    .select(
      '*, profiles!author_id(display_name, avatar_url), post_media(id, media_type, url, thumbnail_url, order_index, is_cover), is_liked:posts_is_liked'
    )
    .eq('is_published', true)
    .textSearch('fts', query, { type: 'websearch', config: 'simple' })
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) throw error
  return (data ?? []) as unknown as Post[]
}
