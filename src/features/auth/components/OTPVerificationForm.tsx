'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface OTPVerificationFormProps {
  email: string
  onSubmit: (token: string) => void
  onResend: () => void
  onBack?: () => void
  isLoading: boolean
  error: string | null
}

export function OTPVerificationForm({
  email,
  onSubmit,
  onResend,
  onBack,
  isLoading,
  error,
}: OTPVerificationFormProps) {
  const [validationError, setValidationError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const rawToken = (form.elements.namedItem('otp') as HTMLInputElement).value
    // Убираем пробелы для корректного UX копипасты (например, "123 456" → "123456")
    const token = rawToken.replace(/\s/g, '')

    if (!/^\d{6}$/.test(token)) {
      setValidationError('Введите 6-значный код из письма')
      return
    }

    setValidationError(null)
    onSubmit(token)
  }

  const displayError = validationError ?? error

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">
        Мы отправили письмо на{' '}
        <span className="text-foreground font-medium">{email}</span>. Введите
        код из письма или перейдите по ссылке.
      </p>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="otp" className="text-foreground text-sm font-medium">
            Код из письма
          </label>
          <input
            id="otp"
            name="otp"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            required
            placeholder="123456"
            disabled={isLoading}
            aria-describedby={displayError ? 'otp-error' : undefined}
            aria-invalid={!!displayError}
            onChange={() => setValidationError(null)}
            className={cn(
              'border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-ring/50 focus:border-ring min-h-[44px] rounded-lg border px-3 py-2 text-sm tracking-widest transition-colors focus:ring-2 focus:outline-none disabled:opacity-50',
              displayError &&
                'border-destructive focus:ring-destructive/20 focus:border-destructive'
            )}
          />
          {displayError && (
            <p id="otp-error" role="alert" className="text-destructive text-sm">
              {displayError}
            </p>
          )}
        </div>

        <Button type="submit" disabled={isLoading} className="w-full">
          {isLoading ? 'Проверяем...' : 'Войти'}
        </Button>
      </form>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onResend}
          disabled={isLoading}
          className="text-primary min-h-[44px] min-w-[44px] px-2 text-sm underline-offset-4 transition-opacity hover:underline disabled:opacity-50"
        >
          Отправить повторно
        </button>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            disabled={isLoading}
            className="text-muted-foreground min-h-[44px] min-w-[44px] px-2 text-sm underline-offset-4 transition-opacity hover:underline disabled:opacity-50"
          >
            Изменить email
          </button>
        )}
      </div>
    </div>
  )
}
