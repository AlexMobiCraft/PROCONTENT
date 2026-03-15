'use client'

import { SubscriptionCard } from './SubscriptionCard'

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
    <main className="mx-auto max-w-lg space-y-8 px-4 py-12">
      <h1 className="font-heading text-2xl font-semibold text-foreground">Профиль</h1>

      <div className="space-y-2 border border-border p-6">
        <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">Аккаунт</p>
        {displayName && <p className="font-medium text-foreground">{displayName}</p>}
        <p className="text-sm text-muted-foreground">{email}</p>
      </div>

      <SubscriptionCard
        subscriptionStatus={subscriptionStatus}
        currentPeriodEnd={currentPeriodEnd}
        hasStripeCustomer={hasStripeCustomer}
      />
    </main>
  )
}
