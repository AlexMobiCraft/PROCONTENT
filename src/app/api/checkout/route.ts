export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { PROMO_OFFER_CODE, isPromoPriceId } from '@/lib/stripe/promoOffer'
import type { CheckoutPlan } from '@/features/landing/api/checkout'

type Plan = CheckoutPlan

function isPlan(value: unknown): value is Plan {
  return value === 'monthly' || value === 'quarterly' || value === 'promo'
}

export async function POST(request: Request) {
  let body: unknown

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Некорректный формат запроса' }, { status: 400 })
  }

  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Некорректный формат запроса' }, { status: 400 })
  }

  if (!('plan' in (body as object))) {
    return NextResponse.json({ error: 'Некорректный формат запроса' }, { status: 400 })
  }

  const { plan } = body as { plan: unknown }

  if (!isPlan(plan)) {
    return NextResponse.json({ error: 'Некорректный тариф' }, { status: 400 })
  }

  const promoPriceId = process.env.STRIPE_PROMO_PRICE_ID
  const isPromoActive = isPromoPriceId(promoPriceId)

  // Во время акции месячный и квартальный тарифы недоступны. UI их скрывает, но без
  // этой проверки прямой POST в обход интерфейса всё ещё создавал бы recurring-подписку
  // с автопродлением — ровно то, что акция должна была временно убрать.
  if (isPromoActive && plan !== 'promo') {
    return NextResponse.json({ error: 'Некорректный тариф' }, { status: 400 })
  }

  // Литеральное чтение process.env — статический доступ надёжен при любой стратегии
  // сборки, в отличие от динамического process.env[key].
  let priceId: string | undefined
  if (plan === 'promo') {
    priceId = isPromoActive ? promoPriceId : undefined
  } else if (plan === 'monthly') {
    priceId = process.env.STRIPE_MONTHLY_PRICE_ID
  } else {
    priceId = process.env.STRIPE_QUARTERLY_PRICE_ID
  }

  if (!priceId) {
    console.error(`[checkout] Отсутствует переменная окружения для тарифа: ${plan}`)
    return NextResponse.json({ error: 'Конфигурация тарифа недоступна' }, { status: 500 })
  }

  const rawSiteUrl = process.env.NEXT_PUBLIC_SITE_URL
  if (!rawSiteUrl) {
    console.error('[checkout] Отсутствует переменная окружения NEXT_PUBLIC_SITE_URL')
    return NextResponse.json({ error: 'Конфигурация сервера недоступна' }, { status: 500 })
  }
  const siteUrl = rawSiteUrl.replace(/\/$/, '')

  // Promo — подписка, которая не продлевается: Stripe списывает €29 один раз,
  // через 3 месяца сам отменяет её и присылает customer.subscription.deleted,
  // на котором существующий вебхук снимает доступ. Промокоды поверх акции отключены.
  const isPromo = plan === 'promo'

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${siteUrl}/register?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/#pricing`,
      locale: 'sl',
      allow_promotion_codes: !isPromo,
      ...(isPromo
        ? {
            subscription_data: { metadata: { offer: PROMO_OFFER_CODE } },
            metadata: { offer: PROMO_OFFER_CODE },
            custom_text: {
              submit: {
                message:
                  'Enkratno plačilo za 3 mesece dostopa. Naročnina se ne podaljša samodejno.',
              },
            },
          }
        : {}),
    })

    return NextResponse.json({ url: session.url }, { status: 200 })
  } catch (error) {
    console.error('[checkout] Ошибка Stripe при создании сессии:', error)
    return NextResponse.json({ error: 'Ошибка при создании сессии' }, { status: 500 })
  }
}
