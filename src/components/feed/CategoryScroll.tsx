'use client'

import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'

const categories = [
  { id: 'all', label: 'VSE' },
  { id: 'tema', label: 'Tema meseca' },
  { id: 'zacetek', label: 'Začetek' },
]

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

const FilterIcon = () => (
  <svg
    className="size-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.5}
    aria-hidden
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 4.5h14.25M3 9h9.75M3 13.5h5.25m5.25-.75L17.25 9m0 0L21 12.75M17.25 9v12"
    />
  </svg>
)

interface CategoryScrollProps {
  activeCategory: string
  onCategoryChange: (id: string) => void
}

export function CategoryScroll({
  activeCategory,
  onCategoryChange,
}: CategoryScrollProps) {
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Закрываем дропдаун при клике вне
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const isTopicActive = topics.some((t) => t.id === activeCategory)

  return (
    <nav aria-label="Filter po rubrikah" className="flex w-full items-center gap-2">
      {/* Категории */}
      <div
        className="flex min-w-0 flex-1 gap-2 overflow-x-auto items-center h-full"
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

      {/* Кнопка фильтра (только mobile) */}
      <div ref={dropdownRef} className="relative shrink-0 md:hidden">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="Odpri filter tem"
          aria-expanded={open}
          className={cn(
            'flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg transition-colors',
            isTopicActive
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          )}
        >
          <FilterIcon />
        </button>

        {open && (
          <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-xl border border-border bg-background shadow-lg">
            <ul role="menu" className="flex flex-col p-1">
              {topics.map((topic) => {
                const isActive = activeCategory === topic.id
                return (
                  <li key={topic.id} role="none">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        onCategoryChange(topic.id)
                        setOpen(false)
                      }}
                      className={cn(
                        'flex min-h-[44px] w-full items-center rounded-lg px-4 text-left text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'text-foreground hover:bg-muted'
                      )}
                    >
                      {topic.label}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>
    </nav>
  )
}
