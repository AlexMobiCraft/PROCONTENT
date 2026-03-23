'use client'

import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

export interface VideoPlayerProps {
  /** ID видео в post_media — уникален в рамках одного сеанса */
  videoId: string
  /** URL видеофайла (из post_media.url) */
  src: string
  /** URL превью-изображения (из post_media.thumbnail_url или post.image_url) */
  poster?: string
  /** alt для превью изображения (accessibility) */
  alt?: string
  aspectRatio?: '16/9' | '4/5' | '1/1'
  className?: string
  /** Первое видео в ленте — предзагрузить метаданные вместо полного отказа от preload */
  priority?: boolean
  /** Callback при старте воспроизведения — прокидывается от useVideoController */
  onPlay?: () => void
  /** Callback при паузе — прокидывается от useVideoController */
  onPause?: () => void
  /** Показывать skeleton-placeholder вместо плеера */
  isLoading?: boolean
  /** Внешний ref на <video> элемент — передаётся из useVideoController (React 19) */
  ref?: React.RefObject<HTMLVideoElement | null>
}

export function VideoPlayer({
  videoId: _videoId,
  src,
  poster,
  alt = 'Videoposnetek',
  aspectRatio = '16/9',
  className,
  priority = false,
  onPlay,
  onPause,
  isLoading = false,
  ref: externalRef,
}: VideoPlayerProps) {
  const internalRef = useRef<HTMLVideoElement>(null)
  const videoRef = externalRef ?? internalRef

  const ratioClass = {
    '16/9': 'aspect-video',
    '4/5': 'aspect-[4/5]',
    '1/1': 'aspect-square',
  }[aspectRatio]

  // Автопауза при выходе из viewport через IntersectionObserver (AC #5, AC #8)
  useEffect(() => {
    const el = videoRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting && !el.paused) {
          try {
            el.pause()
          } catch {
            // DOMException может возникнуть при маунте до полной инициализации медиа
          }
        }
      },
      { threshold: 0.2 } // менее 20% видимости → пауза
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [videoRef])

  if (isLoading) {
    return (
      <div
        className={cn('animate-pulse rounded-md bg-muted', ratioClass, className)}
        aria-hidden
        data-testid="video-player-skeleton"
      />
    )
  }

  return (
    <div className={cn('relative overflow-hidden rounded-md bg-black', ratioClass, className)}>
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        controls
        playsInline
        preload={priority ? 'metadata' : 'none'}
        aria-label={alt}
        onPlay={onPlay}
        onPause={onPause}
        className="absolute inset-0 h-full w-full object-cover"
      />
    </div>
  )
}
