'use client'

import { useState } from 'react'
import { toast } from 'sonner'

import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ADMIN_POSTS_CREATE_PATH, ADMIN_CATEGORIES_PATH, ADMIN_SETTINGS_PATH } from '@/lib/app-routes'
import { useFeedStore } from '@/features/feed/store'
import { EmailPreferencesCard } from './EmailPreferencesCard'
import { SubscriptionCard } from './SubscriptionCard'
import { PasswordResetCard } from './PasswordResetCard'
import { ProfileRightPanel } from './ProfileRightPanel'
import { ProfileEditCard } from './ProfileEditCard'

interface ProfileScreenProps {
  email: string
  displayName: string | null
  subscriptionStatus: string | null
  currentPeriodEnd: string | null
  hasStripeCustomer: boolean
  userId?: string
  first_name?: string
  avatar_url?: string | null
  emailNotificationsEnabled?: boolean | null
  canManageEmailPreferences?: boolean
  isAdmin?: boolean
}

export function ProfileScreen({
  email,
  displayName,
  subscriptionStatus,
  currentPeriodEnd,
  hasStripeCustomer,
  userId,
  first_name = '',
  avatar_url = null,
  emailNotificationsEnabled: initialEmailEnabled,
  canManageEmailPreferences = false,
  isAdmin = false,
}: ProfileScreenProps) {
  const [emailEnabled, setEmailEnabled] = useState(initialEmailEnabled ?? true)
  const [isEmailSaving, setIsEmailSaving] = useState(false)
  const [currentFirstName, setCurrentFirstName] = useState(first_name)
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState(avatar_url)

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

  function handleProfileUpdate(updates: {
    first_name?: string
    avatar_url?: string | null
  }) {
    if (updates.first_name !== undefined) {
      setCurrentFirstName(updates.first_name)
    }
    if (updates.avatar_url !== undefined) {
      setCurrentAvatarUrl(updates.avatar_url)
      if (userId) {
        useFeedStore.getState().updateProfileAvatar(userId, updates.avatar_url)
      }
    }
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

          {userId && (
            <ProfileEditCard
              userId={userId}
              first_name={currentFirstName}
              avatar_url={currentAvatarUrl}
              onProfileUpdate={handleProfileUpdate}
            />
          )}

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

          {isAdmin && (
            <section
              aria-label="Administracija"
              className="border border-border bg-card p-6 space-y-3"
            >
              <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Administracija
              </h2>
              <div className="space-y-1">
                <Link
                  href={ADMIN_POSTS_CREATE_PATH}
                  aria-label="Nova objava"
                  className="flex min-h-[44px] items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                >
                  Nova objava
                </Link>
                <Link
                  href={ADMIN_CATEGORIES_PATH}
                  aria-label="Kategorije"
                  className="flex min-h-[44px] items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                >
                  Kategorije
                </Link>
                <Link
                  href={ADMIN_SETTINGS_PATH}
                  aria-label="Nastavitve administracije"
                  className="flex min-h-[44px] items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                >
                  Nastavitve
                </Link>
              </div>
            </section>
          )}
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
