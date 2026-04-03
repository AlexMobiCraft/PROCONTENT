import { createClient } from '@/lib/supabase/server'
import type { ScheduledPost } from '../types'

export async function fetchScheduledPostsServer(): Promise<ScheduledPost[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('posts')
    .select('id, title, category, status, scheduled_at, created_at')
    .eq('status', 'scheduled')
    .order('scheduled_at', { ascending: true })
  if (error) throw error
  return data ?? []
}
