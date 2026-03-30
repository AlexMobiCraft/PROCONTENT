'use client'

import { CategoryScroll } from '@/components/feed/CategoryScroll'
import { FeedContainer } from '@/features/feed/components/FeedContainer'
import { TopicsPanel } from '@/features/feed/components/TopicsPanel'
import { useFeedStore } from '@/features/feed/store'
import type { FeedPage } from '../types'

// initialData пробрасывается напрямую в FeedContainer как проп —
// безопасный способ передачи серверных данных без мутации глобального Zustand store
// в render фазе (fix: SSR state leak + антипаттерн гидрации).
// FeedContainer гидратирует store в useEffect (только клиент).
// initialUserId передаётся для устранения badge pop-in при гидрации auth store.
export function FeedPageClient({
  initialData,
  initialUserId,
  initialUserRole,
}: {
  initialData: FeedPage
  initialUserId?: string | null
  initialUserRole?: string | null
}) {
  // Точечные селекторы — компонент перерисовывается только при изменении
  // activeCategory или changeCategory, а не при любом изменении store.
  const activeCategory = useFeedStore((s) => s.activeCategory)
  const changeCategory = useFeedStore((s) => s.changeCategory)

  return (
    <main className="flex min-h-screen flex-col pb-[60px] md:flex-row md:pb-0">
      {/* Центральная колонка: фильтры + лента */}
      <div className="flex min-w-0 flex-1 flex-col md:border-r md:border-border">
        <div className="sticky top-0 z-10 flex h-[var(--header-height)] shrink-0 items-center border-b border-border bg-background/95 px-4 backdrop-blur-sm">
          <CategoryScroll activeCategory={activeCategory} onCategoryChange={changeCategory} />
        </div>

        <FeedContainer
          initialData={initialData}
          initialUserId={initialUserId}
          initialUserRole={initialUserRole}
        />
      </div>

      {/* Правая панель тем (только desktop) */}
      <aside
        aria-label="Teme"
        className="hidden md:sticky md:top-0 md:flex md:h-screen md:w-[350px] md:shrink-0 md:flex-col md:overflow-y-auto md:border-l md:border-border"
      >
        <TopicsPanel />
      </aside>
    </main>
  )
}
