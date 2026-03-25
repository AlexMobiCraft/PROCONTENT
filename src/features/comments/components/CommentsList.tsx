'use client'

import type { Comment } from '../types'
import { DiscussionNode } from './DiscussionNode'

interface CommentsListProps {
  comments: Comment[]
  /** user_id автора поста — для бейджа "Avtor" */
  postAuthorId?: string | null
}

export function CommentsList({ comments, postAuthorId }: CommentsListProps) {
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
          <DiscussionNode comment={comment} postAuthorId={postAuthorId} />
          {comment.replies.map((reply) => (
            <DiscussionNode key={reply.id} comment={reply} isReply postAuthorId={postAuthorId} />
          ))}
        </div>
      ))}
    </div>
  )
}
