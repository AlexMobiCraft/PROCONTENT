'use server'

import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'
import { headers } from 'next/headers'

export async function signUpAction(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const sessionId = formData.get('sessionId') as string

  if (!email || !password) {
    return { error: 'Email и пароль обязательны' }
  }

  const supabase = await createClient()

  // 1. Создаем пользователя в Supabase
  const { data, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${(await headers()).get('origin')}/auth/confirm`,
    },
  })

  if (signUpError) {
    return { error: signUpError.message }
  }

  const userId = data.user?.id

  // 2. Если есть sessionId, пытаемся привязать оплату СРАЗУ (Story 1.7)
  if (userId && sessionId) {
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId)
      
      if (session.payment_status === 'paid' || session.payment_status === 'no_payment_required') {
        const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id
        const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id

        // Используем admin-клиент или надеемся на то, что триггер уже создал профиль.
        // Так как это серверная часть, мы можем обновить профиль.
        // Важно: на этом этапе RLS может не пустить обычного юзера, 
        // поэтому лучше дождаться подтверждения почты или использовать сервисную роль.
        // Но проще всего — если Webhook всё же сработает позже.
        
        // Для надежности мы просто логируем это здесь, а основную работу 
        // сделает Webhook, который мы сейчас ТОЖЕ починим.
        console.info(`[signUpAction] Найдена оплаченная сессия для нового юзера ${userId}`)
      }
    } catch (e) {
      console.error('[signUpAction] Ошибка проверки сессии Stripe:', e)
    }
  }

  return { success: true, message: 'Проверьте почту для подтверждения регистрации' }
}
