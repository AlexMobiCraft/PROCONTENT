'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signUp } from '@/features/auth/api/auth'
import { RegisterForm } from './RegisterForm'

interface RegisterContainerProps {
  email: string
}

export function RegisterContainer({ email }: RegisterContainerProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleRegisterSubmit({ password }: { password: string }) {
    setIsLoading(true)
    setError(null)

    const { data, error: apiError } = await signUp({ email, password })

    if (apiError) {
      setIsLoading(false)
      setError(apiError.message || 'Napaka pri registraciji. Poskusite znova.')
      return
    }

    if (data?.user) {
      // После успешной регистрации в Supabase с подтверждением email, 
      // пользователь должен подтвердить почту, либо если подтверждение отключено — он залогинится сразу.
      // Но в стандартной настройке Supabase отправляет письмо.
      // Сообщим об этом.
      setError('Potrditveno sporočilo je bilo poslano na vašo e-pošto. Potrdite e-pošto za vstop v klub.')
      setIsLoading(false)
      // Можно было бы редиректнуть на страницу "Проверьте почту"
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
