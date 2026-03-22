export default function PostLoading() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-6" aria-busy="true" aria-label="Nalaganje objave">
      {/* Back button skeleton */}
      <div className="mb-6 h-9 w-20 rounded-lg bg-muted animate-pulse" />

      {/* Header skeleton */}
      <div className="mb-6 flex items-center gap-3">
        <div className="size-10 rounded-full bg-muted animate-pulse" />
        <div className="flex flex-col gap-1.5 flex-1">
          <div className="h-4 w-32 rounded-full bg-muted animate-pulse" />
          <div className="h-3 w-20 rounded-full bg-muted animate-pulse" />
        </div>
      </div>

      {/* Title skeleton */}
      <div className="mb-4 flex flex-col gap-2">
        <div className="h-7 w-3/4 rounded-full bg-muted animate-pulse" />
        <div className="h-7 w-1/2 rounded-full bg-muted animate-pulse" />
      </div>

      {/* Media skeleton */}
      <div className="mb-6 aspect-[4/5] w-full rounded-xl bg-muted animate-pulse" />

      {/* Content skeleton */}
      <div className="flex flex-col gap-3">
        <div className="h-4 w-full rounded-full bg-muted animate-pulse" />
        <div className="h-4 w-full rounded-full bg-muted animate-pulse" />
        <div className="h-4 w-5/6 rounded-full bg-muted animate-pulse" />
        <div className="h-4 w-4/5 rounded-full bg-muted animate-pulse" />
        <div className="h-4 w-full rounded-full bg-muted animate-pulse" />
      </div>
    </div>
  )
}
