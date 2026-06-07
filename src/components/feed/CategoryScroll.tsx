'use client'

import { cn } from '@/lib/utils'
import { useFeedStore } from '@/features/feed/store'
import { Skeleton } from '@/components/ui/skeleton'

interface CategoryScrollProps {
  activeCategory: string
  onCategoryChange: (id: string) => void
}

export function CategoryScroll({
  activeCategory,
  onCategoryChange,
}: CategoryScrollProps) {
  // Получаем динамические категории из стора
  const dbCategories = useFeedStore((s) => s.categories)
  const isCategoriesLoading = useFeedStore((s) => s.isCategoriesLoading)

  // Исключаем конфликтный слаг 'all'
  const filteredDB = dbCategories.filter((c) => c.slug !== 'all')

  return (
    <nav aria-label="Filter po rubrikah" className="flex w-full items-center gap-2">
      {/* Фиксированная кнопка VSE */}
      <button
        type="button"
        onClick={() => onCategoryChange('all')}
        aria-pressed={activeCategory === 'all'}
        className={cn(
          'inline-flex shrink-0 items-center rounded-full px-4 py-2 text-sm font-medium transition-colors min-h-[44px]',
          activeCategory === 'all'
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
        )}
      >
        VSE
      </button>

      {/* Скроллируемые категории из БД */}
      <div
        className="flex min-w-0 flex-1 gap-2 overflow-x-auto items-center h-full"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {isCategoriesLoading ? (
          <>
            <Skeleton className="h-9 w-24 shrink-0 rounded-full" />
            <Skeleton className="h-9 w-20 shrink-0 rounded-full" />
            <Skeleton className="h-9 w-28 shrink-0 rounded-full" />
          </>
        ) : (
          filteredDB.map((cat) => {
            const isActive = activeCategory === cat.slug
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => onCategoryChange(cat.slug)}
                aria-pressed={isActive}
                className={cn(
                  'inline-flex shrink-0 items-center rounded-full px-4 py-2 text-sm font-medium transition-colors min-h-[44px]',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                )}
              >
                {cat.name}
              </button>
            )
          })
        )}
      </div>
    </nav>
  )
}
