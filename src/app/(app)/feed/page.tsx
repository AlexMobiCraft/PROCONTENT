'use client'

import { CategoryScroll } from '@/components/feed/CategoryScroll'
import { FeedContainer } from '@/features/feed/components/FeedContainer'
import { useFeedStore } from '@/features/feed/store'

export default function FeedPage() {
  const { activeCategory, changeCategory } = useFeedStore()

  function handleCategoryChange(id: string) {
    // Атомарная смена: сброс данных + установка категории за одну операцию (AC #6)
    // Фильтрация — только UI-состояние в этой story (серверная — в 2.4)
    changeCategory(id)
  }

  return (
    <main className="flex min-h-screen flex-col pb-[60px]">
      {/* Sticky CategoryScroll (AC #1, #2) */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 px-4 backdrop-blur-sm">
        <CategoryScroll
          activeCategory={activeCategory}
          onCategoryChange={handleCategoryChange}
        />
      </div>

      {/* Feed content */}
      <FeedContainer />
    </main>
  )
}
