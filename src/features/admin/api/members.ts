import { createClient } from '@/lib/supabase/client'

export async function toggleMemberAccess(userId: string, grantAccess: boolean): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('profiles')
    .update({ subscription_status: grantAccess ? 'active' : 'canceled' })
    .eq('id', userId)
  if (error) {
    // 23514 = нарушение chk_vip_xor_active: нельзя активировать подписку VIP-пользователю.
    // Понятное сообщение для toast вместо сырого текста ошибки констрейнта.
    if (error.code === '23514') {
      throw new Error('Uporabnik je VIP — najprej prekličite VIP status')
    }
    throw error
  }
}
