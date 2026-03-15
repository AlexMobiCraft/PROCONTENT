import { redirect } from 'next/navigation'

import { ProfileScreen } from '@/features/profile/components/ProfileScreen'
import { createClient } from '@/lib/supabase/server'

export default async function ProfilePage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('email, display_name, subscription_status, current_period_end, stripe_customer_id')
    .eq('id', user.id)
    .single()

  if (profileError) {
    console.error('[profile/page] Ошибка загрузки профиля:', profileError)
    return (
      <main className="mx-auto max-w-lg px-4 py-12">
        <p className="text-sm text-destructive">
          Не удалось загрузить данные профиля. Попробуйте обновить страницу.
        </p>
      </main>
    )
  }

  return (
    <ProfileScreen
      email={profile?.email ?? user.email ?? ''}
      displayName={profile?.display_name ?? null}
      subscriptionStatus={profile?.subscription_status ?? null}
      currentPeriodEnd={profile?.current_period_end ?? null}
      hasStripeCustomer={!!profile?.stripe_customer_id}
    />
  )
}
