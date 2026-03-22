import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { FeedPage, Post, PostDetail } from '../types'

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
        .select('*, profiles!author_id(display_name, avatar_url), is_liked:posts_is_liked')
        .eq('is_published', true)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(PAGE_SIZE + 1),
      supabase.auth.getUser(),
    ])

    if (postsResult.error) throw postsResult.error

    const hasMore = postsResult.data.length > PAGE_SIZE
    const posts = (hasMore ? postsResult.data.slice(0, PAGE_SIZE) : postsResult.data) as unknown as Post[]
    const lastPost = posts[posts.length - 1]
    const nextCursor = lastPost ? `${lastPost.created_at}|${lastPost.id}` : null
    const currentUserId = userResult.data?.user?.id ?? null

    return { feedPage: { posts, nextCursor, hasMore }, currentUserId }
  } catch {
    // Fallback: клиентская загрузка обработает ситуацию
    return { feedPage: { posts: [], nextCursor: null, hasMore: true }, currentUserId: null }
  }
}

export const fetchPostById = cache(async (id: string): Promise<PostDetail | null> => {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('posts')
      .select('*, profiles!author_id(display_name, avatar_url), is_liked:posts_is_liked')
      .eq('id', id)
      .eq('is_published', true)
      .single()

    if (error || !data) return null

    const post = data as unknown as Post

    const authorName = post.profiles?.display_name || 'Avtor'
    const initials = authorName
      .split(' ')
      .map((w: string) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase()

    const date = new Date(post.created_at).toLocaleDateString('sl-SI', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })

    return {
      id: post.id,
      title: post.title,
      content: post.content ?? null,
      excerpt: post.excerpt ?? '',
      category: post.category,
      type: post.type,
      imageUrl: post.image_url ?? null,
      likes: post.likes_count,
      comments: post.comments_count,
      isLiked: post.is_liked ?? false,
      date,
      author: {
        name: authorName,
        initials,
      },
    }
  } catch {
    return null
  }
})
