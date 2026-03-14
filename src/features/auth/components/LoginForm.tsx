'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

interface LoginFormProps {
  onSubmit: (data: { email: string; password?: string }) => void
  isLoading: boolean
  error: string | null
}

export function LoginForm({ onSubmit, isLoading, error }: LoginFormProps) {
  const [validationError, setValidationError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const emailInput = form.elements.namedItem('email') as HTMLInputElement
    const passwordInput = form.elements.namedItem('password') as HTMLInputElement | null

    if (emailInput.validity.valueMissing) {
      setValidationError('Введите email')
      return
    }
    if (emailInput.validity.typeMismatch) {
      setValidationError('Введите корректный email')
      return
    }
    
    // We make password required for login, assuming LoginForm handles both steps or just login.
    // In our new requirements LoginForm is just email + password.
    if (passwordInput && passwordInput.validity.valueMissing) {
      setValidationError('Введите пароль')
      return
    }

    setValidationError(null)
    onSubmit({ 
      email: emailInput.value, 
      password: passwordInput?.value 
    })
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
          aria-describedby={displayError ? 'login-error' : undefined}
          aria-invalid={!!displayError}
          onChange={() => setValidationError(null)}
          className={cn(
            'border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-ring/50 focus:border-ring min-h-[44px] rounded-lg border px-3 py-2 text-sm transition-colors focus:ring-2 focus:outline-none disabled:opacity-50',
            displayError &&
              'border-destructive focus:ring-destructive/20 focus:border-destructive'
          )}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-foreground text-sm font-medium">
          Пароль
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          placeholder="Ваш пароль"
          disabled={isLoading}
          onChange={() => setValidationError(null)}
          className={cn(
            'border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-ring/50 focus:border-ring min-h-[44px] rounded-lg border px-3 py-2 text-sm transition-colors focus:ring-2 focus:outline-none disabled:opacity-50',
            displayError &&
              'border-destructive focus:ring-destructive/20 focus:border-destructive'
          )}
        />
        {displayError && (
          <p id="login-error" role="alert" className="text-destructive text-sm mt-1">
            {displayError}
          </p>
        )}
      </div>

      <div className="flex justify-center mt-2">
        <button
          type="submit"
          disabled={isLoading}
          className="inline-flex items-center justify-center border border-primary px-8 py-3 font-sans text-xs font-medium tracking-[0.2em] uppercase text-foreground transition-colors hover:bg-primary/10 disabled:opacity-50 disabled:pointer-events-none w-[240px]"
        >
          {isLoading ? 'Секунду...' : 'Войти'}
        </button>
      </div>

    </form>
  )
}
