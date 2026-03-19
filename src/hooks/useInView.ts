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

/**
 * Подписывает элемент на shared IntersectionObserver и возвращает `isInView`.
 *
 * @param enabled — управляет подпиской реактивно: при смене `false→true` элемент
 *   начинает наблюдаться; при `true→false` — немедленно отписывается через
 *   cleanup useEffect. Когда `enabled=false`, `ref` не наблюдается, но может
 *   быть присвоен DOM-узлу — это безопасно и неопасно для производительности.
 */
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
        // Освобождаем обсервер если больше нет наблюдателей
        if (registry.size === 0 && sharedObserver) {
          sharedObserver.disconnect()
          sharedObserver = null
        }
      }
    })

    observer.observe(el)

    return () => {
      registry.delete(el)
      observer.unobserve(el)
      // Освобождаем ресурсы когда все подписчики отписались
      if (registry.size === 0 && sharedObserver) {
        sharedObserver.disconnect()
        sharedObserver = null
      }
    }
  }, [enabled])

  return { ref, isInView }
}
