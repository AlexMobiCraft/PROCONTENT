'use client'

export function EditPostSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-label="Nalaganje...">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex flex-col gap-1.5">
          <div className="h-4 w-24 animate-pulse rounded bg-muted" />
          <div className="h-[44px] w-full animate-pulse rounded border bg-muted" />
        </div>
      ))}
      <div className="h-[44px] w-32 animate-pulse rounded bg-muted" />
    </div>
  )
}
