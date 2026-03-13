'use client'

export function OnboardingScreenSkeleton() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-xl px-5 py-16">
        {/* Приветственный блок */}
        <div className="mb-16 space-y-4">
          <div className="h-14 w-3/4 animate-pulse rounded bg-muted" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
        </div>

        {/* WhatsApp CTA */}
        <div className="mb-16">
          <div className="h-12 w-64 animate-pulse rounded bg-muted" />
        </div>

        {/* Топ-5 постов */}
        <div className="space-y-4">
          <div className="mb-6 h-7 w-32 animate-pulse rounded bg-muted" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 w-full animate-pulse rounded bg-muted" />
          ))}
        </div>

        {/* Feed CTA */}
        <div className="mt-16">
          <div className="h-12 w-48 animate-pulse rounded bg-muted" />
        </div>
      </div>
    </main>
  )
}
