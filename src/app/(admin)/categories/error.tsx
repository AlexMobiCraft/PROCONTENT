'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function CategoriesError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Napaka na strani kategorij:', error)
  }, [error])

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-4 font-heading text-2xl font-semibold">Napaka pri nalaganju kategorij</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {error.message || 'Prišlo je do nepričakovane napake. Poskusite znova.'}
      </p>
      <Button onClick={reset}>Ponovi</Button>
    </main>
  )
}
