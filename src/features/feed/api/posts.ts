import { createClient } from '@/lib/supabase/client'
import type { FeedPage, Post } from '../types'

const PAGE_SIZE = 10

const ISO_TIMESTAMP_REGEX =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isValidIsoTimestamp(value: string) {
  return ISO_TIMESTAMP_REGEX.test(value)
}

function isValidUuid(value: string) {
  return UUID_REGEX.test(value)
}

export async function fetchPosts(
  cursor?: string,
  options?: { signal?: AbortSignal; category?: string }
): Promise<FeedPage> {
  const supabase = createClient()

  let query = supabase
    .from('posts')
    .select('*, profiles!author_id(display_name, avatar_url), post_media(id, media_type, url, thumbnail_url, order_index, is_cover), is_liked:posts_is_liked')
    .eq('is_published', true)

  // Фильтр по категории на сервере (если не "all")
  if (options?.category && options.category !== 'all') {
    query = query.eq('category', options.category)
  }

  query = query
    .order('created_at', { ascending: false })
    .order('id', { ascending: false }) // Tiebreaker: стабильный порядок при одинаковых created_at

  if (options?.signal) {
    query = query.abortSignal(options.signal)
  }

  if (cursor) {
    const [cursorAt, cursorId] = cursor.split('|')
    if (cursorAt && cursorId) {
      if (!isValidIsoTimestamp(cursorAt) || !isValidUuid(cursorId)) {
        throw new Error('Invalid cursor format')
      }

      query = query.or(
        `created_at.lt.${cursorAt},and(created_at.eq.${cursorAt},id.lt.${cursorId})`
      )
    } else {
      if (!isValidIsoTimestamp(cursor)) {
        throw new Error('Invalid cursor format')
      }

      query = query.lt('created_at', cursor)
    }
  }

  query = query.limit(PAGE_SIZE + 1) // +1 для определения hasMore

  const { data, error } = await query

  if (error) throw error
  if (!data) return { posts: [], nextCursor: null, hasMore: false }

  const hasMore = data.length > PAGE_SIZE
  const posts = (hasMore ? data.slice(0, PAGE_SIZE) : data) as unknown as Post[]
  const lastPost = posts[posts.length - 1]
  const nextCursor = lastPost ? `${lastPost.created_at}|${lastPost.id}` : null

  return { posts, nextCursor, hasMore }
}
