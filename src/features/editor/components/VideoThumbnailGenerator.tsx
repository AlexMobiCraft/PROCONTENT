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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
