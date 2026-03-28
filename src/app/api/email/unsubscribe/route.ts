export const dynamic = 'force-dynamic'

import { createHmac, timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TTL_SECONDS = 30 * 24 * 60 * 60 // 30 дней

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('[unsubscribe] Missing Supabase env vars')
  }
  return createSupabaseAdminClient<Database>(url, key)
}

interface TokenValidationResult {
  valid: boolean
  uid?: string
}

function validateToken(
  uid: string | null,
  ts: string | null,
  sig: string | null,
  secret: string
): TokenValidationResult {
  if (!uid || !ts || !sig) return { valid: false }
  if (!UUID_REGEX.test(uid)) return { valid: false }

  const tsNum = Number(ts)
  if (!Number.isInteger(tsNum) || String(tsNum) !== ts) return { valid: false }

  const now = Math.floor(Date.now() / 1000)
  // timestamp из будущего невалиден
  if (tsNum > now) return { valid: false }
  // TTL истёк
  if (now - tsNum > TTL_SECONDS) return { valid: false }

  const canonical = `${uid}:${ts}`
  const expected = createHmac('sha256', secret).update(canonical).digest('hex')

  const sigBuf = Buffer.from(sig, 'hex')
  const expectedBuf = Buffer.from(expected, 'hex')

  if (sigBuf.length !== expectedBuf.length) return { valid: false }
  if (!timingSafeEqual(sigBuf, expectedBuf)) return { valid: false }

  return { valid: true, uid }
}

async function disableNotifications(uid: string): Promise<{ ok: boolean }> {
  let supabase: ReturnType<typeof createAdminClient>
  try {
    supabase = createAdminClient()
  } catch {
    return { ok: false }
  }

  // Проверяем, что профиль существует
  const { data: profile, error: fetchError } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', uid)
    .single()

  if (fetchError || !profile) return { ok: false }

  // Идемпотентное обновление
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ email_notifications_enabled: false })
    .eq('id', uid)

  if (updateError) return { ok: false }
  return { ok: true }
}

/**
 * GET /api/email/unsubscribe?uid=...&ts=...&sig=...
 *
 * Обрабатывает переход по ссылке "Отписаться" в подвале письма.
 * При валидном токене: отписывает и редиректит на /email-preferences?status=unsubscribed
 * При невалидном/истекшем: редиректит на /email-preferences?status=invalid_or_expired
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const uid = searchParams.get('uid')
  const ts = searchParams.get('ts')
  const sig = searchParams.get('sig')

  const secret = process.env.NOTIFICATION_API_SECRET
  if (!secret) {
    return NextResponse.redirect(new URL('/email-preferences?status=invalid_or_expired', request.url))
  }

  const { valid, uid: validUid } = validateToken(uid, ts, sig, secret)
  if (!valid || !validUid) {
    return NextResponse.redirect(new URL('/email-preferences?status=invalid_or_expired', request.url))
  }

  const { ok } = await disableNotifications(validUid)
  if (!ok) {
    return NextResponse.redirect(new URL('/email-preferences?status=invalid_or_expired', request.url))
  }

  return NextResponse.redirect(new URL('/email-preferences?status=unsubscribed', request.url))
}

/**
 * POST /api/email/unsubscribe?uid=...&ts=...&sig=...
 *
 * One-click unsubscribe (RFC 8058) — вызывается email-клиентами (Gmail, Yahoo).
 * При валидном токене: отписывает и возвращает 200 text/plain OK
 * При невалидном/истекшем: возвращает 400 text/plain
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const uid = searchParams.get('uid')
  const ts = searchParams.get('ts')
  const sig = searchParams.get('sig')

  const secret = process.env.NOTIFICATION_API_SECRET
  if (!secret) {
    return new NextResponse('Bad Request', {
      status: 400,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }

  const { valid, uid: validUid } = validateToken(uid, ts, sig, secret)
  if (!valid || !validUid) {
    return new NextResponse('Bad Request', {
      status: 400,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }

  const { ok } = await disableNotifications(validUid)
  if (!ok) {
    return new NextResponse('Bad Request', {
      status: 400,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }

  return new NextResponse('OK', {
    status: 200,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
