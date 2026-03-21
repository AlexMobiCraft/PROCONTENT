'use client'

import { cn } from '@/lib/utils'
import { useFeedStore } from '@/features/feed/store'

const topics = [
  { id: 'stories', label: 'Stories' },
  { id: 'estetski-kadri', label: 'Estetski kadri in feed' },
  { id: 'snemanje', label: 'Snemanje videov' },
  { id: 'izrezi', label: 'Izrezi (framingi)' },
  { id: 'komercialni', label: 'Komercialni profili' },
  { id: 'ugc', label: 'UGC' },
  { id: 'objavljanje', label: 'Objavljanje in reels' },
  { id: 'drugo', label: 'Drugo' },
]

export function TopicsPanel() {
  const activeCategory = useFeedStore((s) => s.activeCategory)
  const changeCategory = useFeedStore((s) => s.changeCategory)

  return (
    <div className="flex flex-col">
      <div className="flex h-[var(--header-height)] shrink-0 items-center border-b border-border px-4">
        <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.2em] text-foreground">
          Teme
        </h2>
      </div>
      <nav aria-label="Filter po temah" className="flex flex-col gap-1 p-3">
        {topics.map((topic) => {
          const isActive = activeCategory === topic.id
          return (
            <button
              key={topic.id}
              type="button"
              onClick={() => changeCategory(topic.id)}
              aria-pressed={isActive}
              className={cn(
                'flex min-h-[44px] w-full items-center rounded-lg px-4 text-left text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              {topic.label}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
