'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { useInView } from '@/hooks/useInView'

interface LazyMediaWrapperProps {
  src: string
  alt: string
  aspectRatio?: '16/9' | '4/5' | '1/1'
  className?: string
  priority?: boolean
  type?: 'photo' | 'video'
  /** Значение атрибута sizes для next/image — передаётся вызывающим компонентом
   *  в зависимости от реального места в сетке. По умолчанию — адаптивная сетка
   *  (одноколоночная на mobile, двухколоночная на планшете, трёхколоночная на desktop). */
  sizes?: string
}

/**
 * Форсированный сброс isInView при смене src достигается через key={props.src}
 * на внутреннем компоненте — React remount-ит LazyMediaWrapperContent
 * при смене key, сбрасывая все hooks-состояния, включая isInView из useInView.
 * Это предотвращает eager-загрузку нового изображения, когда компонент
 * переиспользуется с новым src (например, при редактировании поста).
 */
export function LazyMediaWrapper(props: LazyMediaWrapperProps) {
  return <LazyMediaWrapperContent key={props.src} {...props} />
}

function LazyMediaWrapperContent({
  src,
  alt,
  aspectRatio = '16/9',
  className,
  priority = false,
  type = 'photo',
  sizes = '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw',
}: LazyMediaWrapperProps) {
  // loadState привязан к src: при смене src isLoaded/isError автоматически false.
  // Паттерн "derived state from props" — без useEffect, без лишнего рендера.
  const [loadState, setLoadState] = useState<{ src: string; loaded: boolean; error: boolean }>({
    src,
    loaded: false,
    error: false,
  })

  const isLoaded = loadState.loaded && loadState.src === src
  const isError = loadState.error && loadState.src === src
  // enabled=false когда priority=true: хук не подписывает элемент на observer.
  // ref присваивается только при !priority, чтобы не создавать ложный DOM-attachment.
  const { ref, isInView } = useInView(!priority)
  const showImage = priority || isInView

  const ratioClass = {
    '16/9': 'aspect-video',
    '4/5': 'aspect-[4/5]',
    '1/1': 'aspect-square',
  }[aspectRatio]

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
          onLoad={() => setLoadState({ src, loaded: true, error: false })}
          onError={() => setLoadState({ src, loaded: false, error: true })}
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
