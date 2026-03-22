import type { Tables } from '@/types/supabase'
import type { PostCardData } from '@/components/feed/PostCard'

// Тип строки из БД с join профиля автора + computed column is_liked
export type PostRow = Tables<'posts'> & {
  profiles: {
    display_name: string | null
    avatar_url: string | null
  } | null
  /** Computed column posts_is_liked — null для анонимных пользователей */
  is_liked?: boolean | null
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
  type: 'text' | 'photo' | 'video'
  imageUrl: string | null
  likes: number
  comments: number
  isLiked: boolean
  date: string
  author: {
    name: string
    initials: string
  }
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
    imageUrl: post.image_url ?? undefined,
    type: post.type,
    isLiked: post.is_liked ?? false,
  }
}
