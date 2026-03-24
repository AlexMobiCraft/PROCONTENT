import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { FeedPage, Post, PostDetail } from '../types'
import { derivePostType, sortByOrderIndex } from '../types'

const PAGE_SIZE = 10

export async function fetchInitialPostsServer(): Promise<{
  feedPage: FeedPage
  currentUserId: string | null
}> {
  try {
    const supabase = await createClient()

    // Параллельная загрузка постов и текущего пользователя —
    // currentUserId передаётся в FeedContainer для предотвращения badge pop-in при гидрации.
    const [postsResult, userResult] = await Promise.all([
      supabase
        .from('posts')
        .select('*, profiles!author_id(display_name, avatar_url), post_media(id, media_type, url, thumbnail_url, order_index, is_cover), is_liked:posts_is_liked')
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
  } catch (err) {
    console.error('[fetchInitialPostsServer] Supabase query failed:', err)
    // Fallback: клиентская загрузка обработает ситуацию
    return { feedPage: { posts: [], nextCursor: null, hasMore: true }, currentUserId: null }
  }
}

export const fetchPostById = cache(async (id: string): Promise<PostDetail | null> => {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('posts')
      .select('*, profiles!author_id(display_name, avatar_url), post_media(id, media_type, url, thumbnail_url, order_index, is_cover), is_liked:posts_is_liked')
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

    // Вычисляем coverItem как в dbPostToCardData (AC 6)
    const sortedMedia = post.post_media ? sortByOrderIndex(post.post_media) : undefined
    const coverItem = sortedMedia?.find((m) => m.is_cover) ?? sortedMedia?.[0] ?? null

    return {
      id: post.id,
      title: post.title,
      content: post.content ?? null,
      excerpt: post.excerpt ?? '',
      category: post.category,
      type: derivePostType(sortedMedia),
      imageUrl: coverItem?.url ?? null,
      mediaItem: coverItem,
      // Story 2.4: передаём все медиафайлы для GalleryGrid
      media: sortedMedia ?? [],
      likes: post.likes_count,
      comments: post.comments_count,
      isLiked: post.is_liked ?? false,
      created_at: post.created_at,
      author: {
        name: authorName,
        initials,
      },
    }
  } catch (err) {
    console.error('[fetchPostById] Failed to fetch post:', id, err)
    return null
  }
})
