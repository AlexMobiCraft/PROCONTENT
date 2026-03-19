'use client'

import { useEffect, useRef, useState } from 'react'

type InViewCallback = (entry: IntersectionObserverEntry) => void

const registry = new Map<Element, InViewCallback>()
let sharedObserver: IntersectionObserver | null = null

function getSharedObserver(): IntersectionObserver {
  if (!sharedObserver) {
    sharedObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          registry.get(entry.target)?.(entry)
        })
      },
      { rootMargin: '200px' }
    )
  }
  return sharedObserver
}

/** @internal — exported for testing only */
export function _resetSharedObserver(): void {
  if (sharedObserver) {
    sharedObserver.disconnect()
    sharedObserver = null
  }
  registry.clear()
}

export function useInView(enabled = true): {
  ref: React.RefObject<HTMLDivElement | null>
  isInView: boolean
} {
  const [isInView, setIsInView] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!enabled || !ref.current) return

    const el = ref.current
    const observer = getSharedObserver()

    registry.set(el, (entry) => {
      if (entry.isIntersecting) {
        setIsInView(true)
        registry.delete(el)
        observer.unobserve(el)
      }
    })

    observer.observe(el)

    return () => {
      registry.delete(el)
      observer.unobserve(el)
    }
  }, [enabled])

  return { ref, isInView }
}
