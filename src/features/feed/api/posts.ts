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
    .limit(PAGE_SIZE + 1) // +1 для определения hasMore

  if (cursor) {
    query = query.lt('created_at', cursor)
  }

  const { data, error } = await query

  if (error) throw error

  const hasMore = data.length > PAGE_SIZE
  const posts = (hasMore ? data.slice(0, PAGE_SIZE) : data) as Post[]
  const nextCursor =
    posts.length > 0 ? posts[posts.length - 1].created_at : null

  return { posts, nextCursor, hasMore }
}
