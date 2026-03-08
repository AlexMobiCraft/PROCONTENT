'use client'

import { cn } from '@/lib/utils'

const categories = [
  { id: 'all', label: 'Все' },
  { id: 'insight', label: '#insight' },
  { id: 'razobory', label: '#разборы' },
  { id: 'syomka', label: '#съёмка' },
  { id: 'reels', label: '#reels' },
  { id: 'brendy', label: '#бренды' },
  { id: 'tema', label: 'Тема месяца' },
]

interface CategoryScrollProps {
  activeCategory: string
  onCategoryChange: (id: string) => void
}

export function CategoryScroll({
  activeCategory,
  onCategoryChange,
}: CategoryScrollProps) {
  return (
    <nav aria-label="Фильтр по рубрикам">
      {/* Hide scrollbar but keep scroll functionality */}
      <div
        className="flex gap-2 overflow-x-auto py-2"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {categories.map((cat) => {
          const isActive = activeCategory === cat.id
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onCategoryChange(cat.id)}
              aria-pressed={isActive}
              className={cn(
                'inline-flex shrink-0 items-center rounded-full px-4 py-2 text-sm font-medium transition-colors min-h-[44px]',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
              )}
            >
              {cat.label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
