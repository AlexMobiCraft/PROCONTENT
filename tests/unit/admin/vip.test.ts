import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// --- Моки ---
const { mockRequireAdmin, mockInvite, mockDeleteUser, mockRpc, mockFrom } = vi.hoisted(() => ({
  mockRequireAdmin: vi.fn(),
  mockInvite: vi.fn(),
  mockDeleteUser: vi.fn(),
  mockRpc: vi.fn(),
  mockFrom: vi.fn(),
}))

// Гибкий мок query-builder Supabase: update/eq/or → возвращают сам объект (chainable),
// select → Promise(result), а сам объект thenable (для цепочек, кончающихся на .eq()).
let queryResult: unknown
let lastQuery: Record<string, ReturnType<typeof vi.fn> | unknown>

function makeQuery() {
  const q: Record<string, unknown> = {}
  q.update = vi.fn(() => q)
  q.eq = vi.fn(() => q)
  q.or = vi.fn(() => q)
  q.select = vi.fn(() => q)
  q.maybeSingle = vi.fn(() => Promise.resolve(queryResult))
  q.single = vi.fn(() => Promise.resolve(queryResult))
  // thenable: цепочки, кончающиеся на .select()/.eq(), резолвятся через await
  q.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
    Promise.resolve(queryResult).then(res, rej)
  lastQuery = q
  return q
}

const mockAdminClient = {
  from: (...args: unknown[]) => {
    mockFrom(...args)
    return makeQuery()
  },
  rpc: mockRpc,
  auth: { admin: { inviteUserByEmail: mockInvite, deleteUser: mockDeleteUser } },
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockAdminClient),
}))

vi.mock('@/lib/supabase/requireAdmin', () => ({
  requireAdmin: mockRequireAdmin,
}))

import { POST, PATCH, DELETE } from '@/app/api/admin/vip/route'
import { applyVipRevocation } from '@/lib/stripe/vipRevocation'

function makeRequest(method: string, body?: unknown): NextRequest {
  return new NextRequest('http://localhost/api/admin/vip', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

describe('/api/admin/vip', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key')
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://procontent.si')
    mockRequireAdmin.mockResolvedValue({ ok: true, userId: 'admin-1' })
    queryResult = { data: [{ id: 'u1' }], error: null }
  })

  describe('POST — выдача VIP', () => {
    it('403 для не-админа, мутация не выполнена', async () => {
      mockRequireAdmin.mockResolvedValue({ ok: false, status: 403 })
      const res = await POST(makeRequest('POST', { email: 'a@b.si', first_name: 'Ana' }))
      expect(res.status).toBe(403)
      expect(mockInvite).not.toHaveBeenCalled()
      expect(mockFrom).not.toHaveBeenCalled()
    })

    it('400 при невалидном email / пустом first_name (Zod)', async () => {
      const res = await POST(makeRequest('POST', { email: 'abc', first_name: '' }))
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toBe('validation')
    })

    it('200 для нового email: invite + is_vip=true', async () => {
      mockInvite.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
      queryResult = { data: [{ id: 'u1' }], error: null }

      const res = await POST(makeRequest('POST', { email: 'new@b.si', first_name: 'Ana' }))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.ok).toBe(true)
      expect(body.existing).toBe(false)
      expect(mockInvite).toHaveBeenCalledOnce()
      expect(lastQuery.update).toHaveBeenCalledWith({ is_vip: true })
    })

    it('conditional update использует явную NULL-ветку (Rule 1)', async () => {
      mockInvite.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
      queryResult = { data: [{ id: 'u1' }], error: null }

      await POST(makeRequest('POST', { email: 'new@b.si', first_name: 'Ana' }))
      expect(lastQuery.or).toHaveBeenCalledWith(
        'subscription_status.is.null,subscription_status.not.in.(active,trialing)'
      )
    })

    it('subscription_status=NULL (новый пользователь) → 200 (mock: update задел строку)', async () => {
      mockInvite.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
      queryResult = { data: [{ id: 'u1' }], error: null }
      const res = await POST(makeRequest('POST', { email: 'new@b.si', first_name: 'Ana' }))
      expect(res.status).toBe(200)
    })

    it('существующий email (422): lookup через RPC, без повторного invite', async () => {
      mockInvite.mockResolvedValue({
        data: null,
        error: { status: 422, message: 'User already registered' },
      })
      mockRpc.mockResolvedValue({ data: 'u2', error: null })
      queryResult = { data: [{ id: 'u2' }], error: null }

      const res = await POST(makeRequest('POST', { email: 'old@b.si', first_name: 'Ana' }))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.existing).toBe(true)
      expect(mockInvite).toHaveBeenCalledOnce()
      expect(mockRpc).toHaveBeenCalledWith('get_auth_user_id_by_email', { p_email: 'old@b.si' })
    })

    it('email с активной подпиской → 409 (conditional update 0 строк)', async () => {
      mockInvite.mockResolvedValue({ data: { user: { id: 'u3' } }, error: null })
      queryResult = { data: [], error: null }

      const res = await POST(makeRequest('POST', { email: 'paid@b.si', first_name: 'Ana' }))
      expect(res.status).toBe(409)
      const body = await res.json()
      expect(body.error).toBe('active_subscription')
    })

    it('гонка 23514 при grant → 409', async () => {
      mockInvite.mockResolvedValue({ data: { user: { id: 'u3' } }, error: null })
      queryResult = { data: null, error: { code: '23514', message: 'chk_vip_xor_active' } }

      const res = await POST(makeRequest('POST', { email: 'race@b.si', first_name: 'Ana' }))
      expect(res.status).toBe(409)
    })

    it('500 при отсутствии env', async () => {
      vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '')
      const res = await POST(makeRequest('POST', { email: 'a@b.si', first_name: 'Ana' }))
      expect(res.status).toBe(500)
    })
  })

  describe('PATCH — suspend / resume', () => {
    it('suspend: is_vip=false, идемпотентно, 200', async () => {
      queryResult = { error: null }
      const res = await PATCH(makeRequest('PATCH', { userId: 'u1', action: 'suspend' }))
      expect(res.status).toBe(200)
      expect(lastQuery.update).toHaveBeenCalledWith({ is_vip: false })
      expect(lastQuery.eq).toHaveBeenCalledWith('is_vip', true)
    })

    it('resume + активная подписка → 409', async () => {
      queryResult = { data: [], error: null }
      const res = await PATCH(makeRequest('PATCH', { userId: 'u1', action: 'resume' }))
      expect(res.status).toBe(409)
    })

    it('resume успешно → 200', async () => {
      queryResult = { data: [{ id: 'u1' }], error: null }
      const res = await PATCH(makeRequest('PATCH', { userId: 'u1', action: 'resume' }))
      expect(res.status).toBe(200)
    })

    it('403 для не-админа', async () => {
      mockRequireAdmin.mockResolvedValue({ ok: false, status: 403 })
      const res = await PATCH(makeRequest('PATCH', { userId: 'u1', action: 'suspend' }))
      expect(res.status).toBe(403)
    })

    it('400 при неизвестном action', async () => {
      const res = await PATCH(makeRequest('PATCH', { userId: 'u1', action: 'nope' }))
      expect(res.status).toBe(400)
    })
  })

  describe('DELETE — удаление аккаунта', () => {
    it('200 для не-админа цели, вызывает auth.admin.deleteUser', async () => {
      queryResult = { data: { role: 'member' }, error: null }
      mockDeleteUser.mockResolvedValue({ error: null })
      const res = await DELETE(makeRequest('DELETE', { userId: 'u1' }))
      expect(res.status).toBe(200)
      expect(mockDeleteUser).toHaveBeenCalledWith('u1')
    })

    it('403 при попытке удалить администратора, deleteUser не вызван', async () => {
      queryResult = { data: { role: 'admin' }, error: null }
      const res = await DELETE(makeRequest('DELETE', { userId: 'admin-2' }))
      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.error).toBe('cannot_delete_admin')
      expect(mockDeleteUser).not.toHaveBeenCalled()
    })

    it('403 для не-админа вызывающего, удаление не выполнено', async () => {
      mockRequireAdmin.mockResolvedValue({ ok: false, status: 403 })
      const res = await DELETE(makeRequest('DELETE', { userId: 'u1' }))
      expect(res.status).toBe(403)
      expect(mockDeleteUser).not.toHaveBeenCalled()
    })

    it('400 при отсутствии userId', async () => {
      const res = await DELETE(makeRequest('DELETE', {}))
      expect(res.status).toBe(400)
    })
  })
})

describe('applyVipRevocation (Rule 2)', () => {
  it('active → добавляет is_vip=false', () => {
    const u: { subscription_status?: string; is_vip?: boolean } = { subscription_status: 'active' }
    applyVipRevocation(u)
    expect(u.is_vip).toBe(false)
  })

  it('trialing → добавляет is_vip=false', () => {
    const u: { subscription_status?: string; is_vip?: boolean } = { subscription_status: 'trialing' }
    applyVipRevocation(u)
    expect(u.is_vip).toBe(false)
  })

  it('ID-only привязка (нет subscription_status) → is_vip НЕ трогается', () => {
    const u: { stripe_customer_id?: string; is_vip?: boolean } = { stripe_customer_id: 'cus_1' }
    applyVipRevocation(u)
    expect(u.is_vip).toBeUndefined()
  })

  it('inactive/canceled → is_vip НЕ трогается (VIP не восстанавливается)', () => {
    const inactive: { subscription_status?: string; is_vip?: boolean } = {
      subscription_status: 'inactive',
    }
    applyVipRevocation(inactive)
    expect(inactive.is_vip).toBeUndefined()

    const canceled: { subscription_status?: string; is_vip?: boolean } = {
      subscription_status: 'canceled',
    }
    applyVipRevocation(canceled)
    expect(canceled.is_vip).toBeUndefined()
  })

  it('идемпотентность: повторный вызов даёт тот же результат', () => {
    const u: { subscription_status?: string; is_vip?: boolean } = { subscription_status: 'active' }
    applyVipRevocation(u)
    applyVipRevocation(u)
    expect(u.is_vip).toBe(false)
  })
})
