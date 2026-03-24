import { redirect } from 'next/navigation'

import { ProfileScreen } from '@/features/profile/components/ProfileScreen'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

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
    // PGRST116: профиль ещё не создан — нормальный сценарий (не фатальная ошибка БД).
    // Показываем страницу с email из auth.users и статусом "Нет подписки".
    if ((profileError as { code?: string }).code === 'PGRST116') {
      return (
        <ProfileScreen
          email={user.email ?? ''}
          displayName={null}
          subscriptionStatus={null}
          currentPeriodEnd={null}
          hasStripeCustomer={false}
        />
      )
    }
    console.error('[profile/page] Ошибка загрузки профиля:', profileError)
    return (
      <main className="mx-auto max-w-lg space-y-8 px-4 py-12">
        <h1 className="font-heading text-2xl font-semibold text-foreground">Profil</h1>
        <p className="text-sm text-destructive">
          Podatkov profila ni bilo mogoče naložiti. Poskusite osvežiti stran.
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
