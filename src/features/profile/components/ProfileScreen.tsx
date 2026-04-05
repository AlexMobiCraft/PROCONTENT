'use client'

import { useState } from 'react'
import { toast } from 'sonner'

import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  ADMIN_POSTS_CREATE_PATH,
  ADMIN_CATEGORIES_PATH,
  ADMIN_MEMBERS_PATH,
  ADMIN_SETTINGS_PATH,
} from '@/lib/app-routes'
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
      enabled
        ? 'E-poštna obvestila so vklopljena'
        : 'E-poštna obvestila so izklopljena'
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

  function renderAdminSection(extraClass: string) {
    return (
      <section
        aria-label="Administracija"
        className={`border-border space-y-3 ${extraClass}`}
      >
        <h2 className="text-muted-foreground text-xs font-semibold tracking-[0.15em] uppercase">
          Administracija
        </h2>
        <div className="space-y-1">
          <Link
            href={ADMIN_POSTS_CREATE_PATH}
            aria-label="Nova objava"
            className="text-muted-foreground hover:bg-muted/50 hover:text-foreground flex min-h-[44px] items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors"
          >
            Nova objava
          </Link>
          <Link
            href={ADMIN_CATEGORIES_PATH}
            aria-label="Kategorije"
            className="text-muted-foreground hover:bg-muted/50 hover:text-foreground flex min-h-[44px] items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors"
          >
            Kategorije
          </Link>
          <Link
            href={ADMIN_MEMBERS_PATH}
            aria-label="Udeleženke"
            className="text-muted-foreground hover:bg-muted/50 hover:text-foreground flex min-h-[44px] items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors"
          >
            Udeleženke
          </Link>
          <Link
            href={ADMIN_SETTINGS_PATH}
            aria-label="Nastavitve administracije"
            className="text-muted-foreground hover:bg-muted/50 hover:text-foreground flex min-h-[44px] items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors"
          >
            Nastavitve
          </Link>
        </div>
      </section>
    )
  }

  return (
    <main className="flex min-h-screen flex-col pb-[60px] md:flex-row md:pb-0">
      <div className="md:border-border flex min-w-0 flex-1 flex-col md:border-r">
        <div className="border-border bg-background/95 sticky top-0 z-10 flex h-[var(--header-height)] shrink-0 items-center border-b px-6 backdrop-blur-sm">
          <h1 className="font-heading text-foreground text-lg font-semibold">
            Profil
          </h1>
        </div>

        {isAdmin && renderAdminSection('md:hidden border-b p-6')}

        <div className="md:hidden">
          <ProfileRightPanel
            email={email}
            displayName={displayName}
            subscriptionStatus={subscriptionStatus}
            avatar_url={currentAvatarUrl}
          />
        </div>

        <div className="space-y-4 p-6">
          {isAdmin && renderAdminSection('hidden md:block border p-6')}

          <div className="border-border space-y-2 border p-6">
            <p className="text-muted-foreground text-xs tracking-[0.15em] uppercase">
              Račun
            </p>
            {displayName && (
              <p className="text-foreground font-medium">{displayName}</p>
            )}
            <p className="text-muted-foreground text-sm">{email}</p>
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
          avatar_url={currentAvatarUrl}
        />
      </aside>
    </main>
  )
}
