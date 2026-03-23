'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useFeedStore } from '@/features/feed/store'

interface UseVideoControllerReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>
  isActive: boolean
  handlePlay: () => void
  handlePause: () => void
}

export function useVideoController(videoId: string): UseVideoControllerReturn {
  const videoRef = useRef<HTMLVideoElement>(null)
  const activeVideoId = useFeedStore((s) => s.activeVideoId)
  const setActiveVideo = useFeedStore((s) => s.setActiveVideo)
  const isActive = activeVideoId === videoId

  // Автопауза при смене активного видео (другое видео стало активным)
  useEffect(() => {
    if (activeVideoId !== videoId && videoRef.current && !videoRef.current.paused) {
      videoRef.current.pause()
    }
  }, [activeVideoId, videoId])

  // Автопауза при выходе из viewport через IntersectionObserver
  useEffect(() => {
    const el = videoRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting && !el.paused) {
          el.pause()
          // Освобождаем activeVideoId только если это наше видео
          if (useFeedStore.getState().activeVideoId === videoId) {
            useFeedStore.getState().setActiveVideo(null)
          }
        }
      },
      { threshold: 0.2 } // менее 20% видимости → пауза
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [videoId])

  const handlePlay = useCallback(() => {
    setActiveVideo(videoId)
  }, [videoId, setActiveVideo])

  const handlePause = useCallback(() => {
    // Освобождаем только если мы сами активны (защита от stale closure через getState)
    if (useFeedStore.getState().activeVideoId === videoId) {
      setActiveVideo(null)
    }
  }, [videoId, setActiveVideo])

  return { videoRef, isActive, handlePlay, handlePause }
}
