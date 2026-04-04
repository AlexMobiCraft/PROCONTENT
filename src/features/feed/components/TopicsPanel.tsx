'use client'

import { cn } from '@/lib/utils'
import { useFeedStore } from '@/features/feed/store'

export function TopicsPanel() {
  const activeCategory = useFeedStore((s) => s.activeCategory)
  const changeCategory = useFeedStore((s) => s.changeCategory)
  const categories = useFeedStore((s) => s.categories)

  return (
    <div className="flex flex-col">
      <div className="flex h-[var(--header-height)] shrink-0 items-center border-b border-border px-4">
        <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.2em] text-foreground">
          Teme
        </h2>
      </div>
      <nav aria-label="Filter po temah" className="flex flex-col gap-1 p-3">
        {categories.map((topic) => {
          const isActive = activeCategory === topic.slug
          return (
            <button
              key={topic.id}
              type="button"
              onClick={() => changeCategory(topic.slug)}
              aria-pressed={isActive}
              className={cn(
                'flex min-h-[44px] w-full items-center rounded-lg px-4 text-left text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              {topic.name}
            </button>
          )
        })}
        {categories.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground italic">
            Никто еще не создал тем
          </div>
        )}
      </nav>
    </div>
  )
}
