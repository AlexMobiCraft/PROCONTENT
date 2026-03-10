'use client'

import { useState } from 'react'

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
        <label
          htmlFor="email"
          className="sr-only"
        >
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
            'border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-primary/20 min-h-[44px] rounded-lg border px-4 py-3 text-sm font-sans transition-colors focus:ring-2 focus:outline-none disabled:opacity-50',
            displayError && 'border-destructive focus:ring-destructive/20'
          )}
        />
        {displayError && (
          <p
            id="email-error"
            role="alert"
            className="font-sans text-destructive text-xs uppercase tracking-[0.08em]"
          >
            {displayError}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="border border-primary font-sans text-xs font-medium tracking-[0.2em] uppercase text-foreground px-8 py-3 min-h-[44px] flex items-center justify-center hover:bg-primary/10 transition-colors disabled:opacity-50 disabled:pointer-events-none w-full"
      >
        {isLoading ? 'Отправляем...' : 'Получить код'}
      </button>
    </form>
  )
}
