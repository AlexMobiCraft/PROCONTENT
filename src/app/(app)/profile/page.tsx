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
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) {
    console.error('[profile/page] Database error:', profileError)
    return (
      <main className="mx-auto max-w-lg space-y-8 px-4 py-12 text-center">
        <h1 className="font-heading text-2xl font-semibold text-foreground">Profil</h1>
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-8 mt-4 text-center">
          <p className="text-sm text-destructive leading-relaxed">
            Podatkov profila ni bilo mogoče naložiti. Poskusite osvežiti stran.
          </p>
        </div>
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
      userId={user.id}
      first_name={profile?.first_name ?? ''}
      avatar_url={profile?.avatar_url ?? null}
      emailNotificationsEnabled={profile?.email_notifications_enabled ?? true}
      canManageEmailPreferences={!!profile}
      isAdmin={profile?.role === 'admin'}
    />
  )
}
