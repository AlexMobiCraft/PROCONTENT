import { redirect } from 'next/navigation'
import { stripe } from '@/lib/stripe'
import { RegisterContainer } from '@/features/auth/components/RegisterContainer'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface RegisterPageProps {
  searchParams: Promise<{ session_id?: string }>
}

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const { session_id: sessionId } = await searchParams

  if (!sessionId) {
    redirect('/login')
  }

  // Проверяем, не залогинен ли уже пользователь
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    redirect('/feed')
  }

  let email = ''
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    email = session.customer_details?.email || ''
  } catch (error) {
    console.error('[register] Ошибка получения сессии Stripe:', error)
    redirect('/login')
  }

  if (!email) {
    redirect('/login')
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <RegisterContainer email={email} />
      </div>
    </main>
  )
}
