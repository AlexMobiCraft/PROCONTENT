'use client'

import { SubscriptionCard } from './SubscriptionCard'
import { ProfileRightPanel } from './ProfileRightPanel'

interface ProfileScreenProps {
  email: string
  displayName: string | null
  subscriptionStatus: string | null
  currentPeriodEnd: string | null
  hasStripeCustomer: boolean
}

export function ProfileScreen({
  email,
  displayName,
  subscriptionStatus,
  currentPeriodEnd,
  hasStripeCustomer,
}: ProfileScreenProps) {
  return (
    <main className="flex min-h-screen flex-col pb-[60px] md:flex-row md:pb-0">
      {/* Центральная колонка: аккаунт + подписка */}
      <div className="flex min-w-0 flex-1 flex-col md:border-r md:border-border">
        <div className="sticky top-0 z-10 flex h-[var(--header-height)] shrink-0 items-center border-b border-border bg-background/95 px-6 backdrop-blur-sm">
          <h1 className="font-heading text-lg font-semibold text-foreground">Profil</h1>
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
