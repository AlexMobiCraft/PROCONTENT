export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'

type Plan = 'monthly' | 'quarterly'

function isPlan(value: unknown): value is Plan {
  return value === 'monthly' || value === 'quarterly'
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

  const priceId =
    plan === 'monthly'
      ? process.env.STRIPE_MONTHLY_PRICE_ID
      : process.env.STRIPE_QUARTERLY_PRICE_ID

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

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${siteUrl}/onboarding?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/#pricing`,
      locale: 'sl',
      allow_promotion_codes: true,
    })

    return NextResponse.json({ url: session.url }, { status: 200 })
  } catch (error) {
    console.error('[checkout] Ошибка Stripe при создании сессии:', error)
    return NextResponse.json({ error: 'Ошибка при создании сессии' }, { status: 500 })
  }
}
