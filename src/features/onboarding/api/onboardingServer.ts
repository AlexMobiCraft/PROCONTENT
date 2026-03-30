import { createClient } from '@/lib/supabase/server'

export interface OnboardingPost {
  id: string
  title: string
  category: string
  type: string
}

/**
 * Получает до 5 onboarding-постов из БД для страницы /onboarding.
 * Используется только в Server Components.
 */
export async function getOnboardingPosts(): Promise<OnboardingPost[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('posts')
    .select('id, title, category, type')
    .eq('is_onboarding', true)
    .eq('is_published', true)
    .order('updated_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(5)

  if (error) {
    console.error('[onboarding] Napaka pri nalaganju objav:', error)
    return []
  }
  return data ?? []
}
