'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { signInWithOtp, verifyOtp } from '@/features/auth/api/auth'
import { LoginForm } from './LoginForm'
import { OTPVerificationForm } from './OTPVerificationForm'

type AuthStep = 'email' | 'otp'

export function AuthContainer() {
  const router = useRouter()
  const [step, setStep] = useState<AuthStep>('email')
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [networkError, setNetworkError] = useState<string | null>(null)
  const [otpKey, setOtpKey] = useState(0)

  async function handleEmailSubmit(submittedEmail: string) {
    setIsLoading(true)
    setError(null)
    setNetworkError(null)

    const { error: apiError } = await signInWithOtp(submittedEmail)

    setIsLoading(false)

    if (apiError) {
      // Системные ошибки сети/сервера — показываем как сетевую ошибку
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

    const { error: apiError } = await verifyOtp(email, token)

    setIsLoading(false)

    if (apiError) {
      if (apiError.status === 422) {
        // Ошибка токена (невалидный/просроченный) — inline под полем, поле очищается через key
        setError(
          'Код неверный или просрочен. Проверьте письмо или запросите новый код.'
        )
        setOtpKey((k) => k + 1)
      } else {
        // Системная ошибка
        setNetworkError('Что-то пошло не так. Попробуйте ещё раз.')
      }
      return
    }

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

      {networkError && (
        <div
          role="alert"
          className="border-destructive/20 bg-destructive/10 text-destructive rounded-lg border px-4 py-3 text-sm"
        >
          {networkError}
        </div>
      )}

      {step === 'email' ? (
        <LoginForm
          onSubmit={handleEmailSubmit}
          isLoading={isLoading}
          error={error}
        />
      ) : (
        <OTPVerificationForm
          key={otpKey}
          email={email}
          onSubmit={handleOtpSubmit}
          onResend={handleResend}
          isLoading={isLoading}
          error={error}
        />
      )}
    </div>
  )
}
