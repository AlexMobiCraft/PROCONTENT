'use client'

import Link from 'next/link'

interface ErrorPageProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function PostDetailError({ reset }: ErrorPageProps) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 text-center">
      <p className="text-sm text-muted-foreground">Prišlo je do napake pri nalaganju objave.</p>
      <div className="mt-6 flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={reset}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Poskusi znova
        </button>
        <Link
          href="/feed"
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Nazaj na objave
        </Link>
      </div>
    </div>
  )
}
