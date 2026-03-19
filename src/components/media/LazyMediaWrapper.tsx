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
}

export function LazyMediaWrapper({
  src,
  alt,
  aspectRatio = '16/9',
  className,
  priority = false,
  type = 'photo',
}: LazyMediaWrapperProps) {
  const [isLoaded, setIsLoaded] = useState(false)
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
      ref={ref}
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
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
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
