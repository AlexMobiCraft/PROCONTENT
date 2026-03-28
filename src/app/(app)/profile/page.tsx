import { redirect } from 'next/navigation'

import { ProfileScreen } from '@/features/profile/components/ProfileScreen'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
  try {
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
      console.error('[profile/page] DATABASE ERROR:', {
        code: profileError.code,
        message: profileError.message,
        details: profileError.details,
        userId: user.id
      })
      throw new Error(`Profile loading failed: ${profileError.message}`)
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
        canManageEmailPreferences={!!profile}
      />
    )
  } catch (err) {
    if (err instanceof Error && err.message.includes('NEXT_REDIRECT')) {
      throw err // Let Next.js handle redirects
    }
    
    console.error('[profile/page] UNHANDLED EXCEPTION:', err)
    
    return (
      <main className="mx-auto max-w-lg space-y-8 px-4 py-12 text-center">
        <h1 className="font-heading text-2xl font-semibold text-foreground">Profil</h1>
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-8 mt-4">
          <p className="text-sm text-destructive mb-6 leading-relaxed">
            Podatkov profila ni bilo mogoče naložiti zaradi tehnične težave. <br />
            Prosimo, poskusite osvežiti stran ali pa se obrnite na podporo.
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 transition-all font-medium"
          >
            Osveži stran
          </button>
        </div>
      </main>
    )
  }
}
