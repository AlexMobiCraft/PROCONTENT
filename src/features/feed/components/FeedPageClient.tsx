'use client'

import { useRef } from 'react'
import { CategoryScroll } from '@/components/feed/CategoryScroll'
import { FeedContainer } from '@/features/feed/components/FeedContainer'
import { useFeedStore } from '@/features/feed/store'
import type { FeedPage } from '../types'

// Синхронно гидратирует Zustand store серверными данными ДО первого рендера FeedContainer.
// Паттерн useRef гарантирует однократную инициализацию за жизнь компонента.
// Условие posts.length === 0 защищает кэшированные данные при навигации назад.
function FeedStoreInitializer({ posts, nextCursor, hasMore }: FeedPage) {
  const initialized = useRef(false)
  if (!initialized.current) {
    initialized.current = true
    if (useFeedStore.getState().posts.length === 0 && posts.length > 0) {
      useFeedStore.getState().setPosts(posts, nextCursor, hasMore)
      useFeedStore.getState().setLoading(false)
    }
  }
  return null
}

export function FeedPageClient({ initialData }: { initialData: FeedPage }) {
  const { activeCategory, changeCategory } = useFeedStore()

  return (
    <main className="flex min-h-screen flex-col pb-[60px]">
      {/* Синхронная гидрация store до рендера FeedContainer — priority-изображения
          попадают в первый render, браузер успевает preload, LCP не ломается */}
      <FeedStoreInitializer {...initialData} />

      <div className="sticky top-0 z-10 border-b border-border bg-background/95 px-4 backdrop-blur-sm">
        <CategoryScroll activeCategory={activeCategory} onCategoryChange={changeCategory} />
      </div>

      <FeedContainer />
    </main>
  )
}
