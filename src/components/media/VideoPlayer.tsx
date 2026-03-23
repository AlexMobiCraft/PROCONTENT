'use client'

import { cn } from '@/lib/utils'
import { useVideoController } from '@/hooks/useVideoController'

interface VideoPlayerProps {
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
}

export function VideoPlayer({
  videoId,
  src,
  poster,
  alt = 'Videoposnetek',
  aspectRatio = '16/9',
  className,
}: VideoPlayerProps) {
  const { videoRef, handlePlay, handlePause } = useVideoController(videoId)

  const ratioClass = {
    '16/9': 'aspect-video',
    '4/5': 'aspect-[4/5]',
    '1/1': 'aspect-square',
  }[aspectRatio]

  return (
    <div className={cn('relative overflow-hidden rounded-md bg-black', ratioClass, className)}>
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        controls
        playsInline
        preload="none"
        aria-label={alt}
        onPlay={handlePlay}
        onPause={handlePause}
        className="absolute inset-0 h-full w-full object-contain"
      />
    </div>
  )
}
