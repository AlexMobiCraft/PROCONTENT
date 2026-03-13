import { Suspense } from 'react'

import { OnboardingScreen } from '@/features/onboarding/components/OnboardingScreen'
import { OnboardingScreenSkeleton } from '@/features/onboarding/components/OnboardingScreenSkeleton'
import { ONBOARDING_CONFIG } from '@/features/onboarding/data/onboarding-config'

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>
}) {
  const { session_id: sessionId } = await searchParams

  if (sessionId) {
    console.info('[onboarding] session_id:', sessionId)
  }

  return (
    <Suspense fallback={<OnboardingScreenSkeleton />}>
      <OnboardingScreen
        posts={ONBOARDING_CONFIG.topPosts}
        whatsappUrl={ONBOARDING_CONFIG.whatsappUrl}
      />
    </Suspense>
  )
}
