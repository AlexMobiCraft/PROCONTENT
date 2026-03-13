'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import { signInWithOtp, verifyOtp } from '@/features/auth/api/auth'
import { useAuthStore } from '@/features/auth/store'
import { LoginForm } from './LoginForm'
import { OTPVerificationForm } from './OTPVerificationForm'

type AuthStep = 'email' | 'otp'

export function AuthContainer() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const setUser = useAuthStore((state) => state.setUser)
  const setSession = useAuthStore((state) => state.setSession)
  const [step, setStep] = useState<AuthStep>('email')
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [networkError, setNetworkError] = useState<string | null>(null)

  const magicLinkError =
    searchParams.get('error') === 'auth_callback_error'
      ? 'Ссылка недействительна. Запросите новый код.'
      : null

  function handleBack() {
    setStep('email')
    setError(null)
    setNetworkError(null)
    // Убираем sticky ?error=... из URL, чтобы сообщение не прилипало после возврата
    if (searchParams.get('error')) {
      router.replace('/login')
    }
  }

  async function handleEmailSubmit(submittedEmail: string) {
    setIsLoading(true)
    setError(null)
    setNetworkError(null)

    const { error: apiError } = await signInWithOtp(submittedEmail)

    setIsLoading(false)

    if (apiError) {
      // Системные ошибки сети/сервера — показываем как сетевую ошибку
      console.error('[auth] signInWithOtp error:', apiError)
      setNetworkError('Не удалось отправить письмо. Попробуйте ещё раз.')
      return
    }

    setEmail(submittedEmail)
    setStep('otp')
  }

  async function handleOtpSubmit(token: string) {
    setIsLoading(true)
    setError(null)
    setNetworkError(null)

    const { data, error: apiError } = await verifyOtp(email, token)

    if (apiError) {
      // Сбрасываем loading только при ошибке — при успехе оставляем true,
      // чтобы заблокировать повторные нажатия на время роутинга
      setIsLoading(false)
      if (apiError.status === 422) {
        // Ошибка токена (невалидный/просроченный) — inline под полем
        // поле очищается автоматически в OTPVerificationForm через useEffect(error)
        setError(
          'Код неверный или просрочен. Проверьте письмо или запросите новый код.'
        )
      } else {
        // Системная ошибка
        setNetworkError('Что-то пошло не так. Попробуйте ещё раз.')
      }
      return
    }

    // Сохраняем сессию в глобальный store
    if (data?.session) {
      setUser(data.session.user)
      setSession(data.session)
    }

    // isLoading остаётся true до размонтирования компонента при навигации
    router.push('/feed')
  }

  async function handleResend() {
    setError(null)
    setNetworkError(null)

    const { error: apiError } = await signInWithOtp(email)

    if (apiError) {
      setNetworkError('Не удалось отправить письмо. Попробуйте ещё раз.')
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-foreground text-2xl font-semibold">
          Войти в клуб
        </h1>
        <p className="text-muted-foreground text-sm">
          Доступ по email — без паролей
        </p>
      </div>

      {(magicLinkError || networkError) && (
        <div
          role="alert"
          className="border-destructive/20 bg-destructive/10 text-destructive rounded-lg border px-4 py-3 text-sm"
        >
          {magicLinkError ?? networkError}
        </div>
      )}

      {step === 'email' ? (
        <LoginForm
          onSubmit={handleEmailSubmit}
          isLoading={isLoading}
          error={null}
        />
      ) : (
        <OTPVerificationForm
          email={email}
          onSubmit={handleOtpSubmit}
          onResend={handleResend}
          onBack={handleBack}
          isLoading={isLoading}
          error={error}
        />
      )}
    </div>
  )
}
