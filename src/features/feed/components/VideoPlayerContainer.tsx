'use client'

import { useEffect, useRef } from 'react'
import { useFeedStore } from '@/features/feed/store'
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

  // State Leak fix: key={props.src} на VideoPlayer не триггерит cleanup хука useVideoController.
  // При смене src сбрасываем activeVideoId вручную, если этот плеер был активным.
  const prevSrcRef = useRef(props.src)
  useEffect(() => {
    const prevSrc = prevSrcRef.current
    prevSrcRef.current = props.src
    if (prevSrc !== props.src && useFeedStore.getState().activeVideoId === props.videoId) {
      useFeedStore.getState().setActiveVideo(null)
    }
  }, [props.src, props.videoId])

  // key={props.src}: при смене src VideoPlayer размонтируется и монтируется заново,
  // что сбрасывает hasError и предотвращает двойной синхронный ререндер derived state.
  return <VideoPlayer key={props.src} {...props} ref={videoRef} onPlay={handlePlay} onPause={handlePause} />
}
