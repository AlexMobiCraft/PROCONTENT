import { createClient } from '@/lib/supabase/client'
import type { FeedPage, Post } from '../types'

const PAGE_SIZE = 10

export async function fetchPosts(cursor?: string): Promise<FeedPage> {
  const supabase = createClient()

  let query = supabase
    .from('posts')
    .select('*, profiles!author_id(display_name, avatar_url)')
    .eq('is_published', true)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false }) // Tiebreaker: стабильный порядок при одинаковых created_at
    .limit(PAGE_SIZE + 1) // +1 для определения hasMore

  if (cursor) {
    // Составной курсор "timestamp|uuid" устраняет пропуск постов с одинаковым created_at
    const [cursorAt, cursorId] = cursor.split('|')
    if (cursorAt && cursorId) {
      query = query.or(
        `created_at.lt.${cursorAt},and(created_at.eq.${cursorAt},id.lt.${cursorId})`
      )
    } else {
      // Fallback для курсора старого формата (только timestamp)
      query = query.lt('created_at', cursor)
    }
  }

  const { data, error } = await query

  if (error) throw error

  const hasMore = data.length > PAGE_SIZE
  const posts = (hasMore ? data.slice(0, PAGE_SIZE) : data) as Post[]
  const lastPost = posts[posts.length - 1]
  const nextCursor = lastPost ? `${lastPost.created_at}|${lastPost.id}` : null

  return { posts, nextCursor, hasMore }
}
