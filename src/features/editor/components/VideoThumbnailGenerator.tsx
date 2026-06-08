'use client'

import { useEffect, useRef } from 'react'
import { generateVideoThumbnail } from '@/lib/media/generateVideoThumbnail'

interface VideoThumbnailGeneratorProps {
  mediaKey: string
  file: File
  onGenerating: (key: string) => void
  onSuccess: (key: string, blob: Blob, previewUrl: string) => void
  onError: (key: string) => void
}

// Headless smart container: на маунте генерирует Canvas-thumbnail из первого кадра
// видео и сообщает результат через колбэки. Рендерит null — индикатор статуса
// показывает MediaItemPreview.
export function VideoThumbnailGenerator({
  mediaKey,
  file,
  onGenerating,
  onSuccess,
  onError,
}: VideoThumbnailGeneratorProps) {
  // Колбэки в ref, чтобы effect с пустыми deps вызывал актуальные значения
  const cbRef = useRef({ onGenerating, onSuccess, onError })
  cbRef.current = { onGenerating, onSuccess, onError }

  useEffect(() => {
    let active = true
    cbRef.current.onGenerating(mediaKey)

    generateVideoThumbnail(file)
      .then((blob) => {
        if (!active) return
        const previewUrl = URL.createObjectURL(blob)
        cbRef.current.onSuccess(mediaKey, blob, previewUrl)
      })
      .catch(() => {
        if (!active) return
        cbRef.current.onError(mediaKey)
      })

    return () => {
      active = false
    }
    // Одноразовая генерация на маунт; mediaKey/file стабильны на элемент.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
