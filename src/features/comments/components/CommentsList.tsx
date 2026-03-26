'use client'

import type { OptimisticComment, CommentWithStatus } from '../types'
import { DiscussionNode } from './DiscussionNode'

interface CommentsListProps {
  comments: OptimisticComment[]
  /** user_id автора поста — для бейджа "Avtor" */
  postAuthorId?: string | null
  onRetry?: (comment: CommentWithStatus) => void
  onReply?: (content: string, parentId: string) => void
}

export function CommentsList({
  comments,
  postAuthorId,
  onRetry,
  onReply,
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
            onRetry={onRetry}
            onReply={onReply}
          />
          {comment.replies.map((reply) => (
            <DiscussionNode
              key={reply.id}
              comment={reply}
              isReply
              postAuthorId={postAuthorId}
              onRetry={onRetry}
              onReply={onReply}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
