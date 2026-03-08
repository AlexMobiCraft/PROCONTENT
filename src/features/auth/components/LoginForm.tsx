'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface LoginFormProps {
  onSubmit: (email: string) => void
  isLoading: boolean
  error: string | null
}

export function LoginForm({ onSubmit, isLoading, error }: LoginFormProps) {
  const [validationError, setValidationError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const emailInput = form.elements.namedItem('email') as HTMLInputElement

    if (emailInput.validity.valueMissing) {
      setValidationError('Введите email')
      return
    }
    if (emailInput.validity.typeMismatch) {
      setValidationError('Введите корректный email')
      return
    }

    setValidationError(null)
    onSubmit(emailInput.value)
  }

  const displayError = validationError ?? error

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-foreground text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          placeholder="your@email.com"
          disabled={isLoading}
          aria-describedby={displayError ? 'email-error' : undefined}
          aria-invalid={!!displayError}
          onChange={() => setValidationError(null)}
          className={cn(
            'border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-ring/50 focus:border-ring min-h-[44px] rounded-lg border px-3 py-2 text-sm transition-colors focus:ring-2 focus:outline-none disabled:opacity-50',
            displayError &&
              'border-destructive focus:ring-destructive/20 focus:border-destructive'
          )}
        />
        {displayError && (
          <p id="email-error" role="alert" className="text-destructive text-sm">
            {displayError}
          </p>
        )}
      </div>

      <Button type="submit" disabled={isLoading} className="w-full">
        {isLoading ? 'Отправляем...' : 'Получить код'}
      </Button>

      <p className="text-muted-foreground text-center text-xs">
        Мы отправим ссылку на ваш email
      </p>
    </form>
  )
}
