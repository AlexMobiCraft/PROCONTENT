'use client'

import { useEffect, useRef, useState } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { ChevronLeft, ChevronRight, ImageOff, X } from 'lucide-react'
import { useFeedStore } from '@/features/feed/store'
import { cn } from '@/lib/utils'

export interface LightboxMedia {
  id: string
  url: string
  media_type: 'image' | 'video'
  thumbnail_url?: string | null
  alt?: string
}

interface MediaLightboxProps {
  media: LightboxMedia[]
  initialIndex: number
  open: boolean
  onClose: () => void
}

const SWIPE_HORIZONTAL_THRESHOLD = 60
const SWIPE_VERTICAL_CLOSE_THRESHOLD = 120

export function MediaLightbox({ media, initialIndex, open, onClose }: MediaLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [hasMediaError, setHasMediaError] = useState(false)
  const [translateY, setTranslateY] = useState(0)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const pushedRef = useRef(false)
  const pointerRef = useRef<{ startX: number; startY: number; tracking: boolean } | null>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (open) {
      setCurrentIndex(initialIndex)
    }
  }, [open, initialIndex])

  useEffect(() => {
    setHasMediaError(false)
    videoRef.current?.pause()
  }, [currentIndex])

  useEffect(() => {
    if (!open) return
    if (typeof window === 'undefined') return

    useFeedStore.getState().setActiveVideo(null)

    window.history.pushState({ mlOpen: true }, '')
    pushedRef.current = true

    const onPopstate = () => {
      pushedRef.current = false
      onCloseRef.current()
    }
    window.addEventListener('popstate', onPopstate)
    return () => {
      window.removeEventListener('popstate', onPopstate)
      if (pushedRef.current) {
        pushedRef.current = false
        window.history.back()
      }
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') goPrev()
      else if (e.key === 'ArrowRight') goNext()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currentIndex, media.length])

  function goPrev() {
    setCurrentIndex((i) => (i > 0 ? i - 1 : i))
  }
  function goNext() {
    setCurrentIndex((i) => (i < media.length - 1 ? i + 1 : i))
  }

  function handlePointerDown(e: React.PointerEvent) {
    const target = e.target as HTMLElement
    if (target.closest('button') || target.closest('video')) return
    pointerRef.current = { startX: e.clientX, startY: e.clientY, tracking: true }
  }

  function handlePointerMove(e: React.PointerEvent) {
    const p = pointerRef.current
    if (!p?.tracking) return
    const dx = e.clientX - p.startX
    const dy = e.clientY - p.startY
    if (Math.abs(dy) > Math.abs(dx) && dy > 0) {
      setTranslateY(dy)
    }
  }

  function handlePointerUp(e: React.PointerEvent) {
    const p = pointerRef.current
    if (!p?.tracking) return
    const dx = e.clientX - p.startX
    const dy = e.clientY - p.startY
    pointerRef.current = null
    setTranslateY(0)
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > SWIPE_HORIZONTAL_THRESHOLD) {
      if (dx < 0) goNext()
      else goPrev()
    } else if (dy > SWIPE_VERTICAL_CLOSE_THRESHOLD) {
      onCloseRef.current()
    }
  }

  function handlePointerCancel() {
    pointerRef.current = null
    setTranslateY(0)
  }

  if (media.length === 0) return null
  const currentMedia = media[currentIndex] ?? media[0]
  const showNav = media.length > 1
  const canPrev = currentIndex > 0
  const canNext = currentIndex < media.length - 1
  const isDragging = pointerRef.current?.tracking === true

  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose() }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-foreground/90 backdrop-blur-sm" />
        <Dialog.Popup
          className={cn(
            'fixed z-50 flex items-center justify-center outline-none',
            'inset-0 h-[100dvh] w-[100dvw]',
            'md:inset-auto md:left-1/2 md:top-1/2 md:h-[90vh] md:w-[min(95vw,1400px)] md:max-h-[90vh] md:max-w-[min(95vw,1400px)] md:-translate-x-1/2 md:-translate-y-1/2'
          )}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
        >
          <div
            className="relative flex h-full w-full items-center justify-center"
            style={{
              transform: translateY > 0 ? `translateY(${translateY}px)` : undefined,
              transition: isDragging ? 'none' : 'transform 200ms ease',
            }}
            data-testid="lightbox-frame"
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Zapri"
              className="absolute right-3 top-3 z-10 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-background/10 text-background hover:bg-background/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-background"
              data-testid="lightbox-close"
            >
              <X className="size-6" />
            </button>

            {showNav && (
              <div
                role="status"
                aria-live="polite"
                className="absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full bg-background/10 px-3 py-1 text-sm text-background"
                data-testid="lightbox-indicator"
              >
                {currentIndex + 1} / {media.length}
              </div>
            )}

            {showNav && (
              <button
                type="button"
                onClick={goPrev}
                disabled={!canPrev}
                aria-label="Prejšnji medij"
                className={cn(
                  'absolute left-2 top-1/2 z-10 flex min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center rounded-full bg-background/10 text-background hover:bg-background/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-background',
                  !canPrev && 'pointer-events-none opacity-30'
                )}
                data-testid="lightbox-prev"
              >
                <ChevronLeft className="size-6" />
              </button>
            )}

            {showNav && (
              <button
                type="button"
                onClick={goNext}
                disabled={!canNext}
                aria-label="Naslednji medij"
                className={cn(
                  'absolute right-2 top-1/2 z-10 flex min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center rounded-full bg-background/10 text-background hover:bg-background/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-background',
                  !canNext && 'pointer-events-none opacity-30'
                )}
                data-testid="lightbox-next"
              >
                <ChevronRight className="size-6" />
              </button>
            )}

            <div
              className="flex h-full w-full items-center justify-center px-2 py-14 md:p-12"
              data-testid="lightbox-media-wrap"
            >
              {hasMediaError ? (
                <div
                  data-testid="lightbox-media-error"
                  role="img"
                  aria-label={currentMedia.alt ?? 'Napaka pri nalaganju'}
                  className="flex flex-col items-center gap-2 text-background/70"
                >
                  <ImageOff className="size-12" aria-hidden />
                  <span className="text-sm">Napaka pri nalaganju</span>
                </div>
              ) : currentMedia.media_type === 'video' ? (
                <video
                  key={currentMedia.id}
                  ref={videoRef}
                  src={currentMedia.url}
                  poster={currentMedia.thumbnail_url ?? undefined}
                  controls
                  autoPlay
                  playsInline
                  onError={() => setHasMediaError(true)}
                  className="max-h-full max-w-full object-contain"
                  aria-label={currentMedia.alt ?? 'Videoposnetek'}
                  data-testid="lightbox-video"
                >
                  <p>Vaš brskalnik ne podpira videa.</p>
                </video>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={currentMedia.id}
                  src={currentMedia.url}
                  alt={currentMedia.alt ?? 'Slika'}
                  onError={() => setHasMediaError(true)}
                  className="max-h-full max-w-full object-contain"
                  data-testid="lightbox-image"
                />
              )}
            </div>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
