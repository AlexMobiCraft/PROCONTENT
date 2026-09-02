'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ONBOARDING_PATH } from '@/lib/app-routes'
import { cn } from '@/lib/utils'
import { signUp } from '@/features/auth/api/auth'
import { RegisterForm } from './RegisterForm'

interface RegisterContainerProps {
  email: string
}

export function RegisterContainer({ email }: RegisterContainerProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleRegisterSubmit({
    password,
    first_name: firstName,
    last_name: lastName,
  }: {
    password: string
    first_name: string
    last_name: string
  }) {
    setIsLoading(true)
    setError(null)

    const { data, error: apiError } = await signUp({ email, password })

    if (apiError) {
      setIsLoading(false)
      setError(apiError.message || 'Napaka pri registraciji. Poskusite znova.')
      return
    }

    if (!data?.user) {
      setError('Napaka pri registraciji. Poskusite znova.')
      setIsLoading(false)
      return
    }

    // Ссылка из письма после оплаты живёт долго и по ней можно прийти повторно.
    // Supabase не раскрывает существование аккаунта: вместо ошибки возвращает
    // пользователя с пустым identities. Без этой ветки уже зарегистрированной
    // участнице показывалось бы «ждите письмо», которого никто не отправлял.
    if (data.user.identities && data.user.identities.length === 0) {
      setError('Račun s tem e-naslovom že obstaja. Prijavite se s svojim geslom.')
      setIsLoading(false)
      return
    }

    // Fix #4: trim перед сохранением в профиль
    const trimmedFirstName = firstName.trim()
    const trimmedLastName = lastName.trim()

    const supabase = createClient()
    const { data: updatedRows, error: updateError } = await supabase
      .from('profiles')
      .update({ first_name: trimmedFirstName, last_name: trimmedLastName || null })
      .eq('id', data.user.id)
      .select('id')

    // 0 строк без ошибки — профиль ещё не создан триггером или отсечён RLS.
    // Без .select() имя молча терялось бы, а участница видела бы успех.
    if (updateError || !updatedRows || updatedRows.length === 0) {
      // Fix #4: показываем ошибку пользователю, не тихий console.warn
      setError('Napaka pri shranjevanju podatkov profila. Prosimo, posodobite profil ročno.')
      setIsLoading(false)
      return
    }

    // На боевом GoTrue включён autoconfirm: signUp сразу возвращает сессию, письма
    // с подтверждением не будет никогда. Прежний безусловный текст «проверьте почту»
    // оставлял уже залогиненную участницу ждать несуществующее письмо.
    // Ориентируемся на факт сессии, а не на предположение о настройках почты.
    if (data.session) {
      router.push(ONBOARDING_PATH)
      // isLoading намеренно остаётся true: идёт навигация, форму включать обратно незачем
      return
    }

    setError('Potrditveno sporočilo je bilo poslano na vašo e-pošto. Potrdite e-pošto za vstop v klub.')
    setIsLoading(false)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-foreground text-2xl font-semibold">
          Registracija
        </h1>
        <p className="text-muted-foreground text-sm">
          Ustvarite geslo za dostop do gradiv
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className={cn(
            "rounded-lg border px-4 py-3 text-sm",
            error.includes('Potrditveno')
              ? "border-primary/20 bg-primary/10 text-primary"
              : "border-destructive/20 bg-destructive/10 text-destructive"
          )}
        >
          {error}
        </div>
      )}

      <RegisterForm
        email={email}
        onSubmit={handleRegisterSubmit}
        isLoading={isLoading}
        error={null}
      />
    </div>
  )
}
