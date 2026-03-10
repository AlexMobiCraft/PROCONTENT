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
            ref={inputRef}
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
            value={inputValue}
            aria-describedby={displayError ? 'otp-error' : undefined}
            aria-invalid={!!displayError}
            onChange={(e) => {
              setInputValue(e.target.value)
              setValidationError(null)
            }}
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

        <div className="flex justify-center">
          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex items-center justify-center border border-primary px-8 py-3 font-sans text-xs font-medium tracking-[0.2em] uppercase text-foreground transition-colors hover:bg-primary/10 disabled:opacity-50 disabled:pointer-events-none w-[240px]"
          >
            {isLoading ? 'Проверяем...' : 'Войти'}
          </button>
        </div>
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
