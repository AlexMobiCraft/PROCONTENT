'use client'

import { useMemo } from 'react'
import { LazyMediaWrapper } from '@/components/media/LazyMediaWrapper'
import { cn } from '@/lib/utils'
import type { PostMedia } from '@/features/feed/types'
import { sortByOrderIndex } from '@/features/feed/types'

export type GalleryLayout = 'grid-2' | 'grid-2x3' | 'grid-3x3' | 'grid-2x2-carousel'

export interface GalleryLayoutResult {
  layout: GalleryLayout
  mainCount: number
  carouselCount: number
}

export function getGridLayout(count: number): GalleryLayoutResult {
  if (count <= 4) return { layout: 'grid-2', mainCount: count, carouselCount: 0 }
  if (count === 5) return { layout: 'grid-2x3', mainCount: 5, carouselCount: 0 }
  if (count === 6) return { layout: 'grid-3x3', mainCount: 6, carouselCount: 0 }
  return { layout: 'grid-2x2-carousel', mainCount: 4, carouselCount: count - 4 }
}

export interface GalleryGridProps {
  media: PostMedia[]
  isLoading?: boolean
  onMediaClick?: (index: number) => void
  priority?: boolean
  /**
   * Когда false — элементы рендерятся как <div> (не интерактивны).
   * Используется в PostCard, где вся галерея обёрнута в <Link aria-hidden>.
   * По умолчанию true.
   */
  interactive?: boolean
  /** Базовый лейбл для изображений (i18n). По умолчанию: 'Slika'. */
  mediaLabel?: string
  /** Базовый лейбл для видео (i18n). По умолчанию: 'Videoposnetek'. */
  videoLabel?: string
}

export function GalleryGridSkeleton({ count }: { count: number }) {
  if (count === 0) return null
  const { layout, mainCount, carouselCount } = getGridLayout(count)
  const gridColsClass = layout === 'grid-3x3' ? 'grid-cols-3' : 'grid-cols-2'

  return (
    <div data-testid="gallery-grid-skeleton" aria-hidden>
      <div className={cn('grid gap-1', gridColsClass)}>
        {Array.from({ length: mainCount }).map((_, i) => {
          const isLastOdd = (count === 3 || count === 5) && i === count - 1
          return (
            <div
              key={i}
              className={cn(
                'animate-pulse rounded-sm bg-muted',
                isLastOdd ? 'aspect-video' : 'aspect-square',
                isLastOdd && 'col-span-2'
              )}
            />
          )
        })}
      </div>
      {carouselCount > 0 && (
        <div className="mt-1 flex gap-1 overflow-hidden" data-testid="gallery-skeleton-carousel">
          {Array.from({ length: carouselCount }).map((_, i) => (
            <div
              key={i}
              className="aspect-square w-32 flex-none animate-pulse rounded-sm bg-muted"
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function GalleryGrid({
  media,
  isLoading = false,
  onMediaClick,
  priority = false,
  interactive = true,
  mediaLabel = 'Slika',
  videoLabel = 'Videoposnetek',
}: GalleryGridProps) {
  const sorted = useMemo(() => sortByOrderIndex(media), [media])

  if (isLoading) {
    return <GalleryGridSkeleton count={media.length || 4} />
  }

  const { layout, mainCount, carouselCount } = getGridLayout(sorted.length)
  const mainItems = sorted.slice(0, mainCount)
  const carouselItems = carouselCount > 0 ? sorted.slice(mainCount) : []

  const gridColsClass = layout === 'grid-3x3' ? 'grid-cols-3' : 'grid-cols-2'
  const gridItemSizes =
    layout === 'grid-3x3'
      ? '(max-width: 768px) 33vw, 213px'
      : '(max-width: 768px) 50vw, 320px'

  return (
    <div data-testid="gallery-grid">
      <div className={cn('grid gap-1', gridColsClass)} data-layout={layout}>
        {mainItems.map((item, i) => {
          const isLastOdd = (sorted.length === 3 || sorted.length === 5) && i === sorted.length - 1
          const ariaLabel =
            item.media_type === 'video' ? `${videoLabel} ${i + 1}` : `${mediaLabel} ${i + 1}`
          // col-span-2 элементы занимают полную ширину → другой aspect и sizes
          const itemAspectRatio = isLastOdd ? ('16/9' as const) : ('1/1' as const)
          const itemSizes = isLastOdd ? '(max-width: 768px) 100vw, 640px' : gridItemSizes
          const itemClass = cn(
            'overflow-hidden rounded-sm',
            interactive &&
              'min-h-[44px] min-w-[44px] hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            isLastOdd && 'col-span-2'
          )

          if (interactive) {
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onMediaClick?.(i)}
                className={itemClass}
                aria-label={ariaLabel}
              >
                <LazyMediaWrapper
                  mediaItem={item}
                  alt={ariaLabel}
                  aspectRatio={itemAspectRatio}
                  priority={priority && i < 2}
                  sizes={itemSizes}
                />
              </button>
            )
          }

          return (
            <div key={item.id} className={itemClass}>
              <LazyMediaWrapper
                mediaItem={item}
                alt={ariaLabel}
                aspectRatio={itemAspectRatio}
                priority={priority && i < 2}
                sizes={itemSizes}
              />
            </div>
          )
        })}
      </div>

      {carouselItems.length > 0 && (
        <div
          className="mt-1 flex snap-x snap-mandatory gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          data-testid="gallery-carousel"
        >
          {carouselItems.map((item, i) => {
            const globalIndex = mainCount + i
            const ariaLabel =
              item.media_type === 'video'
                ? `${videoLabel} ${globalIndex + 1}`
                : `${mediaLabel} ${globalIndex + 1}`
            const itemClass = cn(
              'w-32 flex-none snap-start overflow-hidden rounded-sm',
              interactive &&
                'min-h-[44px] hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'
            )

            if (interactive) {
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onMediaClick?.(globalIndex)}
                  className={itemClass}
                  aria-label={ariaLabel}
                >
                  <LazyMediaWrapper
                    mediaItem={item}
                    alt={ariaLabel}
                    aspectRatio="1/1"
                    priority={false}
                    sizes="128px"
                  />
                </button>
              )
            }

            return (
              <div key={item.id} className={itemClass}>
                <LazyMediaWrapper
                  mediaItem={item}
                  alt={ariaLabel}
                  aspectRatio="1/1"
                  priority={false}
                  sizes="128px"
                />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
