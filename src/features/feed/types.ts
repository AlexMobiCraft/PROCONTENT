import type { Tables } from '@/types/supabase'
import type { PostCardData } from '@/components/feed/PostCard'

// Тип медиафайла поста (соответствует таблице post_media в БД)
// snake_case — прямые поля из Supabase, без маппинга в camelCase
// media_type переопределён как union: Supabase gen types возвращает string для CHECK-колонок
export type PostMedia = Omit<Tables<'post_media'>, 'media_type'> & {
  media_type: 'image' | 'video'
}

// Тип строки из БД с join профиля автора + join post_media + computed column is_liked
// fts переопределён как optional — тестовые моки не включают tsvector-колонку
export type PostRow = Omit<Tables<'posts'>, 'fts'> & {
  fts?: unknown
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
  author_id: string
  title: string
  content: string | null
  excerpt: string
  category: string
  type: 'text' | 'photo' | 'video' | 'gallery' | 'multi-video'
  imageUrl: string | null
  /** Нормализованный медиафайл обложки из post_media (AC 6) */
  mediaItem?: PostMedia | null
  /** Все медиафайлы поста — для GalleryGrid (Story 2.4) */
  media?: PostMedia[]
  likes: number
  comments: number
  is_liked: boolean
  created_at: string
  author: {
    name: string
    initials: string
    avatar_url?: string | null
  }
}

/** Сортирует массив медиа по order_index. Единая утилита для mapper, serverPosts и GalleryGrid. */
export function sortByOrderIndex(media: PostMedia[]): PostMedia[] {
  return [...media].sort((a, b) => a.order_index - b.order_index)
}

// Определяет тип поста на основе нормализованных данных post_media
export function derivePostType(
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
    .split(/\s+/)
    .filter(Boolean)
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

  const sortedMedia = post.post_media ? sortByOrderIndex(post.post_media) : undefined

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
      avatar_url: post.profiles?.avatar_url ?? null,
    },
    created_at: post.created_at,
    imageUrl,
    // AC 6: передаём полный объект post_media для LazyMediaWrapper
    mediaItem: coverItem,
    // Story 2.4: передаём все медиафайлы для GalleryGrid
    media: sortedMedia,
    type: derivePostType(sortedMedia),
    isLiked: post.is_liked ?? false,
  }
}
