'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

interface RegisterFormProps {
  email: string
  onSubmit: (data: { password: string; first_name: string; last_name: string }) => void
  isLoading: boolean
  error: string | null
}

export function RegisterForm({ email, onSubmit, isLoading, error }: RegisterFormProps) {
  const [validationError, setValidationError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const firstNameInput = form.elements.namedItem('first_name') as HTMLInputElement
    const lastNameInput = form.elements.namedItem('last_name') as HTMLInputElement
    const passwordInput = form.elements.namedItem('password') as HTMLInputElement

    if (firstNameInput.validity.valueMissing) {
      setValidationError('Polje je obvezno')
      return
    }
    if (firstNameInput.value.length < 3) {
      setValidationError('Najmanj 3 znaki')
      return
    }

    if (passwordInput.validity.valueMissing) {
      setValidationError('Izmislite si geslo')
      return
    }
    if (passwordInput.value.length < 6) {
      setValidationError('Geslo mora imeti vsaj 6 znakov')
      return
    }

    setValidationError(null)
    onSubmit({
      first_name: firstNameInput.value,
      last_name: lastNameInput.value,
      password: passwordInput.value,
    })
  }

  const displayPasswordError = (validationError?.includes('Geslo') || validationError?.includes('6')) ? validationError : error

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
        <label htmlFor="first_name" className="text-foreground text-sm font-medium">
          Ime
        </label>
        <input
          id="first_name"
          name="first_name"
          type="text"
          required
          minLength={3}
          placeholder="Najmanj 3 znaki"
          disabled={isLoading}
          onChange={() => setValidationError(null)}
          className={cn(
            'border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-ring/50 focus:border-ring min-h-[44px] rounded-lg border px-3 py-2 text-sm transition-colors focus:ring-2 focus:outline-none disabled:opacity-50',
            validationError && !validationError.includes('Geslo') &&
              'border-destructive focus:ring-destructive/20 focus:border-destructive'
          )}
        />
        {validationError && !validationError.includes('Geslo') && (
          <p role="alert" className="text-destructive text-sm mt-1">
            {validationError}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="last_name" className="text-foreground text-sm font-medium">
          Priimek (izbirno)
        </label>
        <input
          id="last_name"
          name="last_name"
          type="text"
          placeholder="Vaš priimek"
          disabled={isLoading}
          onChange={() => setValidationError(null)}
          className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-ring/50 focus:border-ring min-h-[44px] rounded-lg border px-3 py-2 text-sm transition-colors focus:ring-2 focus:outline-none disabled:opacity-50"
        />
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
          placeholder="Najmanj 6 znakov"
          disabled={isLoading}
          onChange={() => setValidationError(null)}
          className={cn(
            'border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-ring/50 focus:border-ring min-h-[44px] rounded-lg border px-3 py-2 text-sm transition-colors focus:ring-2 focus:outline-none disabled:opacity-50',
            displayPasswordError &&
              'border-destructive focus:ring-destructive/20 focus:border-destructive'
          )}
        />
        {displayPasswordError && (
          <p role="alert" className="text-destructive text-sm mt-1">
            {displayPasswordError}
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
