'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import { signInWithPassword } from '@/features/auth/api/auth'
import { useAuthStore } from '@/features/auth/store'
import { LoginForm } from './LoginForm'

export function AuthContainer() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const setUser = useAuthStore((state) => state.setUser)
  const setSession = useAuthStore((state) => state.setSession)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [networkError, setNetworkError] = useState<string | null>(null)

  const magicLinkError = searchParams.get('error')
  const magicLinkErrorMessage =
    magicLinkError === 'auth_callback_error' || magicLinkError === 'auth_callback_error_v2'
      ? 'Ссылка недействительна. Запросите новую или войдите по паролю.'
      : magicLinkError === 'link-expired'
      ? 'Срок действия ссылки истёк. Запросите новую ссылку для сброса пароля.'
      : null

  async function handleLoginSubmit({ email, password }: { email: string; password?: string }) {
    if (!password) {
      setError('Введите пароль')
      return
    }

    setIsLoading(true)
    setError(null)
    setNetworkError(null)

    const { data, error: apiError } = await signInWithPassword({ email, password })

    if (apiError) {
      setIsLoading(false)
      if (apiError.status === 400 && apiError.message.includes('Invalid login credentials')) {
        setError('Неверный email или пароль')
      } else {
        setNetworkError('Что-то пошло не так. Попробуйте ещё раз.')
      }
      return
    }

    if (data?.session) {
      setUser(data.session.user)
      setSession(data.session)
    }

    router.push('/feed')
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-foreground text-2xl font-semibold">
          Вход
        </h1>
        <p className="text-muted-foreground text-sm">
          Используйте email и пароль
        </p>
      </div>

      {(magicLinkErrorMessage || networkError) && (
        <div
          role="alert"
          className="border-destructive/20 bg-destructive/10 text-destructive rounded-lg border px-4 py-3 text-sm"
        >
          {magicLinkErrorMessage ?? networkError}
        </div>
      )}

      <LoginForm
        onSubmit={handleLoginSubmit}
        isLoading={isLoading}
        error={error}
      />

      <div className="text-center">
        <a
          href="/forgot-password"
          className="text-foreground/70 hover:text-foreground text-sm underline underline-offset-4 transition-colors"
        >
          Забыли пароль?
        </a>
      </div>
    </div>
  )
}
