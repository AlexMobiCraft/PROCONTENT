import { cn } from '@/lib/utils'
import { Heart, Lock, MessageCircle } from 'lucide-react'

export interface PreviewPostCardProps {
  category: string
  title: string
  excerpt: string
  date: string
  likes: number
  comments: number
  isLocked: boolean
  className?: string
}

export function PreviewPostCard({
  category,
  title,
  excerpt,
  date,
  likes,
  comments,
  isLocked,
  className,
}: PreviewPostCardProps) {
  return (
    <article
      className={cn(
        'rounded-2xl border border-border bg-card p-5 flex flex-col gap-3',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs uppercase tracking-[0.15em] text-primary">
          {category}
        </span>
        <span className="text-xs uppercase tracking-[0.1em] text-muted-foreground">
          {date}
        </span>
      </div>

      {/* Title */}
      <h3 className="font-serif text-base font-light leading-snug text-balance text-foreground uppercase tracking-wide">
        {title}
      </h3>

      {/* Excerpt */}
      <div className="relative overflow-hidden">
        <p
          className={cn(
            'text-xs leading-relaxed uppercase tracking-[0.08em] text-muted-foreground',
            isLocked ? 'line-clamp-1' : 'line-clamp-2'
          )}
        >
          {excerpt}
        </p>
        {isLocked && (
          <div className="absolute inset-0 bg-gradient-to-r from-transparent to-card" />
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-auto pt-1">
        <div className="flex items-center gap-4">
          <button
            className="flex items-center gap-1.5 min-h-[44px] min-w-[44px] text-xs uppercase tracking-[0.1em] text-muted-foreground"
            aria-label={`${likes} лайков`}
          >
            <Heart className="size-3.5" />
            <span>{likes}</span>
          </button>
          <button
            className="flex items-center gap-1.5 min-h-[44px] text-xs uppercase tracking-[0.1em] text-muted-foreground"
            aria-label={`${comments} комментариев`}
          >
            <MessageCircle className="size-3.5" />
            <span>{comments}</span>
          </button>
        </div>

        {isLocked && (
          <div className="flex items-center gap-1.5 text-primary">
            <Lock className="size-3.5" />
            <span className="text-xs uppercase tracking-[0.15em]">
              Для участниц
            </span>
          </div>
        )}
      </div>
    </article>
  )
}
