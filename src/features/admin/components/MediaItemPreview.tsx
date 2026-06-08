'use client'

import { Loader2, Play } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MediaType, ThumbnailStatus } from '@/features/admin/types'

interface MediaItemPreviewProps {
  mediaType: MediaType
  /** Poster: для изображений — их URL; для видео — сгенерированный/существующий thumbnail */
  posterUrl: string | null
  /** Сырой URL видео — fallback-кадр, если poster ещё не готов (только видео) */
  videoUrl?: string | null
  /** Статус генерации thumbnail (только новые видео) */
  thumbnailStatus?: ThumbnailStatus
  className?: string
}

/**
 * Dumb UI (Story 8.1, Task 2.1): превью медиа-элемента в списке загрузчика.
 *
 * Для видео сгенерированный poster имеет приоритет над сырым первым кадром (Task 2.3),
 * показывается overlay-иконка видео и индикатор генерации poster.
 */
export function MediaItemPreview({
  mediaType,
  posterUrl,
  videoUrl,
  thumbnailStatus,
  className,
}: MediaItemPreviewProps) {
  const isVideo = mediaType === 'video'
  const isGenerating = thumbnailStatus === 'generating'

  return (
    <div
      className={cn('relative size-14 shrink-0 overflow-hidden rounded bg-muted', className)}
    >
      {isVideo ? (
        posterUrl ? (
          // Сгенерированный/существующий poster приоритетнее сырого кадра видео
          // eslint-disable-next-line @next/next/no-img-element
          <img src={posterUrl} alt="" className="size-full object-cover" />
        ) : (
          <video src={videoUrl ?? undefined} className="size-full object-cover" muted preload="none" />
        )
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={posterUrl ?? undefined} alt="" className="size-full object-cover" />
      )}

      {/* Overlay-иконка видео */}
      {isVideo && !isGenerating && (
        <span
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
          aria-hidden="true"
        >
          <span className="flex size-5 items-center justify-center rounded-full bg-black/45 text-white">
            <Play className="size-3 fill-current" />
          </span>
        </span>
      )}

      {/* Индикатор генерации poster */}
      {isGenerating && (
        <span
          className="absolute inset-0 flex items-center justify-center bg-black/40"
          role="status"
          aria-label="Generiranje posterja..."
          title="Generiranje posterja..."
        >
          <Loader2 className="size-4 animate-spin text-white" />
        </span>
      )}
    </div>
  )
}
