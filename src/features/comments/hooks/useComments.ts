'use client'

import { useState, useCallback } from 'react'
import { insertPostComment, deletePostComment } from '../api/clientComments'
import { useFeedStore } from '@/features/feed/store'
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

/** Удаляет комментарий из дерева по ID (корневой или ответ). */
function removeFromTree(
  comments: OptimisticComment[],
  commentId: string
): OptimisticComment[] {
  const filtered = comments.filter((c) => c.id !== commentId)
  if (filtered.length < comments.length) return filtered
  return comments.map((root) => ({
    ...root,
    replies: root.replies.filter((r) => r.id !== commentId),
  }))
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

  // Считаем все корневые + ответы (оптимистичный счётчик)
  const commentCount = comments.reduce(
    (acc, root) => acc + 1 + (root.replies?.length ?? 0),
    0
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

      // Оптимистично обновляем счётчик в store ленты
      useFeedStore.getState().updatePost(postId, { comments_count: commentCount + 1 })

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
        // Откат счётчика
        useFeedStore.getState().updatePost(postId, { comments_count: commentCount })
      }
    },
    [postId, currentUserProfile, commentCount]
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
        useFeedStore.getState().updatePost(postId, { comments_count: commentCount + 1 })
        setComments((prev) => replaceInTree(prev, tempId, { ...saved, _status: undefined }))
      } catch {
        setComments((prev) => updateStatusInTree(prev, tempId, 'error'))
      }
    },
    [postId, commentCount]
  )

  /** Оптимистично удаляет комментарий, затем подтверждает в Supabase. При ошибке откатывает. */
  const deleteComment = useCallback(async (commentId: string) => {
    let prevComments: OptimisticComment[] | null = null
    const prevCount = commentCount
    // Оптимистично уменьшаем счётчик в store ленты
    useFeedStore.getState().updatePost(postId, { comments_count: Math.max(commentCount - 1, 0) })
    setComments((prev) => {
      prevComments = prev
      return removeFromTree(prev, commentId)
    })
    try {
      await deletePostComment(commentId)
    } catch (err) {
      if (prevComments !== null) {
        setComments(prevComments)
        // Откат счётчика
        useFeedStore.getState().updatePost(postId, { comments_count: prevCount })
      }
      throw err
    }
  }, [postId, commentCount])

  return { comments, commentCount, addComment, retryComment, deleteComment }
}
