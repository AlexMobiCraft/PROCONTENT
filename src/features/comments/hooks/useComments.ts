'use client'

import { useState, useCallback } from 'react'
import { insertPostComment } from '../api/clientComments'
import type {
  Comment,
  CommentWithStatus,
  OptimisticComment,
  CommentStatus,
} from '../types'

type UserProfile = {
  id: string
  display_name: string | null
  avatar_url: string | null
  role: string | null
} | null

interface UseCommentsOptions {
  postId: string
  initialComments: Comment[]
  currentUserProfile?: UserProfile
}

/** Добавляет новый комментарий в дерево.
 *  Корневые — в конец списка; ответы — к replies родительского корня. */
function addToTree(
  comments: OptimisticComment[],
  newComment: CommentWithStatus,
  parentId: string | null
): OptimisticComment[] {
  if (!parentId) {
    return [...comments, { ...newComment, replies: [] }]
  }
  return comments.map((root) => {
    if (root.id === parentId || root.replies.some((r) => r.id === parentId)) {
      return { ...root, replies: [...root.replies, newComment] }
    }
    return root
  })
}

/** Заменяет временный комментарий (temp-*) сохранённым из БД. */
function replaceInTree(
  comments: OptimisticComment[],
  tempId: string,
  saved: CommentWithStatus
): OptimisticComment[] {
  const rootIdx = comments.findIndex((c) => c.id === tempId)
  if (rootIdx !== -1) {
    const next = [...comments]
    next[rootIdx] = { ...saved, replies: comments[rootIdx].replies }
    return next
  }
  return comments.map((root) => {
    const replyIdx = root.replies.findIndex((r) => r.id === tempId)
    if (replyIdx === -1) return root
    const newReplies = [...root.replies]
    newReplies[replyIdx] = saved
    return { ...root, replies: newReplies }
  })
}

/** Обновляет _status комментария в дереве. */
function updateStatusInTree(
  comments: OptimisticComment[],
  tempId: string,
  status: CommentStatus | undefined
): OptimisticComment[] {
  return comments.map((root) => {
    if (root.id === tempId) return { ...root, _status: status }
    return {
      ...root,
      replies: root.replies.map((r) =>
        r.id === tempId ? { ...r, _status: status } : r
      ),
    }
  })
}

/**
 * Управляет локальным состоянием комментариев с поддержкой оптимистичного UI.
 * Не используется в глобальном useFeedStore — состояние изолировано в посте.
 */
export function useComments({
  postId,
  initialComments,
  currentUserProfile,
}: UseCommentsOptions) {
  // Начальный Comment[] структурно совместим с OptimisticComment[]
  const [comments, setComments] = useState<OptimisticComment[]>(
    () => initialComments as OptimisticComment[]
  )

  /** Оптимистично добавляет комментарий, затем сохраняет в Supabase. */
  const addComment = useCallback(
    async (content: string, parentId?: string | null) => {
      const tempId = `temp-${crypto.randomUUID()}`
      const now = new Date().toISOString()

      const optimistic: CommentWithStatus = {
        id: tempId,
        post_id: postId,
        user_id: currentUserProfile?.id ?? '',
        parent_id: parentId ?? null,
        content,
        created_at: now,
        updated_at: now,
        profiles: currentUserProfile ?? null,
        _status: 'pending',
      }

      setComments((prev) => addToTree(prev, optimistic, parentId ?? null))

      try {
        const saved = await insertPostComment({
          post_id: postId,
          content,
          parent_id: parentId,
        })
        setComments((prev) => replaceInTree(prev, tempId, { ...saved, _status: undefined }))
      } catch {
        setComments((prev) => updateStatusInTree(prev, tempId, 'error'))
      }
    },
    [postId, currentUserProfile]
  )

  /** Повторяет отправку комментария с ошибкой. */
  const retryComment = useCallback(
    async (comment: CommentWithStatus) => {
      const tempId = comment.id
      setComments((prev) => updateStatusInTree(prev, tempId, 'pending'))

      try {
        const saved = await insertPostComment({
          post_id: postId,
          content: comment.content,
          parent_id: comment.parent_id,
        })
        setComments((prev) => replaceInTree(prev, tempId, { ...saved, _status: undefined }))
      } catch {
        setComments((prev) => updateStatusInTree(prev, tempId, 'error'))
      }
    },
    [postId]
  )

  return { comments, addComment, retryComment }
}
