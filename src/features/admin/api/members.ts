import { createClient } from '@/lib/supabase/client'

export async function toggleMemberAccess(userId: string, grantAccess: boolean): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('profiles')
    .update({ subscription_status: grantAccess ? 'active' : 'canceled' })
    .eq('id', userId)
  if (error) throw error
}
