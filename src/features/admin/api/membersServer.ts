import { createClient } from '@/lib/supabase/server'
import type { MemberProfile } from '../types'

export async function fetchMembersServer(): Promise<MemberProfile[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select(
      'id, email, display_name, created_at, subscription_status, current_period_end, stripe_customer_id'
    )
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}
