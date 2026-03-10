'use client'

import { useEffect, useRef, useState } from 'react'

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
  const [inputValue, setInputValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  // Отслеживаем предыдущее значение error для сравнения во время рендера
  const [prevError, setPrevError] = useState<string | null>(null)
  // Отслеживаем предыдущий error для DOM side-effect (focus) без setState
  const prevErrorForFocusRef = useRef<string | null>(null)

  // During render: сброс поля при переходе error null → non-null (рекомендованный React-паттерн)
  if (error !== prevError) {
    if (error !== null && prevError === null) {
      setInputValue('')
      setValidationError(null)
    }
    setPrevError(error)
  }

  // DOM side-effect: фокус при появлении ошибки (только focus, без setState)
  useEffect(() => {
    if (error !== null && prevErrorForFocusRef.current === null) {
      inputRef.current?.focus()
    }
    prevErrorForFocusRef.current = error
  }, [error])

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    // Убираем все не-цифровые символы: пробелы, дефисы и пр. (UX копипасты)
    const token = inputValue.replace(/\D/g, '')

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
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="otp" className="sr-only">
            Код из письма
          </label>
          <input
            ref={inputRef}
            id="otp"
            name="otp"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            required
            placeholder="000000"
            disabled={isLoading}
            value={inputValue}
            aria-describedby={displayError ? 'otp-error' : undefined}
            aria-invalid={!!displayError}
            onChange={(e) => {
              setInputValue(e.target.value)
              setValidationError(null)
            }}
            className={cn(
              'border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-primary/20 min-h-[44px] rounded-lg border px-4 py-3 text-center text-2xl tracking-[0.5em] font-sans transition-colors focus:ring-2 focus:outline-none disabled:opacity-50',
              displayError && 'border-destructive focus:ring-destructive/20'
            )}
          />
          {displayError && (
            <p
              id="otp-error"
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
          {isLoading ? 'Проверяем...' : 'Войти'}
        </button>
      </form>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onResend}
          disabled={isLoading}
          className="font-sans text-xs text-primary uppercase tracking-[0.1em] underline-offset-4 hover:underline min-h-[44px] min-w-[44px] px-2 transition-opacity disabled:opacity-50"
        >
          Отправить повторно
        </button>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            disabled={isLoading}
            className="font-sans text-xs text-muted-foreground uppercase tracking-[0.1em] underline-offset-4 hover:underline min-h-[44px] min-w-[44px] px-2 transition-opacity disabled:opacity-50"
          >
            Изменить email
          </button>
        )}
      </div>
    </div>
  )
}
