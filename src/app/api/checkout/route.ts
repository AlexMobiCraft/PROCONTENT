import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'

export async function POST(request: Request) {
  let body: unknown

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Некорректный формат запроса' }, { status: 400 })
  }

  const { plan } = body as { plan: unknown }

  if (plan !== 'monthly' && plan !== 'quarterly') {
    return NextResponse.json({ error: 'Некорректный тариф' }, { status: 400 })
  }

  const priceId =
    plan === 'monthly'
      ? process.env.STRIPE_MONTHLY_PRICE_ID
      : process.env.STRIPE_QUARTERLY_PRICE_ID

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/onboarding?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/#pricing`,
      locale: 'sl',
      allow_promotion_codes: true,
    })

    return NextResponse.json({ url: session.url }, { status: 200 })
  } catch {
    return NextResponse.json({ error: 'Ошибка при создании сессии' }, { status: 500 })
  }
}
