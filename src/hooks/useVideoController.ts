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
  // Точечный boolean-селектор: перерендер только когда статус активности ЭТОГО видео меняется.
  // SSR Hydration: activeVideoId инициализируется как null (одинаково на сервере и клиенте).
  // Все потребители хука — 'use client', без localStorage/sessionStorage → hydration mismatch невозможен.
  const isActive = useFeedStore((s) => s.activeVideoId === videoId)
  const setActiveVideo = useFeedStore((s) => s.setActiveVideo)

  // Автопауза при смене активного видео (другое видео стало активным)
  useEffect(() => {
    if (!isActive && videoRef.current && !videoRef.current.paused) {
      videoRef.current.pause()
    }
  }, [isActive])

  // Cleanup при unmount: сброс activeVideoId если этот компонент был активным
  useEffect(() => {
    return () => {
      if (useFeedStore.getState().activeVideoId === videoId) {
        useFeedStore.getState().setActiveVideo(null)
      }
    }
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
