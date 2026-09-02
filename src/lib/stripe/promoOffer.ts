/**
 * Метка временного предложения: €29 за 3 месяца без автопродления.
 *
 * Проставляется checkout-роутом одновременно на Checkout Session (`metadata`)
 * и на будущую подписку (`subscription_data.metadata`). Вебхук по этой метке
 * отличает promo-подписку от обычной recurring и отключает ей автопродление.
 *
 * Checkout API не умеет задавать отмену при создании сессии — `cancel_at_period_end`
 * существует только на `subscriptions.create/update`, поэтому флаг ставится
 * уже после создания подписки.
 */
export const PROMO_OFFER_CODE = 'promo_29_3m'

/**
 * Акция включена, только если переменная содержит похожий на настоящий Stripe Price ID.
 *
 * Простой `Boolean(...)` считал бы режим включённым при любом непустом значении —
 * в том числе при плейсхолдере `price_...` из `.env.example` или при пробеле.
 * Тогда лендинг показал бы акцию, у которой каждый checkout падает с 500.
 * Одна и та же проверка используется и на странице, и в checkout-роуте.
 */
export function isPromoPriceId(value: string | undefined): value is string {
  return typeof value === 'string' && /^price_[A-Za-z0-9_-]{6,}$/.test(value.trim())
}
