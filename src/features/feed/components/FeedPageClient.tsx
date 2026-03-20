'use client'

import { CategoryScroll } from '@/components/feed/CategoryScroll'
import { FeedContainer } from '@/features/feed/components/FeedContainer'
import { useFeedStore } from '@/features/feed/store'
import type { FeedPage } from '../types'

// initialData пробрасывается напрямую в FeedContainer как проп —
// безопасный способ передачи серверных данных без мутации глобального Zustand store
// в render фазе (fix: SSR state leak + антипаттерн гидрации).
// FeedContainer гидратирует store в useEffect (только клиент).
export function FeedPageClient({ initialData }: { initialData: FeedPage }) {
  // Точечные селекторы — компонент перерисовывается только при изменении
  // activeCategory или changeCategory, а не при любом изменении store.
  const activeCategory = useFeedStore((s) => s.activeCategory)
  const changeCategory = useFeedStore((s) => s.changeCategory)

  return (
    <main className="flex min-h-screen flex-col pb-[60px]">
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 px-4 backdrop-blur-sm">
        <CategoryScroll activeCategory={activeCategory} onCategoryChange={changeCategory} />
      </div>

      <FeedContainer initialData={initialData} />
    </main>
  )
}
