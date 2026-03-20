import { createClient } from '@/lib/supabase/server'
import type { FeedPage, Post } from '../types'

const PAGE_SIZE = 10

export async function fetchInitialPostsServer(): Promise<{
  feedPage: FeedPage
  currentUserId: string | null
}> {
  try {
    const supabase = await createClient()

    // Параллельная загрузка постов и текущего пользователя —
    // currentUserId передаётся в FeedContainer для устранения badge pop-in при гидрации.
    const [postsResult, userResult] = await Promise.all([
      supabase
        .from('posts')
        .select('*, profiles!author_id(display_name, avatar_url)')
        .eq('is_published', true)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(PAGE_SIZE + 1),
      supabase.auth.getUser(),
    ])

    if (postsResult.error) throw postsResult.error

    const hasMore = postsResult.data.length > PAGE_SIZE
    const posts = (hasMore ? postsResult.data.slice(0, PAGE_SIZE) : postsResult.data) as Post[]
    const lastPost = posts[posts.length - 1]
    const nextCursor = lastPost ? `${lastPost.created_at}|${lastPost.id}` : null
    const currentUserId = userResult.data?.user?.id ?? null

    return { feedPage: { posts, nextCursor, hasMore }, currentUserId }
  } catch {
    // Fallback: клиентская загрузка обработает ситуацию
    return { feedPage: { posts: [], nextCursor: null, hasMore: true }, currentUserId: null }
  }
}
