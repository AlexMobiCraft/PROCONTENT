import { PostCardSkeleton } from '@/components/feed/PostCard'

export default function SearchLoading() {
  return (
    <div role="status" aria-label="Nalaganje iskanja">
      {/* Input skeleton */}
      <div className="border-b border-border px-4 py-3">
        <div className="h-11 w-full rounded-xl bg-muted animate-pulse" />
      </div>
      {/* Cards skeleton */}
      {Array.from({ length: 4 }).map((_, i) => (
        <PostCardSkeleton key={i} showMedia={i % 2 === 0} />
      ))}
    </div>
  )
}
