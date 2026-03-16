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
      { status: 429, headers: { 'Retry-After': '60' } }
    )
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single()

  if (profileError) {
    // PGRST116: no rows found — профиль не найден, это ожидаемый кейс (не фатальная ошибка БД)
    if ((profileError as { code?: string }).code === 'PGRST116') {
      return NextResponse.json({ error: 'Аккаунт Stripe не найден' }, { status: 400 })
    }
    console.error('[stripe/portal] Ошибка загрузки профиля:', profileError)
    return NextResponse.json(
      { error: 'Ошибка загрузки профиля. Попробуйте позже.' },
      { status: 500 }
    )
  }

  if (!profile?.stripe_customer_id) {
    return NextResponse.json({ error: 'Аккаунт Stripe не найден' }, { status: 400 })
  }

  // Клиент передаёт свой origin для надёжной работы за reverse proxy
  let returnUrl: string
  try {
    const body = (await request.json()) as { returnUrl?: unknown }
    const clientReturnUrl = typeof body?.returnUrl === 'string' ? body.returnUrl : null
    
    // Используем NEXT_PUBLIC_SITE_URL для надёжного определения хоста (за reverse proxy/Docker/Vercel
    // request.url может содержать внутренний адрес, например http://172.16.0.1/...)
    const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL
      ? new URL(process.env.NEXT_PUBLIC_SITE_URL).origin
      : new URL(request.url).origin
    let isValidReturnUrl = false
    if (clientReturnUrl) {
      try {
        isValidReturnUrl = new URL(clientReturnUrl).origin === siteOrigin
      } catch {
        isValidReturnUrl = false
      }
    }
    returnUrl = isValidReturnUrl ? clientReturnUrl! : `${siteOrigin}/profile`
  } catch {
    // Безопасный парсинг: NEXT_PUBLIC_SITE_URL может отсутствовать протокол — оборачиваем в try/catch
    let siteOrigin: string
    try {
      siteOrigin = process.env.NEXT_PUBLIC_SITE_URL
        ? new URL(process.env.NEXT_PUBLIC_SITE_URL).origin
        : new URL(request.url).origin
    } catch {
      siteOrigin = new URL(request.url).origin
    }
    returnUrl = `${siteOrigin}/profile`
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: returnUrl,
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
