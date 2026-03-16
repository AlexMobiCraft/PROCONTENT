'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { updatePassword } from '@/features/auth/api/auth'
import { cn } from '@/lib/utils'

export function UpdatePasswordForm() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const passwordInput = form.elements.namedItem('password') as HTMLInputElement
    const confirmInput = form.elements.namedItem('confirm') as HTMLInputElement

    if (passwordInput.validity.valueMissing) {
      setValidationError('Введите новый пароль')
      return
    }

    if (passwordInput.value.length < 6) {
      setValidationError('Пароль должен быть не короче 6 символов')
      return
    }

    if (confirmInput.value !== passwordInput.value) {
      setValidationError('Пароли не совпадают')
      return
    }

    setIsLoading(true)
    setError(null)
    setValidationError(null)

    const { error: apiError } = await updatePassword(passwordInput.value)

    setIsLoading(false)

    if (apiError) {
      setError('Не удалось обновить пароль. Попробуйте позже.')
      return
    }

    router.push('/feed')
  }

  const displayError = validationError ?? error

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-foreground text-2xl font-semibold">
          Создание пароля
        </h1>
        <p className="text-muted-foreground text-sm">
          Придумайте надежный пароль
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-foreground text-sm font-medium">
            Новый пароль
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            placeholder="Не менее 6 символов"
            disabled={isLoading}
            onChange={() => setValidationError(null)}
            className={cn(
              'border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-ring/50 focus:border-ring min-h-[44px] rounded-lg border px-3 py-2 text-sm transition-colors focus:ring-2 focus:outline-none disabled:opacity-50',
              displayError &&
                'border-destructive focus:ring-destructive/20 focus:border-destructive'
            )}
          />
          {displayError && (
            <p id="password-error" role="alert" className="text-destructive text-sm mt-1">
              {displayError}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="confirm" className="text-foreground text-sm font-medium">
            Подтвердите пароль
          </label>
          <input
            id="confirm"
            name="confirm"
            type="password"
            required
            placeholder="Повторите пароль"
            disabled={isLoading}
            onChange={() => setValidationError(null)}
            className={cn(
              'border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-ring/50 focus:border-ring min-h-[44px] rounded-lg border px-3 py-2 text-sm transition-colors focus:ring-2 focus:outline-none disabled:opacity-50',
              displayError &&
                'border-destructive focus:ring-destructive/20 focus:border-destructive'
            )}
          />
        </div>

        <div className="flex justify-center mt-2">
          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex items-center justify-center border border-primary px-8 py-3 font-sans text-xs font-medium tracking-[0.2em] uppercase text-foreground transition-colors hover:bg-primary/10 disabled:opacity-50 disabled:pointer-events-none w-[240px]"
          >
            {isLoading ? 'Сохраняем...' : 'Сохранить и войти'}
          </button>
        </div>
      </form>
    </div>
  )
}
