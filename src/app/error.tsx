'use client' // Error boundaries must be Client Components

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error)
  }, [error])

  return (
    <div className="bg-background flex h-screen flex-col items-center justify-center px-4 text-center">
      <h2 className="text-foreground text-2xl font-bold">
        Nekaj je šlo narobe!
      </h2>
      <p className="text-muted-foreground mt-2">
        O napaki vemo in jo odpravljamo.
      </p>
      <button
        className="bg-primary text-primary-foreground group-hover:bg-primary/80 mt-6 inline-flex h-11 items-center justify-center rounded-lg px-8 text-sm font-medium transition-colors"
        onClick={
          // Attempt to recover by trying to re-render the segment
          () => reset()
        }
      >
        Poskusi znova
      </button>
    </div>
  )
}
