'use client'

import type { OptimisticComment, CommentWithStatus } from '../types'
import { DiscussionNode } from './DiscussionNode'

interface CommentsListProps {
  comments: OptimisticComment[]
  /** user_id автора поста — для бейджа "Avtor" */
  postAuthorId?: string | null
  /** ID текущего авторизованного пользователя */
  currentUserId?: string | null
  /** true если текущий пользователь является администратором */
  currentUserIsAdmin?: boolean
  onRetry?: (comment: CommentWithStatus) => void
  onReply?: (content: string, parentId: string) => void
  /** Callback удаления (передаётся только при наличии прав модерации) */
  onDelete?: (commentId: string) => void
}

export function CommentsList({
  comments,
  postAuthorId,
  currentUserId,
  currentUserIsAdmin,
  onRetry,
  onReply,
  onDelete,
}: CommentsListProps) {
  if (comments.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Še ni komentarjev. Bodite prvi!
      </p>
    )
  }

  return (
    <div className="divide-y divide-border">
      {comments.map((comment) => (
        <div key={comment.id}>
          <DiscussionNode
            comment={comment}
            postAuthorId={postAuthorId}
            currentUserId={currentUserId}
            currentUserIsAdmin={currentUserIsAdmin}
            onRetry={onRetry}
            onReply={onReply}
            onDelete={onDelete}
          />
          {comment.replies.map((reply) => (
            <DiscussionNode
              key={reply.id}
              comment={reply}
              isReply
              postAuthorId={postAuthorId}
              currentUserId={currentUserId}
              currentUserIsAdmin={currentUserIsAdmin}
              onRetry={onRetry}
              onReply={onReply}
              onDelete={onDelete}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
