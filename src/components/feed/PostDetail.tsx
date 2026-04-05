'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Pencil, Trash2 } from 'lucide-react'
import { deletePost } from '@/features/admin/api/posts'
import { getAdminPostEditPath } from '@/lib/app-routes'
import { Button, buttonVariants } from '@/components/ui/button'
import { LazyMediaWrapper } from '../media/LazyMediaWrapper'
import { VideoPlayerContainer } from '@/features/feed/components/VideoPlayerContainer'
import { GalleryGrid } from './GalleryGrid'
import { HeartIcon } from '@/components/ui/icons/HeartIcon'
import { CommentIcon } from '@/components/ui/icons/CommentIcon'
import { createClient } from '@/lib/supabase/client'
import { useFeedStore } from '@/features/feed/store'
import { CommentsList } from '@/features/comments/components/CommentsList'
import { CommentForm } from '@/features/comments/components/CommentForm'
import { useComments } from '@/features/comments/hooks/useComments'
import { cn } from '@/lib/utils'
import type { PostDetail as PostDetailData, ToggleLikeResponse } from '@/features/feed/types'
import type { Comment } from '@/features/comments/types'

function isToggleLikeResponse(v: unknown): v is ToggleLikeResponse {
  return typeof v === 'object' && v !== null && 'is_liked' in v && 'likes_count' in v
}

type UserProfile = {
  id: string
  display_name: string | null
  avatar_url: string | null
  role: string | null
} | null

interface PostDetailProps {
  post: PostDetailData
  currentUserId?: string | null
  currentUserProfile?: UserProfile
  /** 'feed' = SPA-переход из ленты → router.back() сохраняет скролл (AC 3).
   * undefined = прямая ссылка / внешний переход → router.push('/feed'). */
  from?: string
  /** Дата, форматированная в RSC — исключает layout shift (нет useEffect/useState). */
  formattedDate?: string
  /** Комментарии, загруженные в RSC (Story 3.1) */
  initialComments?: Comment[]
}

export function PostDetail({
  post,
  currentUserId,
  currentUserProfile,
  from,
  formattedDate,
  initialComments = [],
}: PostDetailProps) {
  const router = useRouter()
  const updatePost = useFeedStore((s) => s.updatePost)
  const [liked, setLiked] = useState(post.is_liked)
  const [likesCount, setLikesCount] = useState(post.likes)
  const [isPending, setIsPending] = useState(false)
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [isDeletingPost, setIsDeletingPost] = useState(false)
  // Предотвращает утечку памяти: не вызываем setState на unmounted компоненте
  const isMountedRef = useRef(true)

  const { comments, addComment, retryComment, deleteComment } = useComments({
    postId: post.id,
    initialComments,
    currentUserProfile,
  })

  const currentUserIsAdmin = currentUserProfile?.role === 'admin'
  const canDeletePost = Boolean(currentUserId && (currentUserId === post.author_id || currentUserIsAdmin))
  const canEditPost = currentUserId === post.author_id

  async function handleDelete(commentId: string) {
    try {
      await deleteComment(commentId)
      toast.success('Komentar je bil izbrisan')
    } catch {
      toast.error('Napaka pri brisanju komentarja')
    }
  }

  async function handleDeletePost() {
    if (!canDeletePost) {
      toast.error('Objavo lahko izbriše avtorica ali admin')
      return
    }

    if (isDeletingPost) {
      return
    }

    setIsDeletingPost(true)
    try {
      await deletePost(post.id)
      useFeedStore.getState().removePost(post.id)
      toast.success('Objava je bila izbrisana')
      setIsDeleteConfirmOpen(false)
      router.replace('/feed')
    } catch (error) {
      console.error('Napaka pri brisanju objave:', error)
      toast.error('Brisanje objave ni uspelo')
    } finally {
      if (isMountedRef.current) {
        setIsDeletingPost(false)
      }
    }
  }

  useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // Дата: если formattedDate не передан (тесты/storybook), форматируем синхронно.
  // В production всегда передаётся из RSC page.tsx — исключает layout shift.
  const displayDate =
    formattedDate ??
    new Date(post.created_at).toLocaleDateString('sl-SI', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })

  function handleBack() {
    // AC 3: from='feed' означает SPA-переход из ленты → router.back() сохраняет позицию скролла.
    // document.referrer некорректен для SPA-переходов в Next.js App Router (не обновляется).
    if (from === 'feed') {
      router.back()
    } else {
      router.push('/feed')
    }
  }

  async function handleLike() {
    if (isPending) return
    if (!currentUserId) {
      toast.info('Za všečkanje se morate prijaviti')
      return
    }
    const prevLiked = liked
    const prevCount = likesCount
    const newLiked = !prevLiked
    const newCount = prevCount + (newLiked ? 1 : -1)
    // Оптимистичное обновление: UI + Zustand store синхронно (до RPC)
    setLiked(newLiked)
    setLikesCount(newCount)
    updatePost(post.id, { likes_count: newCount, is_liked: newLiked })
    setIsPending(true)
    const supabase = createClient()
    try {
      const { data, error } = await supabase.rpc('toggle_like', { p_post_id: post.id })
      if (error) throw error
      if (!isToggleLikeResponse(data)) throw new Error('Unexpected toggle_like response')
      // Синхронизируем с ответом сервера — source of truth
      // Проверяем isMountedRef перед setState чтобы не вызывать setState на unmounted компоненте
      if (isMountedRef.current) {
        setLiked(data.is_liked)
        setLikesCount(data.likes_count)
        updatePost(post.id, { likes_count: data.likes_count, is_liked: data.is_liked })
      }
    } catch {
      // Откат UI + store при ошибке
      if (isMountedRef.current) {
        setLiked(prevLiked)
        setLikesCount(prevCount)
        updatePost(post.id, { likes_count: prevCount, is_liked: prevLiked })
      }
      // Проверяем актуальность сессии: разные сообщения для истёкшей сессии vs сетевой ошибки
      // getSession() не выполняет запрос к серверу (работает локально), поэтому не зависает при отсутствии сети
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        toast.error('Vaša seja je potekla. Prijavite se znova.')
      } else {
        toast.error('Napaka pri všečkanju')
      }
    } finally {
      if (isMountedRef.current) {
        setIsPending(false)
      }
    }
  }

  return (
    <article className="mx-auto max-w-2xl px-4 py-6">
      {/* Back button — router.back() сохраняет позицию скролла (AC 3) */}
      <button
        type="button"
        onClick={handleBack}
        className="mb-6 flex min-h-[44px] w-fit items-center gap-1.5 rounded-lg px-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
        aria-label="Nazaj na objave"
      >
        <svg
          className="size-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        Nazaj
      </button>

      {/* Author header */}
      <header className="mb-6 flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-primary overflow-hidden">
          {post.author.avatar_url ? (
            <Image src={post.author.avatar_url} alt={post.author.name} width={40} height={40} className="size-full object-cover" />
          ) : (
            post.author.initials
          )}
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-foreground">{post.author.name}</span>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {post.category}
            </span>
            <time dateTime={post.created_at} className="text-xs text-muted-foreground">{displayDate}</time>
          </div>
        </div>
        <div className="ml-auto">
          <div className="flex items-center gap-2">
            {canEditPost ? (
              <Link
                href={getAdminPostEditPath(post.id)}
                aria-label="Uredi objavo"
                title="Uredi objavo"
                className={buttonVariants({ variant: 'outline', size: 'icon' })}
              >
                <Pencil className="size-4" />
              </Link>
            ) : null}
            {canDeletePost ? (
              <Button
                type="button"
                variant="destructive"
                size="icon"
                aria-label="Izbriši objavo"
                title="Izbriši objavo"
                onClick={() => setIsDeleteConfirmOpen(true)}
                disabled={isDeletingPost}
              >
                <Trash2 className="size-4" />
              </Button>
            ) : null}
          </div>
        </div>
      </header>

      {/* Title */}
      <h1 className="font-heading mb-4 text-xl font-semibold leading-snug text-foreground">
        {post.title}
      </h1>

      {/* Gallery — 2+ медиафайлов (Story 2.4) */}
      {(post.media?.length ?? 0) >= 2 && (
        <div className="mb-6">
          <GalleryGrid media={post.media!} priority={true} />
        </div>
      )}

      {/* Одиночное медиа: только 'video' и 'photo'.
          multi-video/gallery с media.length < 2 невозможны по инварианту derivePostType. */}
      {(post.media?.length ?? 0) < 2 && (post.mediaItem || post.imageUrl) && (
        <div className="mb-6">
          {post.type === 'video' ? (
            <VideoPlayerContainer
              videoId={post.mediaItem?.id ?? post.id}
              src={(post.mediaItem?.url ?? post.imageUrl)!}
              poster={post.mediaItem?.thumbnail_url ?? undefined}
              alt={post.title}
              aspectRatio="9/16"
              className="max-h-[640px]"
              priority={true}
            />
          ) : post.type === 'photo' ? (
            <LazyMediaWrapper
              mediaItem={post.mediaItem ?? undefined}
              src={!post.mediaItem ? (post.imageUrl ?? undefined) : undefined}
              alt={post.title}
              aspectRatio="4/5"
              type="photo"
              priority={true}
              sizes="(max-width: 768px) 100vw, 672px"
            />
          ) : null}
        </div>
      )}

      {/* Content */}
      <div className="prose prose-sm mt-4 max-w-none text-foreground [&_figure[data-align='center']]:mx-auto [&_figure[data-align='left']]:mr-auto [&_figure[data-align='right']]:ml-auto [&_figure[data-type='inline-image']]:my-4 [&_figure[data-type='inline-image']]:space-y-2 [&_figure[data-type='inline-image']_img]:rounded-lg [&_figure[data-type='inline-image']_img]:border [&_figure[data-type='inline-image']_img]:border-border">
        {post.content !== null ? (
          <div
            dangerouslySetInnerHTML={{
              __html: post.content || '<p></p>',
            }}
          />
        ) : (
          <p className="leading-relaxed text-muted-foreground">{post.excerpt}</p>
        )}
      </div>

      {/* Footer stats */}
      <footer className="mt-8 flex items-center gap-1 border-t border-border pt-4">
        {/* Like button — интерактивный с оптимистичным обновлением */}
        <button
          type="button"
          onClick={handleLike}
          disabled={isPending}
          aria-label={liked ? 'Odstrani všeček' : 'Všečkaj'}
          aria-pressed={liked}
          className={cn(
            'flex min-h-[44px] min-w-[44px] items-center gap-1.5 rounded-lg px-2 text-sm transition-colors',
            liked ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
            isPending && 'pointer-events-none opacity-50'
          )}
        >
          <HeartIcon filled={liked} />
          <span>{likesCount}</span>
        </button>

        {/* Comment count — статичный */}
        <span className="flex min-h-[44px] min-w-[44px] items-center gap-1.5 px-2 text-sm text-muted-foreground">
          <CommentIcon />
          <span>{post.comments}</span>
        </span>
      </footer>

      {/* Discussion section (Story 3.1 + 3.2) */}
      <section className="mt-8" aria-label="Komentarji">
        <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-2">
          Komentarji
        </h2>
        <CommentsList
          comments={comments}
          postAuthorId={post.author_id}
          currentUserId={currentUserId ?? null}
          currentUserIsAdmin={currentUserIsAdmin}
          onRetry={retryComment}
          onReply={(content, parentId) => addComment(content, parentId)}
          onDelete={currentUserId ? handleDelete : undefined}
        />
        {currentUserId && (
          <div className="mt-4 border-t border-border pt-4">
            <CommentForm onSubmit={(content) => addComment(content)} />
          </div>
        )}
      </section>

      {isDeleteConfirmOpen ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-foreground/40 p-4 sm:items-center">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-post-title"
            aria-describedby="delete-post-description"
            className="w-full max-w-sm rounded-[1.5rem] border border-border bg-background p-5 shadow-[0_20px_60px_rgba(0,0,0,0.18)]"
          >
            <div className="flex flex-col gap-2">
              <h3 id="delete-post-title" className="font-heading text-xl font-semibold text-foreground">
                Izbris objave
              </h3>
              <p id="delete-post-description" className="text-sm leading-relaxed text-muted-foreground">
                Ali res želite izbrisati to objavo? Tega dejanja ni mogoče razveljaviti.
              </p>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsDeleteConfirmOpen(false)}
                disabled={isDeletingPost}
              >
                Prekliči
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => void handleDeletePost()}
                disabled={isDeletingPost}
              >
                {isDeletingPost ? 'Brisanje…' : 'Izbriši'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </article>
  )
}
