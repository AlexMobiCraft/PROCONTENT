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

  // key={`${props.videoId}-${props.src}`}: при смене src или videoId VideoPlayer размонтируется заново,
  // что сбрасывает hasError. Композитный ключ гарантирует ремаунт даже если только videoId сменился.
  return <VideoPlayer key={`${props.videoId}-${props.src}`} {...props} ref={videoRef} onPlay={handlePlay} onPause={handlePause} />
}
