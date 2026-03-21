'use client'

import { useState, useCallback } from 'react'
import { CategoryScroll } from '@/components/feed/CategoryScroll'
import { FeedContainer } from '@/features/feed/components/FeedContainer'
import { PostCommentsPanel } from '@/features/feed/components/PostCommentsPanel'
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
}: {
  initialData: FeedPage
  initialUserId?: string | null
}) {
  // Точечные селекторы — компонент перерисовывается только при изменении
  // activeCategory или changeCategory, а не при любом изменении store.
  const activeCategory = useFeedStore((s) => s.activeCategory)
  const changeCategory = useFeedStore((s) => s.changeCategory)

  // Состояние выбранного поста для правой панели комментариев (desktop only).
  // Клик на тот же пост — закрывает панель (toggle).
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null)

  const handleCommentClick = useCallback((postId: string) => {
    setSelectedPostId((prev) => (prev === postId ? null : postId))
  }, [])

  return (
    <main className="flex min-h-screen flex-col pb-[60px] md:flex-row md:pb-0">
      {/* Центральная колонка: фильтры + лента */}
      <div className="flex min-w-0 flex-1 flex-col md:border-r md:border-border">
        <div className="sticky top-0 z-10 border-b border-border bg-background/95 px-4 backdrop-blur-sm">
          <CategoryScroll activeCategory={activeCategory} onCategoryChange={changeCategory} />
        </div>

        <FeedContainer
          initialData={initialData}
          initialUserId={initialUserId}
          onCommentClick={handleCommentClick}
        />
      </div>

      {/* Правая панель комментариев (только desktop) */}
      <aside
        aria-label="Komentarji objave"
        className="hidden md:sticky md:top-0 md:flex md:h-screen md:w-[350px] md:flex-col md:overflow-y-auto"
      >
        <PostCommentsPanel
          selectedPostId={selectedPostId}
          onClose={() => setSelectedPostId(null)}
        />
      </aside>
    </main>
  )
}
