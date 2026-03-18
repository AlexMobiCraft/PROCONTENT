import type { Tables } from '@/types/supabase'
import type { PostCardData } from '@/components/feed/PostCard'

// Тип строки из БД с join профиля автора
export type PostRow = Tables<'posts'> & {
  profiles: {
    display_name: string | null
    avatar_url: string | null
  } | null
}

// Клиентский тип поста (алиас для использования в store и компонентах)
export type Post = PostRow

// Результат запроса пагинации
export interface FeedPage {
  posts: Post[]
  nextCursor: string | null
  hasMore: boolean
}

// Mapper: строка БД → данные для PostCard
export function dbPostToCardData(
  post: Post,
  currentUserId?: string | null
): PostCardData {
  const authorName = post.profiles?.display_name || 'Автор'
  const initials = authorName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const date = new Date(post.created_at).toLocaleDateString('ru-RU', {
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
  }
}
