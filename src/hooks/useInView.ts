'use client'

import { useEffect, useRef, useState } from 'react'

type InViewCallback = (entry: IntersectionObserverEntry) => void

// WeakMap позволяет GC собирать элементы после анмаунта без явного удаления,
// устраняя риск утечки памяти при разрыве между unobserve и GC.
const registry = new WeakMap<Element, InViewCallback>()
let registrySize = 0
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
  // WeakMap не поддерживает .clear(); сбрасываем счётчик — достаточно для тестов,
  // так как между тестами все элементы анмаунтятся и GC'ятся.
  registrySize = 0
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
        // Проверяем registry.has перед удалением — защита от двойного декремента
        // в случае если cleanup вызывается раньше callback
        if (registry.has(el)) {
          registry.delete(el)
          registrySize--
        }
        observer.unobserve(el)
        // Освобождаем обсервер если больше нет наблюдателей
        if (registrySize === 0 && sharedObserver) {
          sharedObserver.disconnect()
          sharedObserver = null
        }
      }
    })
    registrySize++

    observer.observe(el)

    return () => {
      // Проверяем наличие перед удалением — если callback уже удалил el,
      // не уменьшаем счётчик повторно
      if (registry.has(el)) {
        registry.delete(el)
        registrySize--
      }
      // Защита от обращения к уже уничтоженному инстансу:
      // если callback уже вызвал disconnect (sharedObserver=null или заменён),
      // вызывать unobserve на старом инстансе небезопасно.
      if (sharedObserver === observer) {
        observer.unobserve(el)
      }
      if (registrySize === 0 && sharedObserver) {
        sharedObserver.disconnect()
        sharedObserver = null
      }
    }
  }, [enabled])

  return { ref, isInView }
}
