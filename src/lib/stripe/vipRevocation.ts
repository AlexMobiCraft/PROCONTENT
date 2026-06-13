import type { Database } from '@/types/supabase'

type ProfileUpdate = Database['public']['Tables']['profiles']['Update']

/**
 * Правило 2 (VIP): при переходе подписки в active/trialing VIP снимается безвозвратно
 * тем же UPDATE, что пишет subscription_status. Вставка УСЛОВНА — только когда реально
 * пишется active/trialing. На ID-only привязке (checkout с payment_status≠paid: пишутся
 * только stripe_*-IDs, subscription_status отсутствует) is_vip НЕ трогаем, иначе
 * преждевременно снимем VIP у не оплатившего. Webhook НИКОГДА не ставит is_vip=true.
 */
export function applyVipRevocation(updateData: ProfileUpdate): void {
  if (
    updateData.subscription_status === 'active' ||
    updateData.subscription_status === 'trialing'
  ) {
    updateData.is_vip = false
  }
}
