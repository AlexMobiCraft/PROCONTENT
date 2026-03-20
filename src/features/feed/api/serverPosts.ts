import { createClient } from '@/lib/supabase/server'
import type { FeedPage, Post } from '../types'

const PAGE_SIZE = 10

export async function fetchInitialPostsServer(): Promise<FeedPage> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('posts')
      .select('*, profiles!author_id(display_name, avatar_url)')
      .eq('is_published', true)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(PAGE_SIZE + 1)

    if (error) throw error

    const hasMore = data.length > PAGE_SIZE
    const posts = (hasMore ? data.slice(0, PAGE_SIZE) : data) as Post[]
    const lastPost = posts[posts.length - 1]
    const nextCursor = lastPost ? `${lastPost.created_at}|${lastPost.id}` : null

    return { posts, nextCursor, hasMore }
  } catch {
    // Fallback: клиентская загрузка обработает ситуацию
    return { posts: [], nextCursor: null, hasMore: true }
  }
}
