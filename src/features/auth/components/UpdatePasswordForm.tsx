'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { getSession, updatePassword } from '@/features/auth/api/auth'
import { useAuthStore } from '@/features/auth/store'
import { getAuthSuccessRedirectPath } from '@/lib/app-routes'
import { cn } from '@/lib/utils'

function mapPasswordError(message: string | undefined): string {
  if (!message) return 'Gesla ni bilo mogoče posodobiti. Poskusite pozneje.'
  const lower = message.toLowerCase()
  if (lower.includes('password should be at least') || lower.includes('weak password')) {
    return 'Geslo je prešibko. Izberite bolj varno geslo.'
  }
  return message
}

export function UpdatePasswordForm() {
  const router = useRouter()
  const { setUser, setSession } = useAuthStore()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const passwordInput = form.elements.namedItem('password') as HTMLInputElement
    const confirmInput = form.elements.namedItem('confirm') as HTMLInputElement

    if (passwordInput.validity.valueMissing) {
      setValidationError('Vnesite novo geslo')
      return
    }

    if (passwordInput.value.length < 6) {
      setValidationError('Geslo mora biti vsaj 6 znakov dolgo')
      return
    }

    if (confirmInput.value !== passwordInput.value) {
      setValidationError('Gesli se ne ujemata')
      return
    }

    setIsLoading(true)
    setError(null)
    setValidationError(null)

    const { error: apiError, data } = await updatePassword(passwordInput.value)

    if (apiError) {
      setIsLoading(false)
      const msg = apiError.message?.toLowerCase() ?? ''
      const isExpired =
        msg.includes('invalid') || msg.includes('expired') || msg.includes('session')
      if (isExpired) {
        router.push('/login?error=link-expired')
        return
      }
      setError(mapPasswordError(apiError.message))
      return
    }

    // getSession() читает кэш Supabase-клиента (не сетевой запрос).
    // updateUser не возвращает session, поэтому отдельный вызов необходим для синхронизации useAuthStore.
    const { data: sessionData, error: sessionError } = await getSession()
    setUser(data?.user ?? null)
    setSession(!sessionError && sessionData?.session ? sessionData.session : null)
    setIsLoading(false)

    setSuccess(true)
    timerRef.current = setTimeout(() => {
      router.refresh()
      router.push(getAuthSuccessRedirectPath())
    }, 2000)
  }

  const displayError = validationError ?? error

  if (success) {
    return (
      <div role="status" className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-foreground text-2xl font-semibold">
            Geslo posodobljeno
          </h1>
          <p className="text-muted-foreground text-sm">
            Vaše geslo je bilo uspešno spremenjeno. Preusmerjamo v feed...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-foreground text-2xl font-semibold">
          Obnovitev gesla
        </h1>
        <p className="text-muted-foreground text-sm">
          Ustvarite varno geslo
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-foreground text-sm font-medium">
            Novo geslo
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="new-password"
            placeholder="Vsaj 6 znakov"
            disabled={isLoading}
            onChange={() => {
              setValidationError(null)
              setError(null)
            }}
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
            Potrdite geslo
          </label>
          <input
            id="confirm"
            name="confirm"
            type="password"
            required
            autoComplete="new-password"
            placeholder="Ponovite geslo"
            disabled={isLoading}
            onChange={() => {
              setValidationError(null)
              setError(null)
            }}
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
            className="inline-flex items-center justify-center border border-primary px-8 py-3 font-sans text-xs font-medium tracking-[0.2em] uppercase text-foreground transition-colors hover:bg-primary/10 disabled:opacity-50 disabled:pointer-events-none w-full max-w-[240px]"
          >
            {isLoading ? 'Shranjujemo...' : 'Shrani in prijavi se'}
          </button>
        </div>
      </form>
    </div>
  )
}
