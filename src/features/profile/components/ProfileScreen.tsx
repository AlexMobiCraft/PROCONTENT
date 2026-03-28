'use client'

import { useState } from 'react'
import { toast } from 'sonner'

import { createClient } from '@/lib/supabase/client'
import { EmailPreferencesCard } from './EmailPreferencesCard'
import { SubscriptionCard } from './SubscriptionCard'
import { PasswordResetCard } from './PasswordResetCard'
import { ProfileRightPanel } from './ProfileRightPanel'

interface ProfileScreenProps {
  email: string
  displayName: string | null
  subscriptionStatus: string | null
  currentPeriodEnd: string | null
  hasStripeCustomer: boolean
  userId?: string
  emailNotificationsEnabled?: boolean | null
  canManageEmailPreferences?: boolean
}

export function ProfileScreen({
  email,
  displayName,
  subscriptionStatus,
  currentPeriodEnd,
  hasStripeCustomer,
  userId,
  emailNotificationsEnabled: initialEmailEnabled,
  canManageEmailPreferences = false,
}: ProfileScreenProps) {
  const [emailEnabled, setEmailEnabled] = useState(initialEmailEnabled ?? true)
  const [isEmailSaving, setIsEmailSaving] = useState(false)

  async function handleEmailToggle(enabled: boolean) {
    if (!userId) return
    const prev = emailEnabled
    setEmailEnabled(enabled)
    setIsEmailSaving(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('profiles')
      .update({ email_notifications_enabled: enabled })
      .eq('id', userId)
    if (error) {
      setEmailEnabled(prev)
      toast.error('Napaka pri shranjevanju nastavitev')
      setIsEmailSaving(false)
      return
    }
    toast.success(
      enabled ? 'E-poštna obvestila so vklopljena' : 'E-poštna obvestila so izklopljena'
    )
    setIsEmailSaving(false)
  }

  return (
    <main className="flex min-h-screen flex-col pb-[60px] md:flex-row md:pb-0">
      {/* Центральная колонка: аккаунт + подписка */}
      <div className="flex min-w-0 flex-1 flex-col md:border-r md:border-border">
        <div className="sticky top-0 z-10 flex h-[var(--header-height)] shrink-0 items-center border-b border-border bg-background/95 px-6 backdrop-blur-sm">
          <h1 className="font-heading text-lg font-semibold text-foreground">Profil</h1>
        </div>

        {/* Kartica člana — только mobile, до основного контента */}
        <div className="md:hidden">
          <ProfileRightPanel
            email={email}
            displayName={displayName}
            subscriptionStatus={subscriptionStatus}
          />
        </div>

        <div className="space-y-4 p-6">
          <div className="space-y-2 border border-border p-6">
            <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">Račun</p>
            {displayName && <p className="font-medium text-foreground">{displayName}</p>}
            <p className="text-sm text-muted-foreground">{email}</p>
          </div>

          <SubscriptionCard
            subscriptionStatus={subscriptionStatus}
            currentPeriodEnd={currentPeriodEnd}
            hasStripeCustomer={hasStripeCustomer}
          />

          {canManageEmailPreferences && (
            <EmailPreferencesCard
              id="email-preferences"
              emailNotificationsEnabled={emailEnabled}
              onToggle={handleEmailToggle}
              isLoading={isEmailSaving}
            />
          )}

          <PasswordResetCard email={email} />
        </div>
      </div>

      {/* Правая панель: карточка участника */}
      <aside
        aria-label="Kartica člana"
        className="hidden md:sticky md:top-0 md:flex md:h-screen md:w-[350px] md:shrink-0 md:flex-col md:overflow-y-auto"
      >
        <ProfileRightPanel
          email={email}
          displayName={displayName}
          subscriptionStatus={subscriptionStatus}
        />
      </aside>
    </main>
  )
}
