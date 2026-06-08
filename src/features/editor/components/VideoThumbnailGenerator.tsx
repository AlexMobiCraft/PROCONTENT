'use client'

import { useEffect, useRef } from 'react'
import { generateVideoThumbnail } from '@/lib/media/generateVideoThumbnail'

interface VideoThumbnailGeneratorProps {
  /** Уникальный ключ медиа-элемента (NewMediaItem.key) */
  mediaKey: string
  /** Видео-файл для генерации thumbnail */
  file: File
  /** Вызывается при старте генерации (статус → generating) */
  onGenerating: (key: string) => void
  /** Вызывается при успешной генерации с blob и ObjectURL для предпросмотра */
  onSuccess: (key: string, blob: Blob, previewUrl: string) => void
  /** Вызывается при ошибке Canvas (CORS/формат) — серверный fallback при сохранении */
  onError: (key: string) => void
}

/**
 * Smart container (Story 8.1, Task 1.4): на маунте генерирует thumbnail из первого
 * кадра видео (Canvas, primary path) и сообщает результат через колбэки.
 *
 * Безголовый — рендерит null; визуальный индикатор статуса показывает MediaItemPreview.
 * Запускается ровно один раз на элемент (deps []), колбэки читаются через ref,
 * поэтому пересоздание колбэков родителем не прерывает текущую генерацию.
 */
export function VideoThumbnailGenerator({
  mediaKey,
  file,
  onGenerating,
  onSuccess,
  onError,
}: VideoThumbnailGeneratorProps) {
  // Храним последние колбэки в ref, чтобы effect с пустыми deps вызывал актуальные
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
    // Генерация — одноразовая операция на маунт; mediaKey/file стабильны на элемент.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
