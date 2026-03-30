import { createClient } from '@/lib/supabase/server'

export interface LandingPreviewPost {
  id: string
  title: string
  excerpt: string | null
  category: string
  created_at: string
  likes_count: number
  comments_count: number
}

/**
 * Получает до 3 постов для секции preview на публичном лендинге.
 * Использует SECURITY DEFINER RPC для безопасного доступа без открытия
 * анонимного доступа ко всей таблице posts.
 */
export async function getLandingPreviewPosts(): Promise<LandingPreviewPost[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_landing_preview_posts')
  if (error) {
    console.error('[landing] Napaka pri nalaganju predogledov:', error)
    return []
  }
  return data ?? []
}
