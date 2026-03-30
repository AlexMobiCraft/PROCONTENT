'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { useInView } from '@/hooks/useInView'

/** Минимальный интерфейс медиафайла — совместим с таблицей post_media из БД */
export interface MediaItem {
  /** ID медиафайла из post_media.id — используется как videoId в VideoPlayerContainer */
  id?: string
  url: string
  media_type: 'image' | 'video'
  thumbnail_url?: string | null
}

interface LazyMediaWrapperProps {
  /** URL медиафайла. Не обязателен если передан mediaItem. */
  src?: string
  alt: string
  /**
   * Объект post_media из БД (AC 6).
   * Если передан — src и type выводятся из него.
   * Для видео используется thumbnail_url как постер (AC 7).
   */
  mediaItem?: MediaItem
  /**
   * Пропорции контейнера. 'none' — не форсировать (AC 8, для GalleryGrid и гибких сеток).
   * По умолчанию — '16/9'.
   */
  aspectRatio?: '16/9' | '4/5' | '1/1' | '9/16' | 'none'
  className?: string
  priority?: boolean
  type?: 'photo' | 'video'
  /** Значение атрибута sizes для next/image — передаётся вызывающим компонентом
   *  в зависимости от реального места в сетке. По умолчанию — одноколоночная лента:
   *  100vw на мобильном, фиксированные 640px на более широких экранах. */
  sizes?: string
}

/**
 * Вычисляет отображаемый src из mediaItem или src prop.
 * Для видео используется thumbnail_url как постер (AC 7).
 */
function resolveMediaSrc(props: LazyMediaWrapperProps): string {
  if (props.mediaItem) {
    return props.mediaItem.media_type === 'video'
      ? (props.mediaItem.thumbnail_url ?? '')
      : props.mediaItem.url
  }
  return props.src ?? ''
}

/**
 * key основан на effectiveSrc — гарантирует remount LazyMediaWrapperContent
 * при смене медиафайла (сброс isInView, isLoaded, isError).
 */
export function LazyMediaWrapper(props: LazyMediaWrapperProps) {
  const effectiveSrc = resolveMediaSrc(props)
  return <LazyMediaWrapperContent key={effectiveSrc} {...props} />
}

function LazyMediaWrapperContent({
  src: srcProp,
  alt,
  mediaItem,
  aspectRatio = '16/9',
  className,
  priority = false,
  type: typeProp = 'photo',
  sizes = '(max-width: 768px) 100vw, 640px',
}: LazyMediaWrapperProps) {
  // Если передан mediaItem — выводим src и type из него (AC 6, 7)
  const src = mediaItem
    ? mediaItem.media_type === 'video'
      ? (mediaItem.thumbnail_url ?? '')
      : mediaItem.url
    : (srcProp ?? '')
  const type = mediaItem
    ? mediaItem.media_type === 'video'
      ? 'video'
      : 'photo'
    : typeProp
  // key по effectiveSrc гарантирует remount при смене медиафайла —
  // оба состояния сбрасываются автоматически без дополнительной логики.
  // Если src пустой — немедленно показываем fallback (AC: защита от краша Next/Image).
  const [isLoaded, setIsLoaded] = useState(false)
  const [isError, setIsError] = useState(src === '')
  // enabled=false когда priority=true: хук не подписывает элемент на observer.
  // ref присваивается только при !priority, чтобы не создавать ложный DOM-attachment.
  const { ref, isInView } = useInView(!priority)
  const showImage = priority || isInView

  // 'none' или undefined — не применяем aspect класс (AC 8: гибкая сетка)
  const ratioClass =
    aspectRatio && aspectRatio !== 'none'
      ? ({
          '16/9': 'aspect-video',
          '4/5': 'aspect-[4/5]',
          '1/1': 'aspect-square',
          '9/16': 'aspect-[9/16]',
        } as const)[aspectRatio]
      : undefined

  return (
    <div
      ref={priority ? undefined : ref}
      className={cn(
        'relative overflow-hidden bg-muted transition-colors duration-500',
        ratioClass,
        !isLoaded && !isError && 'animate-pulse',
        className
      )}
    >
      {showImage && !isError && (
        <Image
          src={src}
          alt={alt}
          fill
          priority={priority}
          className={cn(
            'object-cover',
            !priority && 'transition-opacity duration-700 ease-in-out',
            !priority && (isLoaded ? 'opacity-100' : 'opacity-0')
          )}
          onLoad={() => setIsLoaded(true)}
          onError={() => setIsError(true)}
          sizes={sizes}
        />
      )}

      {isError && (
        <div
          data-testid="media-error-fallback"
          role="img"
          aria-label={alt}
          className="absolute inset-0 flex items-center justify-center text-muted-foreground/40"
        >
          <svg
            aria-hidden="true"
            className="size-8"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
            />
          </svg>
        </div>
      )}

      {/* Мягкий индикатор типа контента (опционально) */}
      {type === 'video' && (isLoaded || isError) && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/10 pointer-events-none">
          <div className="size-12 rounded-full bg-white/30 backdrop-blur-sm flex items-center justify-center text-white border border-white/20">
            <svg className="size-6 ml-1" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      )}
    </div>
  )
}
