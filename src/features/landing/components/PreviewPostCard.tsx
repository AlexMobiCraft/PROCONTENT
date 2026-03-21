import { Heart, MessageCircle, Lock } from 'lucide-react'

export interface PreviewPostCardProps {
  category: string
  title: string
  excerpt: string
  date: string
  likes: number
  comments: number
  isLocked: boolean
}

export function PreviewPostCard({
  category,
  title,
  excerpt,
  date,
  likes,
  comments,
  isLocked,
}: PreviewPostCardProps) {
  return (
    <article className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-col gap-3">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">
            {category}
          </span>
          <span className="text-xs text-muted-foreground">{date}</span>
        </div>

        {/* Content */}
        <div className="flex flex-col gap-1.5">
          <h3 className="font-serif text-foreground text-base font-light leading-snug text-balance uppercase tracking-wide">
            {title}
          </h3>
          {isLocked ? (
            <div className="relative overflow-hidden">
              <p className="line-clamp-1 text-xs tracking-[0.05em] uppercase leading-relaxed text-muted-foreground">
                {excerpt}
              </p>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent to-card" />
            </div>
          ) : (
            <p className="line-clamp-2 text-xs tracking-[0.05em] uppercase leading-relaxed text-muted-foreground">
              {excerpt}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 pt-1">
          <button
            type="button"
            className="flex min-h-[44px] min-w-[44px] items-center gap-1.5 text-muted-foreground"
            aria-label={`${likes} všečkov`}
          >
            <Heart className="size-4" aria-hidden />
            <span className="text-xs">{likes}</span>
          </button>
          <button
            type="button"
            className="flex min-h-[44px] min-w-[44px] items-center gap-1.5 text-muted-foreground"
            aria-label={`${comments} komentarjev`}
          >
            <MessageCircle className="size-4" aria-hidden />
            <span className="text-xs">{comments}</span>
          </button>
          {isLocked && (
            <div className="ml-auto flex items-center gap-1 text-primary">
              <Lock className="size-3.5" aria-hidden />
              <span className="text-xs font-medium tracking-[0.1em] uppercase">
                Za članice
              </span>
            </div>
          )}
        </div>
      </div>
    </article>
  )
}
