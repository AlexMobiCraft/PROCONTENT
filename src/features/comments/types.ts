import type { Tables } from '@/types/supabase'

// Тип строки из БД без join-профиля
export type CommentRow = Tables<'post_comments'>

// Тип комментария с join профиля автора
export type CommentWithProfile = CommentRow & {
  profiles: {
    id: string
    display_name: string | null
    avatar_url: string | null
    role: string | null
  } | null
}

// Клиентский тип комментария — дерево (1 уровень вложенности)
export interface Comment extends CommentWithProfile {
  replies: CommentWithProfile[]
}

// UI-only статус для оптимистичных комментариев (не хранится в БД)
export type CommentStatus = 'pending' | 'error'

// CommentWithProfile + опциональный UI-статус (используется в DiscussionNode)
export type CommentWithStatus = CommentWithProfile & { _status?: CommentStatus }

// Оптимистичный комментарий: корневой с replies, поддерживающими статус
export interface OptimisticComment extends CommentWithProfile {
  replies: CommentWithStatus[]
  _status?: CommentStatus
}
