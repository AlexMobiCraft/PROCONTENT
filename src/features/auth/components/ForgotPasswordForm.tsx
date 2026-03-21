'use client'

import { useState } from 'react'
import Link from 'next/link'

import { resetPasswordForEmail } from '@/features/auth/api/auth'
import { cn } from '@/lib/utils'

export function ForgotPasswordForm() {
  const [isLoading, setIsLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [networkError, setNetworkError] = useState<string | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const emailInput = form.elements.namedItem('email') as HTMLInputElement
    setNetworkError(null)

    if (emailInput.validity.valueMissing) {
      setValidationError('Vnesite e-pošto')
      return
    }
    if (emailInput.validity.typeMismatch) {
      setValidationError('Vnesite veljavno e-pošto')
      return
    }

    setIsLoading(true)
    setValidationError(null)
    setNetworkError(null)

    const { error } = await resetPasswordForEmail(emailInput.value)

    if (error) {
      setIsLoading(false)
      setNetworkError('Pošiljanje ni uspelo. Poskusite pozneje.')
      return
    }

    // Всегда показываем успешное сообщение — защита от user enumeration (AC4)
    // isLoading сбрасывается вместе с setSubmitted в одном ре-рендере
    setIsLoading(false)
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div role="status" className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-foreground text-2xl font-semibold">
            Sporočilo poslano
          </h1>
          <p className="text-muted-foreground text-sm">
            Če je e-pošta registrirana, boste prejeli sporočilo s povezavo za ponastavitev gesla.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setSubmitted(false)}
          className="text-foreground/70 hover:text-foreground text-center text-sm underline underline-offset-4 transition-colors"
        >
          Vnesi drugo e-pošto
        </button>
        <Link
          href="/login"
          className="text-center text-foreground/70 hover:text-foreground text-sm underline underline-offset-4 transition-colors"
        >
          Nazaj na prijavo
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-foreground text-2xl font-semibold">
          Ponastavitev gesla
        </h1>
        <p className="text-muted-foreground text-sm">
          Vnesite e-pošto — poslali vam bomo povezavo za obnovitev dostopa
        </p>
      </div>

      {networkError && (
        <div
          role="alert"
          className="border-destructive/20 bg-destructive/10 text-destructive rounded-lg border px-4 py-3 text-sm"
        >
          {networkError}
        </div>
      )}

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
            aria-describedby={validationError ? 'forgot-email-error' : undefined}
            aria-invalid={!!validationError}
            onChange={() => {
              setValidationError(null)
              setNetworkError(null)
            }}
            className={cn(
              'border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-ring/50 focus:border-ring min-h-[44px] rounded-lg border px-3 py-2 text-sm transition-colors focus:ring-2 focus:outline-none disabled:opacity-50',
              validationError &&
                'border-destructive focus:ring-destructive/20 focus:border-destructive'
            )}
          />
          {validationError && (
            <p id="forgot-email-error" role="alert" className="text-destructive text-sm mt-1">
              {validationError}
            </p>
          )}
        </div>

        <div className="flex justify-center mt-2">
          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex items-center justify-center border border-primary px-8 py-3 font-sans text-xs font-medium tracking-[0.2em] uppercase text-foreground transition-colors hover:bg-primary/10 disabled:opacity-50 disabled:pointer-events-none w-full max-w-[240px]"
          >
            {isLoading ? 'Pošiljamo...' : 'Pošlji povezavo'}
          </button>
        </div>
      </form>

      <Link
        href="/login"
        className="text-center text-foreground/70 hover:text-foreground text-sm underline underline-offset-4 transition-colors"
      >
        Nazaj na prijavo
      </Link>
    </div>
  )
}
