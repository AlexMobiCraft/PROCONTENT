'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { PostActionsMenu } from './PostActionsMenu'
import { LazyMediaWrapper, type MediaItem } from '../media/LazyMediaWrapper'
import { VideoPlayerContainer } from '@/features/feed/components/VideoPlayerContainer'
import { GalleryGrid, GalleryGridSkeleton } from './GalleryGrid'
import { HeartIcon } from '@/components/ui/icons/HeartIcon'
import { CommentIcon } from '@/components/ui/icons/CommentIcon'
import type { PostMedia } from '@/features/feed/types'

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
    avatar_url?: string | null
  }
  /** ISO дата для атрибута dateTime элемента time (семантика + a11y). */
  created_at?: string
  /** Устаревший URL медиафайла. Предпочтительно использовать mediaItem (AC 6). */
  imageUrl?: string
  /**
   * Объект post_media из БД (AC 6).
   * Если передан — используется вместо imageUrl для LazyMediaWrapper.
   */
  mediaItem?: MediaItem
  /** Все медиафайлы поста — для GalleryGrid (Story 2.4). */
  media?: PostMedia[]
  type: 'text' | 'photo' | 'video' | 'gallery' | 'multi-video'
}

interface PostCardProps {
  post: PostCardData
  priority?: boolean
  /** Кнопка лайка заблокирована — запрос toggle_like в процессе */
  isPending?: boolean
  canManage?: boolean
  canEdit?: boolean
  editHref?: string
  onCommentClick?: (postId: string) => void
  /** Вызывается при нажатии кнопки лайка — вызывающий код определяет направление toggle. */
  onLikeToggle?: (postId: string) => void
  /** Вызывается при нажатии кнопки опций (троеточие). */
  onOptionsClick?: (postId: string) => void
  /** Вызывается при нажатии на pill категории — для фильтрации ленты. */
  onCategoryClick?: (category: string) => void
}

export function PostCard({ post, priority = false, isPending = false, canManage = false, canEdit = false, editHref, onCommentClick, onLikeToggle, onOptionsClick, onCategoryClick }: PostCardProps) {
  const router = useRouter()
  // Локальный state не нужен: FeedContainer управляет оптимистичным обновлением post.isLiked/post.likes
  const liked = post.isLiked ?? false
  const likeCount = post.likes

  function handleLike() {
    if (isPending) return
    onLikeToggle?.(post.id)
  }

  function saveScrollY() {
    sessionStorage.setItem('feed:scrollY', String(window.scrollY))
  }

  function handleCardClick(e: React.MouseEvent) {
    const target = e.target as HTMLElement
    // Ignore clicks on buttons, links, or specific interactive elements
    if (target.closest('button') || target.closest('a') || target.tagName === 'VIDEO') {
      return
    }
    // Предотвращает навигацию при выделении текста (текст не должен быть интерактивным)
    const selection = window.getSelection()?.toString()
    if (selection) {
      return
    }
    saveScrollY()
    router.push(`/feed/${post.id}?from=feed`)
  }

  return (
    <article
      className="border-b border-border bg-background px-4 py-5 cursor-pointer transition-colors hover:bg-muted/50"
      onClick={handleCardClick}
      onClickCapture={(e) => {
        const anchor = (e.target as HTMLElement).closest('a')
        if (anchor?.getAttribute('href')?.includes(`/feed/${post.id}`)) {
          saveScrollY()
        }
      }}
      aria-label={`Objava uporabnika ${post.author.name}`}
    >
      {/* Header */}
      <header className="mb-3 flex items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-primary overflow-hidden">
          {post.author.avatar_url ? (
            <Image src={post.author.avatar_url} alt={post.author.name} width={36} height={36} className="size-full object-cover" />
          ) : (
            post.author.initials
          )}
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
            {post.category && onCategoryClick ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onCategoryClick(post.category)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.stopPropagation()
                  }
                }}
                className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                aria-label={`Filtriraj po kategoriji ${post.category}`}
              >
                {post.category}
              </button>
            ) : post.category ? (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {post.category}
              </span>
            ) : null}
            <time dateTime={post.created_at} className="text-xs text-muted-foreground">{post.date}</time>
          </div>
        </div>

        <PostActionsMenu
          canEdit={canEdit}
          canDelete={canManage}
          editHref={editHref}
          onDelete={() => onOptionsClick?.(post.id)}
        />
      </header>

      {/* Media Content — кликабельна, tabIndex=-1 чтобы не дублировать tab-stop с заголовком */}
      {/* Галереи и одиночные видео НЕ оборачиваются в <Link>: <video controls> внутри <a> — невалидный HTML */}
      {(post.media?.length ?? 0) >= 2 ? (
        post.media!.some((m) => m.media_type === 'video') ? (
          <div className="mb-4">
            <GalleryGrid media={post.media!} priority={priority} itemLinkHref={`/feed/${post.id}?from=feed`} interactive={false} />
          </div>
        ) : (
          <Link href={`/feed/${post.id}?from=feed`} className="mb-4 block" tabIndex={-1} prefetch={false}>
            <GalleryGrid media={post.media!} priority={priority} interactive={false} />
          </Link>
        )
      ) : (post.type === 'video' || post.type === 'multi-video') && (post.mediaItem?.url || post.media?.[0]?.url) ? (
        /* Клик на контейнере ведёт к посту. Нативные контролы <video> и кнопки плеера
           перехватываются через проверку target — play/pause не вызывают навигацию. */
        <div
          className="mb-4 cursor-pointer"
          role="button"
          tabIndex={0}
          aria-label={`Poglej objavo: ${post.title}`}
          onClick={(e) => {
            const target = e.target as HTMLElement
            if (target.closest('button') || target.tagName === 'VIDEO') return
            e.stopPropagation()
            saveScrollY()
            router.push(`/feed/${post.id}?from=feed`)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              saveScrollY()
              router.push(`/feed/${post.id}?from=feed`)
            }
          }}
          data-testid="video-card-container"
        >
          <VideoPlayerContainer
            videoId={post.mediaItem?.id ?? post.media?.[0]?.id ?? `fallback-video-${post.id}`}
            src={(post.mediaItem?.url ?? post.media?.[0]?.url)!}
            poster={post.mediaItem?.thumbnail_url ?? post.media?.[0]?.thumbnail_url ?? undefined}
            alt={post.title}
            aspectRatio={post.type === 'video' ? '9/16' : '4/5'}
            className={post.type === 'video' ? 'max-h-[560px]' : undefined}
            priority={priority}
          />
        </div>
      ) : (post.mediaItem || post.imageUrl) ? (
        <Link href={`/feed/${post.id}?from=feed`} className="mb-4 block" tabIndex={-1} prefetch={false}>
          <LazyMediaWrapper
            {...(post.mediaItem
              ? { mediaItem: post.mediaItem }
              : { src: post.imageUrl!, type: (post.type === 'video' || post.type === 'multi-video') ? 'video' : 'photo' })}
            alt={post.title}
            aspectRatio={post.type === 'video' ? '16/9' : '4/5'}
            priority={priority}
          />
        </Link>
      ) : null}

      {/* Content — заголовок + excerpt в одном Link для правильного UX */}
      <div className="flex flex-col gap-2">
        <Link href={`/feed/${post.id}?from=feed`} className="group flex flex-col gap-2" prefetch={false}>
          <h2 className="font-heading text-base font-semibold leading-snug text-foreground text-balance group-hover:text-primary transition-colors">
            {post.title}
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground line-clamp-3">
            {post.excerpt}
          </p>
        </Link>
      </div>

      {/* Type badge for video/photo/gallery/multi-video */}
      {post.type !== 'text' && (
        <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          {post.type === 'video' || post.type === 'multi-video' ? (
            <>
              <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
              </svg>
              <span>{post.type === 'multi-video' ? 'Video galerija' : 'Video'}</span>
            </>
          ) : (
            <>
              <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
              <span>{post.type === 'gallery' ? 'Galerija' : 'Fotografija'}</span>
            </>
          )}
        </div>
      )}

      {/* Footer — social actions */}
      <footer className="mt-4 flex items-center gap-1">
        {/* Like button */}
        <button
          type="button"
          disabled={isPending}
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
          <HeartIcon filled={liked} />
          <span>{likeCount}</span>
        </button>

        {/* Comment button */}
        <button
          type="button"
          onClick={() => onCommentClick?.(post.id)}
          aria-label="Komentarji"
          className="flex min-h-[44px] min-w-[44px] items-center gap-1.5 rounded-lg px-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <CommentIcon />
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
  galleryCount = 4,
}: {
  showMedia?: boolean
  mediaType?: 'photo' | 'video' | 'gallery' | 'multi-video'
  /** Количество ячеек в GalleryGridSkeleton (используется только при mediaType='gallery'). */
  galleryCount?: number
}) {
  const mediaAspectClass = mediaType === 'video' ? 'aspect-[9/16] max-h-[560px]' : 'h-72'
  return (
    <div className="border-b border-border bg-background px-4 py-5" aria-hidden>
      <div className="flex items-center gap-3 mb-4">
        <div className="size-9 rounded-full bg-muted animate-pulse" />
        <div className="flex flex-col gap-1.5 flex-1">
          <div className="h-3.5 w-24 rounded-full bg-muted animate-pulse" />
          <div className="h-3 w-16 rounded-full bg-muted animate-pulse" />
        </div>
      </div>

      {showMedia && mediaType === 'gallery' && (
        <div className="mb-4" data-testid="post-card-skeleton-media">
          <GalleryGridSkeleton count={galleryCount} />
        </div>
      )}
      {showMedia && mediaType !== 'gallery' && (
        <div className={cn('mb-4 w-full rounded-lg bg-muted animate-pulse', mediaAspectClass)} data-testid="post-card-skeleton-media" />
      )}

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
