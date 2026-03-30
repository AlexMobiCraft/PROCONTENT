import { OnboardingScreen } from '@/features/onboarding/components/OnboardingScreen'
import { getOnboardingPosts } from '@/features/onboarding/api/onboardingServer'
import { getSettingsServer } from '@/features/admin/api/settingsServer'

export const dynamic = 'force-dynamic'

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>
}) {
  const { session_id: sessionId } = await searchParams

  if (sessionId) {
    console.info('[onboarding] session_id:', sessionId)
  }

  const [posts, settings] = await Promise.all([
    getOnboardingPosts(),
    getSettingsServer().catch(() => ({ whatsapp_url: 'https://chat.whatsapp.com/placeholder' })),
  ])

  return (
    <OnboardingScreen
      posts={posts}
      whatsappUrl={settings.whatsapp_url}
    />
  )
}
