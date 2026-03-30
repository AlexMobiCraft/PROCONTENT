'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { signUp } from '@/features/auth/api/auth'
import { RegisterForm } from './RegisterForm'

interface RegisterContainerProps {
  email: string
}

export function RegisterContainer({ email }: RegisterContainerProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // eslint-disable-next-line camelcase
  async function handleRegisterSubmit({
    password,
    first_name,
    last_name,
  }: {
    password: string
    first_name: string
    last_name: string
  }) {
    setIsLoading(true)
    setError(null)

    const { data, error: apiError } = await signUp({ email, password })

    if (apiError) {
      setIsLoading(false)
      setError(apiError.message || 'Napaka pri registraciji. Poskusite znova.')
      return
    }

    if (data?.user) {
      // Обновить профиль с first_name и last_name
      const supabase = createClient()
      const { error: updateError } = await supabase
        .from('profiles')
        // eslint-disable-next-line camelcase
        .update({ first_name, last_name: last_name || null })
        .eq('id', data.user.id)

      if (updateError) {
        console.warn('Napaka pri posodobitvi profila:', updateError)
      }

      setError('Potrditveno sporočilo je bilo poslano na vašo e-pošto. Potrdite e-pošto za vstop v klub.')
      setIsLoading(false)
    } else {
      router.push('/feed')
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-foreground text-2xl font-semibold">
          Registracija
        </h1>
        <p className="text-muted-foreground text-sm">
          Ustvarite geslo za dostop do gradiv
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className={cn(
            "rounded-lg border px-4 py-3 text-sm",
            error.includes('Potrditveno')
              ? "border-primary/20 bg-primary/10 text-primary"
              : "border-destructive/20 bg-destructive/10 text-destructive"
          )}
        >
          {error}
        </div>
      )}

      <RegisterForm
        email={email}
        onSubmit={handleRegisterSubmit}
        isLoading={isLoading}
        error={null}
      />
    </div>
  )
}

// Helper to use cn in the component above (didn't import it)
import { cn } from '@/lib/utils'
