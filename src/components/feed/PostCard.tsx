'use client'

import { cn } from '@/lib/utils'
import { LazyMediaWrapper } from '../media/LazyMediaWrapper'

export interface PostCardData {
  id: string
  category: string
  title: string
  excerpt: string
  date: string
  likes: number
  comments: number
  /** Начальное состояние лайка от сервера. undefined = не загружено (считается false). */
  isLiked?: boolean
  author: {
    name: string
    initials: string
    isAuthor?: boolean
  }
  imageUrl?: string
  type: 'text' | 'photo' | 'video'
}

interface PostCardProps {
  post: PostCardData
  priority?: boolean
  /** Кнопка лайка заблокирована — запрос toggle_like в процессе */
  isPending?: boolean
  onCommentClick?: (postId: string) => void
  /** Вызывается при нажатии кнопки лайка — вызывающий код определяет направление toggle. */
  onLikeToggle?: (postId: string) => void
  /** Вызывается при нажатии кнопки опций (троеточие). */
  onOptionsClick?: (postId: string) => void
}

export function PostCard({ post, priority = false, isPending = false, onCommentClick, onLikeToggle, onOptionsClick }: PostCardProps) {
  // Локальный state не нужен: FeedContainer управляет оптимистичным обновлением post.isLiked/post.likes
  const liked = post.isLiked ?? false
  const likeCount = post.likes

  function handleLike() {
    if (isPending) return
    onLikeToggle?.(post.id)
  }

  return (
    <article className="border-b border-border bg-background px-4 py-5">
      {/* Header */}
      <header className="mb-3 flex items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-primary">
          {post.author.initials}
        </div>
        <div className="flex flex-1 flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">
              {post.author.name}
            </span>
            {post.author.isAuthor && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                Avtorica
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {post.category}
            </span>
            <span className="text-xs text-muted-foreground">{post.date}</span>
          </div>
        </div>

        {/* Options button */}
        <button
          type="button"
          onClick={() => onOptionsClick?.(post.id)}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-muted-foreground hover:text-foreground"
          aria-label="Možnosti objave"
        >
          <svg className="size-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path d="M12 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm0 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm0 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />
          </svg>
        </button>
      </header>

      {/* Media Content */}
      {post.imageUrl && (
        <div className="mb-4">
          <LazyMediaWrapper
            src={post.imageUrl}
            alt={post.title}
            aspectRatio={post.type === 'video' ? '16/9' : '4/5'}
            type={post.type === 'video' ? 'video' : 'photo'}
            priority={priority}
          />
        </div>
      )}

      {/* Content */}
      <div className="flex flex-col gap-2">
        <h2 className="font-heading text-base font-semibold leading-snug text-foreground text-balance">
          {post.title}
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground line-clamp-3">
          {post.excerpt}
        </p>
      </div>

      {/* Type badge for video/photo */}
      {post.type !== 'text' && (
        <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          {post.type === 'video' ? (
            <>
              <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
              </svg>
              <span>Video</span>
            </>
          ) : (
            <>
              <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
              <span>Fotografija</span>
            </>
          )}
        </div>
      )}

      {/* Footer — social actions */}
      <footer className="mt-4 flex items-center gap-1">
        {/* Like button */}
        <button
          type="button"
          onClick={handleLike}
          aria-label={liked ? 'Odstrani všeček' : 'Všečkaj'}
          aria-pressed={liked}
          className={cn(
            'flex min-h-[44px] min-w-[44px] items-center gap-1.5 rounded-lg px-2 text-sm transition-colors',
            liked
              ? 'text-primary'
              : 'text-muted-foreground hover:text-foreground',
            isPending && 'pointer-events-none opacity-50'
          )}
        >
          <svg
            className="size-5"
            fill={liked ? 'currentColor' : 'none'}
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={liked ? 0 : 1.5}
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
            />
          </svg>
          <span>{likeCount}</span>
        </button>

        {/* Comment button */}
        <button
          type="button"
          onClick={() => onCommentClick?.(post.id)}
          aria-label="Komentarji"
          className="flex min-h-[44px] min-w-[44px] items-center gap-1.5 rounded-lg px-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <svg
            className="size-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
            />
          </svg>
          <span>{post.comments}</span>
        </button>
      </footer>
    </article>
  )
}

// Skeleton loader for PostCard
export function PostCardSkeleton({
  showMedia = false,
  mediaType = 'photo',
}: {
  showMedia?: boolean
  mediaType?: 'photo' | 'video'
}) {
  const mediaAspectClass = mediaType === 'video' ? 'aspect-video' : 'aspect-[4/5]'
  return (
    <div className="border-b border-border bg-background px-4 py-5" aria-hidden>
      <div className="flex items-center gap-3 mb-4">
        <div className="size-9 rounded-full bg-muted animate-pulse" />
        <div className="flex flex-col gap-1.5 flex-1">
          <div className="h-3.5 w-24 rounded-full bg-muted animate-pulse" />
          <div className="h-3 w-16 rounded-full bg-muted animate-pulse" />
        </div>
      </div>

      {showMedia && <div className={`mb-4 ${mediaAspectClass} w-full rounded-lg bg-muted animate-pulse`} data-testid="post-card-skeleton-media" />}

      <div className="flex flex-col gap-2">
        <div className="h-4 w-3/4 rounded-full bg-muted animate-pulse" />
        <div className="h-3.5 w-full rounded-full bg-muted animate-pulse" />
        <div className="h-3.5 w-5/6 rounded-full bg-muted animate-pulse" />
      </div>
      <div className="mt-4 flex gap-2">
        <div className="h-8 w-16 rounded-lg bg-muted animate-pulse" />
        <div className="h-8 w-16 rounded-lg bg-muted animate-pulse" />
      </div>
    </div>
  )
}
