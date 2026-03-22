import type { Tables } from '@/types/supabase'
import type { PostCardData } from '@/components/feed/PostCard'

// Тип медиафайла поста (соответствует таблице post_media в БД)
// snake_case — прямые поля из Supabase, без маппинга в camelCase
export type PostMedia = Tables<'post_media'>

// Тип строки из БД с join профиля автора + join post_media + computed column is_liked
export type PostRow = Tables<'posts'> & {
  profiles: {
    display_name: string | null
    avatar_url: string | null
  } | null
  /** Computed column posts_is_liked — null для анонимных пользователей */
  is_liked?: boolean | null
  /** Join с post_media — массив медиафайлов поста, отсортированных по order_index */
  post_media?: PostMedia[]
}

// Клиентский тип поста (алиас для использования в store и компонентах)
export type Post = PostRow

// Результат запроса пагинации
export interface FeedPage {
  posts: Post[]
  nextCursor: string | null
  hasMore: boolean
}

// Ответ RPC toggle_like
export interface ToggleLikeResponse {
  is_liked: boolean
  likes_count: number
}

// Тип для детальной страницы поста
export interface PostDetail {
  id: string
  title: string
  content: string | null
  excerpt: string
  category: string
  type: 'text' | 'photo' | 'video' | 'gallery' | 'multi-video'
  imageUrl: string | null
  likes: number
  comments: number
  isLiked: boolean
  created_at: string
  author: {
    name: string
    initials: string
  }
}

// Определяет тип поста на основе нормализованных данных post_media
function derivePostType(
  media: PostMedia[] | undefined | null
): PostCardData['type'] {
  if (!media || media.length === 0) return 'text'
  if (media.length === 1) {
    return media[0].media_type === 'video' ? 'video' : 'photo'
  }
  return media.every((m) => m.media_type === 'video') ? 'multi-video' : 'gallery'
}

// Mapper: строка БД → данные для PostCard
export function dbPostToCardData(
  post: Post,
  currentUserId?: string | null
): PostCardData {
  const authorName = post.profiles?.display_name || 'Avtor'
  const initials = authorName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  // Используем браузерный часовой пояс — дата отображается в локальном времени пользователя.
  // FeedContainer — 'use client', рендер только на клиенте, гидратация не затронута.
  const date = new Date(post.created_at).toLocaleDateString('sl-SI', {
    day: 'numeric',
    month: 'long',
  })

  // Сортируем post_media по order_index для стабильного порядка
  const sortedMedia = post.post_media
    ? [...post.post_media].sort((a, b) => a.order_index - b.order_index)
    : undefined

  // imageUrl: предпочитаем cover-медиа из post_media, затем первый элемент по order_index
  const coverItem = sortedMedia?.find((m) => m.is_cover) ?? sortedMedia?.[0]
  const imageUrl = coverItem?.url ?? undefined

  return {
    id: post.id,
    category: post.category,
    title: post.title,
    excerpt: post.excerpt ?? '',
    date,
    likes: post.likes_count,
    comments: post.comments_count,
    author: {
      name: authorName,
      initials,
      isAuthor: currentUserId === post.author_id,
    },
    imageUrl,
    // AC 6: передаём полный объект post_media для LazyMediaWrapper
    mediaItem: coverItem,
    type: derivePostType(sortedMedia),
    isLiked: post.is_liked ?? false,
  }
}
