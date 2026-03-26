'use client'

import Image from 'next/image'
import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import type { CommentWithStatus } from '../types'
import { CommentForm } from './CommentForm'
import { cn } from '@/lib/utils'

interface DiscussionNodeProps {
  comment: CommentWithStatus
  /** Отступ для ответов (1 уровень вложенности) */
  isReply?: boolean
  /** user_id автора поста — для бейджа "Avtor" */
  postAuthorId?: string | null
  /** ID текущего авторизованного пользователя — для проверки прав на удаление */
  currentUserId?: string | null
  /** true если текущий пользователь является администратором */
  currentUserIsAdmin?: boolean
  /** Callback повтора отправки провального комментария */
  onRetry?: (comment: CommentWithStatus) => void
  /** Callback добавления ответа: (content, parentId) */
  onReply?: (content: string, parentId: string) => void
  /** Callback удаления комментария (передаётся только при наличии прав модерации) */
  onDelete?: (commentId: string) => void
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

export function DiscussionNode({
  comment,
  isReply = false,
  postAuthorId,
  currentUserId,
  currentUserIsAdmin,
  onRetry,
  onReply,
  onDelete,
}: DiscussionNodeProps) {
  const [showReplyForm, setShowReplyForm] = useState(false)

  const profile = comment.profiles
  const name = profile?.display_name ?? 'Uporabnik'
  const initials = getInitials(profile?.display_name ?? null)
  const isAuthor = comment.user_id === postAuthorId
  const isAdmin = profile?.role === 'admin'
  const showBadge = isAuthor || isAdmin

  const isPending = comment._status === 'pending'
  const isError = comment._status === 'error'

  // Trash показывается если: есть onDelete, комментарий не свой и не в pending-состоянии
  const canDelete = Boolean(onDelete) && comment.user_id !== currentUserId && !isPending

  function handleReplySubmit(content: string) {
    onReply?.(content, comment.id)
    setShowReplyForm(false)
  }

  function handleDeleteClick() {
    if (!window.confirm('Ali ste prepričani, da želite izbrisati ta komentar?')) return
    onDelete?.(comment.id)
  }

  return (
    <article
      className={cn(
        isReply && 'pl-10',
        showBadge && 'rounded-lg border border-primary/20 bg-primary/5 p-2'
      )}
    >
      <div
        className={cn(
          'flex gap-3 py-4',
          isPending && 'opacity-60',
          isError && 'border-l-2 border-destructive/60 pl-3'
        )}
      >
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
        <div className="flex flex-col gap-1 min-w-0 w-full">
          {/* Author row */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-medium text-foreground">{name}</span>
            {showBadge && (
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
                {isAuthor ? 'Avtor' : 'Admin'}
              </span>
            )}
            {!isPending && !isError && (
              <time
                dateTime={comment.created_at}
                className="text-xs text-muted-foreground"
                suppressHydrationWarning
              >
                {formatDate(comment.created_at)}
              </time>
            )}
            {isPending && (
              <span className="text-xs text-muted-foreground">Pošiljanje...</span>
            )}
            {isError && (
              <span className="text-xs text-destructive">Napaka pri pošiljanju</span>
            )}
          </div>

          {/* Content */}
          <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap break-words">
            {comment.content}
          </p>

          {/* Action row: retry, reply, delete */}
          <div className="flex items-center gap-2 mt-0.5">
            {isError && onRetry && (
              <button
                type="button"
                onClick={() => onRetry(comment)}
                className="text-xs text-destructive hover:text-destructive/80 transition-colors min-h-[32px]"
              >
                Poskusi znova
              </button>
            )}
            {!isPending && !isError && onReply && (
              <button
                type="button"
                onClick={() => setShowReplyForm((v) => !v)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors min-h-[32px]"
              >
                {showReplyForm ? 'Prekliči' : 'Odgovori'}
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={handleDeleteClick}
                aria-label="Izbriši komentar"
                className="ml-auto flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors min-h-[32px] min-w-[32px]"
              >
                <Trash2 className="size-3.5" />
              </button>
            )}
          </div>

          {/* Inline reply form */}
          {showReplyForm && (
            <div className="mt-2">
              <CommentForm
                onSubmit={handleReplySubmit}
                parentId={comment.id}
                placeholder="Napišite odgovor..."
                autoFocus
              />
            </div>
          )}
        </div>
      </div>
    </article>
  )
}
