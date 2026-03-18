'use client'

import { CategoryScroll } from '@/components/feed/CategoryScroll'
import { FeedContainer } from '@/features/feed/components/FeedContainer'
import { useFeedStore } from '@/features/feed/store'

export default function FeedPage() {
  const { activeCategory, setActiveCategory, reset } = useFeedStore()

  function handleCategoryChange(id: string) {
    // Фильтрация по категориям — только UI-состояние в этой story (серверная — в 2.4)
    setActiveCategory(id)
    // Сбрасываем store при смене категории чтобы перезагрузить данные
    reset()
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
