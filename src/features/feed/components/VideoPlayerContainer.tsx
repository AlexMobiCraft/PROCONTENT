'use client'

import { useVideoController } from '@/hooks/useVideoController'
import { VideoPlayer, type VideoPlayerProps } from '@/components/media/VideoPlayer'

type VideoPlayerContainerProps = Omit<VideoPlayerProps, 'onPlay' | 'onPause' | 'ref'>

/**
 * Smart Container: связывает Dumb UI VideoPlayer с useVideoController.
 * Используется в GalleryGrid и PostCard вместо прямого VideoPlayer.
 * Гарантирует: единственное активное видео в ленте (NFR4.1).
 */
export function VideoPlayerContainer(props: VideoPlayerContainerProps) {
  const { videoRef, handlePlay, handlePause } = useVideoController(props.videoId)
  // key={props.src}: при смене src VideoPlayer размонтируется и монтируется заново,
  // что сбрасывает hasError и предотвращает двойной синхронный ререндер derived state.
  return <VideoPlayer key={props.src} {...props} ref={videoRef} onPlay={handlePlay} onPause={handlePause} />
}
