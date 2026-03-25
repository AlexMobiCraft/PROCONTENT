'use client'

import { useEffect, useState } from 'react'

/**
 * Возвращает debounce-версию значения — обновляется после указанной задержки.
 * Используется в SearchContainer для предотвращения лишних запросов к Supabase.
 */
export function useDebounce<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = useState<T>(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debounced
}
