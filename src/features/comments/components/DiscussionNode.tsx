'use client'

import Image from 'next/image'
import type { CommentWithProfile } from '../types'

interface DiscussionNodeProps {
  comment: CommentWithProfile
  /** Отступ для ответов (1 уровень вложенности) */
  isReply?: boolean
  /** user_id автора поста — для бейджа "Avtor" */
  postAuthorId?: string | null
}

function getInitials(name: string | null): string {
  if (!name) return '?'
  const parts = name.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return parts
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('sl-SI', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function DiscussionNode({ comment, isReply = false, postAuthorId }: DiscussionNodeProps) {
  const profile = comment.profiles
  const name = profile?.display_name ?? 'Uporabnik'
  const initials = getInitials(profile?.display_name ?? null)
  const isAuthor = comment.user_id === postAuthorId
  const isAdmin = profile?.role === 'admin'
  const showBadge = isAuthor || isAdmin

  return (
    <article className={isReply ? 'pl-10' : undefined}>
      <div className="flex gap-3 py-4">
        {/* Avatar */}
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-primary overflow-hidden">
          {profile?.avatar_url ? (
            <Image
              src={profile.avatar_url}
              alt={name}
              width={32}
              height={32}
              className="size-full object-cover"
            />
          ) : (
            initials
          )}
        </div>

        {/* Body */}
        <div className="flex flex-col gap-1 min-w-0">
          {/* Author row */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-medium text-foreground">{name}</span>
            {showBadge && (
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
                {isAuthor ? 'Avtor' : 'Admin'}
              </span>
            )}
            <time
              dateTime={comment.created_at}
              className="text-xs text-muted-foreground"
            >
              {formatDate(comment.created_at)}
            </time>
          </div>

          {/* Content */}
          <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
            {comment.content}
          </p>
        </div>
      </div>
    </article>
  )
}
