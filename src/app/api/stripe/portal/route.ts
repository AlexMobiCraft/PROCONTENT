export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

import { stripe } from '@/lib/stripe'
import { consumePortalRateLimit } from '@/lib/stripe/portal-rate-limit'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
  }

  const { allowed } = consumePortalRateLimit(user.id)
  if (!allowed) {
    return NextResponse.json(
      { error: 'Слишком много запросов. Попробуйте позже.' },
      { status: 429 }
    )
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single()

  if (profileError) {
    console.error('[stripe/portal] Ошибка загрузки профиля:', profileError)
    return NextResponse.json(
      { error: 'Ошибка загрузки профиля. Попробуйте позже.' },
      { status: 500 }
    )
  }

  if (!profile?.stripe_customer_id) {
    return NextResponse.json({ error: 'Аккаунт Stripe не найден' }, { status: 400 })
  }

  const origin = new URL(request.url).origin

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${origin}/profile`,
    })

    return NextResponse.json(
      { url: session.url },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[stripe/portal] Ошибка при создании сессии портала:', message)
    return NextResponse.json(
      { error: 'Не удалось открыть портал управления подпиской. Попробуйте позже.' },
      { status: 500 }
    )
  }
}
