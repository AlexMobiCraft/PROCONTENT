'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

interface RegisterFormProps {
  email: string
  onSubmit: (data: { password: string }) => void
  isLoading: boolean
  error: string | null
}

export function RegisterForm({ email, onSubmit, isLoading, error }: RegisterFormProps) {
  const [validationError, setValidationError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const passwordInput = form.elements.namedItem('password') as HTMLInputElement

    if (passwordInput.validity.valueMissing) {
      setValidationError('Izmislite si geslo')
      return
    }
    if (passwordInput.value.length < 6) {
      setValidationError('Geslo mora imeti vsaj 6 znakov')
      return
    }

    setValidationError(null)
    onSubmit({ password: passwordInput.value })
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
          value={email}
          readOnly
          className="border-border bg-muted text-muted-foreground min-h-[44px] rounded-lg border px-3 py-2 text-sm focus:outline-none"
        />
        <p className="text-[10px] text-muted-foreground mt-1 px-1">
          E-pošta iz vaše naročila v Stripe
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-foreground text-sm font-medium">
          Ustvarite geslo
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoFocus
          placeholder="Najmanj 6 znakov"
          disabled={isLoading}
          onChange={() => setValidationError(null)}
          className={cn(
            'border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-ring/50 focus:border-ring min-h-[44px] rounded-lg border px-3 py-2 text-sm transition-colors focus:ring-2 focus:outline-none disabled:opacity-50',
            displayError &&
              'border-destructive focus:ring-destructive/20 focus:border-destructive'
          )}
        />
        {displayError && (
          <p role="alert" className="text-destructive text-sm mt-1">
            {displayError}
          </p>
        )}
      </div>

      <div className="flex justify-center mt-2">
        <button
          type="submit"
          disabled={isLoading}
          className="inline-flex items-center justify-center border border-primary px-8 py-3 font-sans text-xs font-medium tracking-[0.2em] uppercase text-foreground transition-colors hover:bg-primary/10 disabled:opacity-50 disabled:pointer-events-none w-full"
        >
          {isLoading ? 'Trenutek...' : 'Dokončaj registracijo'}
        </button>
      </div>
    </form>
  )
}
