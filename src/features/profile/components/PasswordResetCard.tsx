'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

interface PasswordResetCardProps {
  email: string
}

export function PasswordResetCard({ email }: PasswordResetCardProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleReset() {
    setIsLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const { error: supabaseError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/update-password`,
      })
      if (supabaseError) {
        setError('Napaka pri pošiljanju e-pošte')
      } else {
        setSent(true)
      }
    } catch {
      setError('Napaka povezave')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="border-border space-y-4 border p-6">
      <div>
        <p className="text-muted-foreground mb-1 text-xs uppercase tracking-[0.15em]">
          Geslo
        </p>
        <p className="font-medium text-muted-foreground">
          {sent ? 'E-pošta za ponastavitev je bila poslana' : 'Ponastavite svoje geslo'}
        </p>
      </div>

      {!sent && (
        <div className="space-y-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={isLoading}
            aria-busy={isLoading}
          >
            {isLoading ? 'Pošiljanje…' : 'Ponastavi geslo'}
          </Button>
          {error && (
            <p className="text-destructive text-xs" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
