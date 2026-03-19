'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { useInView } from '@/hooks/useInView'

interface LazyMediaWrapperProps {
  src: string
  alt: string
  aspectRatio?: '16/9' | '4/5' | '1/1' | 'auto'
  className?: string
  priority?: boolean
  type?: 'photo' | 'video'
  /** Значение атрибута sizes для next/image — передаётся вызывающим компонентом
   *  в зависимости от реального места в сетке. По умолчанию — одноколоночная лента. */
  sizes?: string
}

export function LazyMediaWrapper({
  src,
  alt,
  aspectRatio = '16/9',
  className,
  priority = false,
  type = 'photo',
  sizes = '(max-width: 640px) 100vw, 600px',
}: LazyMediaWrapperProps) {
  const [isLoaded, setIsLoaded] = useState(false)
  // enabled=false когда priority=true: хук не подписывает элемент на observer.
  // ref присваивается только при !priority, чтобы не создавать ложный DOM-attachment.
  const { ref, isInView } = useInView(!priority)
  const showImage = priority || isInView

  const ratioClass = {
    '16/9': 'aspect-video',
    '4/5': 'aspect-[4/5]',
    '1/1': 'aspect-square',
    auto: 'aspect-auto',
  }[aspectRatio]

  return (
    <div
      ref={priority ? undefined : ref}
      className={cn(
        'relative overflow-hidden bg-muted transition-colors duration-500',
        ratioClass,
        !isLoaded && 'animate-pulse',
        className
      )}
    >
      {showImage && (
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
          sizes={sizes}
        />
      )}

      {/* Мягкий индикатор типа контента (опционально) */}
      {type === 'video' && isLoaded && (
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
