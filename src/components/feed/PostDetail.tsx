'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LazyMediaWrapper } from '../media/LazyMediaWrapper'
import { VideoPlayerContainer } from '@/features/feed/components/VideoPlayerContainer'
import { GalleryGrid } from './GalleryGrid'
import { createClient } from '@/lib/supabase/client'
import { useFeedStore } from '@/features/feed/store'
import { cn } from '@/lib/utils'
import type { PostDetail as PostDetailData, ToggleLikeResponse } from '@/features/feed/types'

function isToggleLikeResponse(v: unknown): v is ToggleLikeResponse {
  return typeof v === 'object' && v !== null && 'is_liked' in v && 'likes_count' in v
}

interface PostDetailProps {
  post: PostDetailData
  currentUserId?: string | null
}

export function PostDetail({ post, currentUserId }: PostDetailProps) {
  const router = useRouter()
  const updatePost = useFeedStore((s) => s.updatePost)
  const [liked, setLiked] = useState(post.isLiked)
  const [likesCount, setLikesCount] = useState(post.likes)
  const [isPending, setIsPending] = useState(false)

  // Форматируем дату на клиенте — избегаем timezone mismatch с сервером
  const date = new Date(post.created_at).toLocaleDateString('sl-SI', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  async function handleLike() {
    if (isPending || !currentUserId) return
    const prevLiked = liked
    const prevCount = likesCount
    const newLiked = !prevLiked
    const newCount = prevCount + (newLiked ? 1 : -1)
    // Оптимистичное обновление: UI + Zustand store синхронно (до RPC)
    setLiked(newLiked)
    setLikesCount(newCount)
    updatePost(post.id, { likes_count: newCount, is_liked: newLiked })
    setIsPending(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('toggle_like', { p_post_id: post.id })
      if (error) throw error
      if (!isToggleLikeResponse(data)) throw new Error('Unexpected toggle_like response')
      // Синхронизируем с ответом сервера — source of truth
      setLiked(data.is_liked)
      setLikesCount(data.likes_count)
      updatePost(post.id, { likes_count: data.likes_count, is_liked: data.is_liked })
    } catch {
      // Откат UI + store при ошибке
      setLiked(prevLiked)
      setLikesCount(prevCount)
      updatePost(post.id, { likes_count: prevCount, is_liked: prevLiked })
    } finally {
      setIsPending(false)
    }
  }

  return (
    <article className="mx-auto max-w-2xl px-4 py-6">
      {/* Back button — router.back() сохраняет позицию скролла (AC 3) */}
      <button
        type="button"
        onClick={() => router.back()}
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
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-primary">
          {post.author.initials}
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-foreground">{post.author.name}</span>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {post.category}
            </span>
            <span className="text-xs text-muted-foreground" suppressHydrationWarning>{date}</span>
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

      {/* Одиночное медиа: photo или video */}
      {(post.media?.length ?? 0) < 2 && (post.mediaItem || post.imageUrl) && (
        <div className="mb-6">
          {post.type === 'video' ? (
            <VideoPlayerContainer
              videoId={post.mediaItem?.id ?? post.id}
              src={(post.mediaItem?.url ?? post.imageUrl)!}
              poster={post.mediaItem?.thumbnail_url ?? undefined}
              alt={post.title}
              aspectRatio="16/9"
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

      {/* Rich text content */}
      {post.type === 'text' && (
        <div className="prose prose-sm max-w-none text-foreground">
          {post.content ? (
            <p className="whitespace-pre-wrap leading-relaxed text-foreground">{post.content}</p>
          ) : (
            <p className="leading-relaxed text-muted-foreground">{post.excerpt}</p>
          )}
        </div>
      )}

      {/* Photo/Video: подпись или контент под медиа */}
      {post.type !== 'text' && (
        <div>
          {post.content ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {post.content}
            </p>
          ) : (
            <p className="text-sm leading-relaxed text-muted-foreground">{post.excerpt}</p>
          )}
        </div>
      )}

      {/* Footer stats */}
      <footer className="mt-8 flex items-center gap-1 border-t border-border pt-4">
        {/* Like button — интерактивный с оптимистичным обновлением */}
        <button
          type="button"
          onClick={handleLike}
          aria-label={liked ? 'Odstrani všeček' : 'Všečkaj'}
          aria-pressed={liked}
          className={cn(
            'flex min-h-[44px] min-w-[44px] items-center gap-1.5 rounded-lg px-2 text-sm transition-colors',
            liked ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
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
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
          </svg>
          <span>{likesCount}</span>
        </button>

        {/* Comment count — статичный */}
        <span className="flex min-h-[44px] min-w-[44px] items-center gap-1.5 px-2 text-sm text-muted-foreground">
          <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
          </svg>
          <span>{post.comments}</span>
        </span>
      </footer>
    </article>
  )
}
