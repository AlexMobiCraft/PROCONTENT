export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/supabase/requireAdmin'
import { VipCreateSchema } from '@/features/admin/types'
import type { Database } from '@/types/supabase'

type ProfileUpdate = Database['public']['Tables']['profiles']['Update']

// Условие conditional update is_vip=true: только если подписка НЕ активна/триальна.
// Явная ветка is.null обязательна — `NULL NOT IN (...)` в SQL даёт NULL (не true),
// иначе новый пользователь без подписки давал бы 0 строк → ложный 409.
const VIP_GRANT_FILTER = 'subscription_status.is.null,subscription_status.not.in.(active,trialing)'

function getEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  return { url, key, siteUrl }
}

function createAdminClient(url: string, key: string) {
  return createSupabaseAdminClient<Database>(url, key)
}

type AdminClient = ReturnType<typeof createAdminClient>

/** Атомарный conditional update is_vip=true (Правило 1 / 1а). 0 строк → активная подписка. */
async function grantVip(
  supabase: AdminClient,
  userId: string
): Promise<{ ok: true } | { ok: false; reason: 'active_subscription' | 'error' }> {
  const { data, error } = await supabase
    .from('profiles')
    .update({ is_vip: true } satisfies ProfileUpdate)
    .eq('id', userId)
    .or(VIP_GRANT_FILTER)
    .select('id')

  if (error) {
    // 23514 = chk_vip_xor_active: гонка, подписка стала активной между чтением и записью.
    if (error.code === '23514') return { ok: false, reason: 'active_subscription' }
    console.error('[vip] grant error:', error.message)
    return { ok: false, reason: 'error' }
  }

  if (!data || data.length === 0) return { ok: false, reason: 'active_subscription' }
  return { ok: true }
}

/**
 * POST /api/admin/vip — выдать VIP по email.
 * Новый email → invite-письмо + is_vip=true. Существующий (422) → lookup через RPC + is_vip=true,
 * без повторного invite.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const { url, key, siteUrl } = getEnv()
  if (!url || !key || !siteUrl) {
    return NextResponse.json({ error: 'server_misconfiguration' }, { status: 500 })
  }

  const admin = await requireAdmin()
  if (!admin.ok) {
    return NextResponse.json({ error: 'forbidden' }, { status: admin.status })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const parsed = VipCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation', fields: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }
  const { email, first_name } = parsed.data

  try {
    const supabase = createAdminClient(url, key)

    // 1) Создаём пользователя через invite (письмо для установки пароля).
    const { data: invited, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
      email,
      {
        redirectTo: `${siteUrl}/update-password`,
        data: { first_name },
      }
    )

    let userId: string
    let existing = false

    if (inviteError) {
      // 422 = email уже зарегистрирован. Находим userId через RPC (O(1), case-insensitive),
      // НЕ через listUsers (анти-паттерн, отвергнут в проекте). Повторный invite не шлём.
      if (inviteError.status === 422) {
        existing = true
        const { data: foundId, error: rpcError } = await supabase.rpc(
          'get_auth_user_id_by_email',
          { p_email: email }
        )
        if (rpcError) {
          console.error('[vip] RPC lookup error:', rpcError.message)
          return NextResponse.json({ error: 'lookup_failed' }, { status: 500 })
        }
        if (!foundId) {
          return NextResponse.json({ error: 'user_not_found' }, { status: 404 })
        }
        userId = foundId
      } else {
        console.error('[vip] invite error:', inviteError.message)
        return NextResponse.json({ error: 'invite_failed' }, { status: 500 })
      }
    } else {
      userId = invited.user.id
    }

    // 2) Атомарный conditional update is_vip (профиль создаётся триггером синхронно).
    const granted = await grantVip(supabase, userId)
    if (!granted.ok) {
      if (granted.reason === 'active_subscription') {
        return NextResponse.json({ error: 'active_subscription' }, { status: 409 })
      }
      return NextResponse.json({ error: 'grant_failed' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, existing, userId }, { status: 200 })
  } catch (err) {
    console.error('[vip] POST exception:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}

/**
 * PATCH /api/admin/vip — suspend (is_vip=false) или resume (is_vip=true, conditional).
 * Body: { userId, action: 'suspend' | 'resume' }
 */
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const { url, key } = getEnv()
  if (!url || !key) {
    return NextResponse.json({ error: 'server_misconfiguration' }, { status: 500 })
  }

  const admin = await requireAdmin()
  if (!admin.ok) {
    return NextResponse.json({ error: 'forbidden' }, { status: admin.status })
  }

  let body: { userId?: string; action?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  if (!body.userId || (body.action !== 'suspend' && body.action !== 'resume')) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }

  try {
    const supabase = createAdminClient(url, key)

    if (body.action === 'suspend') {
      // Снятие VIP идемпотентно. Доступ теряется после истечения TTL кэш-куки участницы.
      const { error } = await supabase
        .from('profiles')
        .update({ is_vip: false } satisfies ProfileUpdate)
        .eq('id', body.userId)
        .eq('is_vip', true)
      if (error) {
        console.error('[vip] suspend error:', error.message)
        return NextResponse.json({ error: 'suspend_failed' }, { status: 500 })
      }
      return NextResponse.json({ ok: true }, { status: 200 })
    }

    // resume — тот же conditional update, что и POST grant (Правило 1а). 0 строк → 409.
    const granted = await grantVip(supabase, body.userId)
    if (!granted.ok) {
      if (granted.reason === 'active_subscription') {
        return NextResponse.json({ error: 'active_subscription' }, { status: 409 })
      }
      return NextResponse.json({ error: 'resume_failed' }, { status: 500 })
    }
    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (err) {
    console.error('[vip] PATCH exception:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/vip — удалить аккаунт (auth-юзер + каскадно профиль).
 * Body: { userId }. FK profiles.id → auth.users имеет ON DELETE CASCADE.
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const { url, key } = getEnv()
  if (!url || !key) {
    return NextResponse.json({ error: 'server_misconfiguration' }, { status: 500 })
  }

  const admin = await requireAdmin()
  if (!admin.ok) {
    return NextResponse.json({ error: 'forbidden' }, { status: admin.status })
  }

  let body: { userId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  if (!body.userId) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }

  try {
    const supabase = createAdminClient(url, key)

    // Guard: удаление администраторов запрещено через этот эндпоинт.
    // deleteUser необратим — защищаем от случайного/злонамеренного сноса admin-аккаунта.
    const { data: target, error: lookupError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', body.userId)
      .maybeSingle()
    if (lookupError) {
      console.error('[vip] delete lookup error:', lookupError.message)
      return NextResponse.json({ error: 'delete_failed' }, { status: 500 })
    }
    if (target?.role === 'admin') {
      return NextResponse.json({ error: 'cannot_delete_admin' }, { status: 403 })
    }

    const { error } = await supabase.auth.admin.deleteUser(body.userId)
    if (error) {
      console.error('[vip] delete error:', error.message)
      return NextResponse.json({ error: 'delete_failed' }, { status: 500 })
    }
    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (err) {
    console.error('[vip] DELETE exception:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
