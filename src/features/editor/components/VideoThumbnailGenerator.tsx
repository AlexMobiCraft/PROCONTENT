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

export function VideoThumbnailGenerator({
  mediaKey,
  file,
  onGenerating,
  onSuccess,
  onError,
}: VideoThumbnailGeneratorProps) {
  const cbRef = useRef({ onGenerating, onSuccess, onError })
  cbRef.current = { onGenerating, onSuccess, onError }

  useEffect(() => {
    const controller = new AbortController()
    cbRef.current.onGenerating(mediaKey)

    generateVideoThumbnail(file, { signal: controller.signal })
      .then((blob) => {
        if (controller.signal.aborted) return
        const previewUrl = URL.createObjectURL(blob)
        cbRef.current.onSuccess(mediaKey, blob, previewUrl)
      })
      .catch(() => {
        if (controller.signal.aborted) return
        cbRef.current.onError(mediaKey)
      })

    return () => {
      controller.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
