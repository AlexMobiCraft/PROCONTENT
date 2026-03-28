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
    .select(
      'email, display_name, subscription_status, current_period_end, stripe_customer_id, email_notifications_enabled'
    )
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) {
    console.error('[profile/page] Fatálna napaka pri nalaganju profila:', {
      code: profileError.code,
      message: profileError.message,
      details: profileError.details,
      hint: profileError.hint,
      userId: user.id
    })
    
    return (
      <main className="mx-auto max-w-lg space-y-8 px-4 py-12">
        <h1 className="font-heading text-2xl font-semibold text-foreground">Profil</h1>
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-6 text-center">
          <p className="text-sm text-destructive mb-4">
            Podatkov profila ni bilo mogoče naložiti. Poskusite osvežiti stran.
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="text-xs font-medium underline underline-offset-4 hover:text-destructive/80 transition-colors"
          >
            Osveži stran
          </button>
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
      emailNotificationsEnabled={profile?.email_notifications_enabled ?? true}
      canManageEmailPreferences={true}
    />
  )
}
