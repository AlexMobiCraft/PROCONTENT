import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHmac } from 'crypto'
import { NextRequest } from 'next/server'

// Мок admin Supabase-клиента
const {
  mockProfileSingle,
  mockProfileSelect,
  mockUpdateEq,
  mockUpdate,
  mockAdminFrom,
  mockCreateAdminClient,
} = vi.hoisted(() => {
  const mockProfileSingle = vi.fn()
  const mockProfileEq = vi.fn(() => ({ single: mockProfileSingle }))
  const mockProfileSelect = vi.fn(() => ({ eq: mockProfileEq }))
  const mockUpdateEq = vi.fn()
  const mockUpdate = vi.fn(() => ({ eq: mockUpdateEq }))
  const mockAdminFrom = vi.fn()
  const mockCreateAdminClient = vi.fn(() => ({ from: mockAdminFrom }))
  return {
    mockProfileSingle,
    mockProfileSelect,
    mockUpdateEq,
    mockUpdate,
    mockAdminFrom,
    mockCreateAdminClient,
  }
})

vi.mock('@supabase/supabase-js', () => ({
  createClient: mockCreateAdminClient,
}))

import { GET, POST } from '@/app/api/email/unsubscribe/route'

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000'
const API_SECRET = 'test-unsubscribe-secret'

function generateToken(uid: string, secret: string, offsetSeconds = 0) {
  const ts = Math.floor(Date.now() / 1000) - offsetSeconds
  const canonical = `${uid}:${ts}`
  const sig = createHmac('sha256', secret).update(canonical).digest('hex')
  return { uid, ts: String(ts), sig }
}

function makeGetRequest(params: Record<string, string>): NextRequest {
  const url = new URL('http://localhost/api/email/unsubscribe')
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }
  return new NextRequest(url.toString(), { method: 'GET' })
}

function makePostRequest(params: Record<string, string>): NextRequest {
  const url = new URL('http://localhost/api/email/unsubscribe')
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }
  return new NextRequest(url.toString(), { method: 'POST' })
}

describe('GET /api/email/unsubscribe', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('NOTIFICATION_API_SECRET', API_SECRET)
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key')

    // Дефолт: профиль существует, обновление успешно
    mockAdminFrom.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: mockProfileSelect,
          update: mockUpdate,
        }
      }
      return {}
    })
    mockProfileSingle.mockResolvedValue({ data: { id: VALID_UUID }, error: null })
    mockUpdateEq.mockResolvedValue({ error: null })
  })

  it('редиректит на /email-preferences?status=unsubscribed при валидном токене', async () => {
    const { uid, ts, sig } = generateToken(VALID_UUID, API_SECRET)
    const req = makeGetRequest({ uid, ts, sig })
    const res = await GET(req)

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/email-preferences?status=unsubscribed')
  })

  it('редиректит на /email-preferences?status=invalid_or_expired при невалидной подписи', async () => {
    const { uid, ts } = generateToken(VALID_UUID, API_SECRET)
    const req = makeGetRequest({ uid, ts, sig: 'invalid-sig' })
    const res = await GET(req)

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/email-preferences?status=invalid_or_expired')
  })

  it('редиректит на invalid_or_expired при истекшем токене (> 30 дней)', async () => {
    const expiredOffset = 31 * 24 * 60 * 60 // 31 день назад
    const { uid, ts, sig } = generateToken(VALID_UUID, API_SECRET, expiredOffset)
    const req = makeGetRequest({ uid, ts, sig })
    const res = await GET(req)

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/email-preferences?status=invalid_or_expired')
  })

  it('редиректит на invalid_or_expired при timestamp из будущего', async () => {
    const futureTs = String(Math.floor(Date.now() / 1000) + 3600)
    const canonical = `${VALID_UUID}:${futureTs}`
    const sig = createHmac('sha256', API_SECRET).update(canonical).digest('hex')
    const req = makeGetRequest({ uid: VALID_UUID, ts: futureTs, sig })
    const res = await GET(req)

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/email-preferences?status=invalid_or_expired')
  })

  it('редиректит на invalid_or_expired при невалидном UUID', async () => {
    const ts = String(Math.floor(Date.now() / 1000))
    const canonical = `not-a-uuid:${ts}`
    const sig = createHmac('sha256', API_SECRET).update(canonical).digest('hex')
    const req = makeGetRequest({ uid: 'not-a-uuid', ts, sig })
    const res = await GET(req)

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/email-preferences?status=invalid_or_expired')
  })

  it('редиректит на invalid_or_expired при отсутствующем профиле', async () => {
    mockProfileSingle.mockResolvedValue({ data: null, error: { code: 'PGRST116' } })

    const { uid, ts, sig } = generateToken(VALID_UUID, API_SECRET)
    const req = makeGetRequest({ uid, ts, sig })
    const res = await GET(req)

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/email-preferences?status=invalid_or_expired')
  })

  it('редиректит на invalid_or_expired если отсутствует uid/ts/sig', async () => {
    const req = makeGetRequest({})
    const res = await GET(req)

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/email-preferences?status=invalid_or_expired')
  })

  it('повторный запрос (идемпотентность) редиректит на unsubscribed', async () => {
    // Профиль уже с email_notifications_enabled=false — update всё равно успешен
    mockUpdateEq.mockResolvedValue({ error: null })

    const { uid, ts, sig } = generateToken(VALID_UUID, API_SECRET)
    const req = makeGetRequest({ uid, ts, sig })
    const res = await GET(req)

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/email-preferences?status=unsubscribed')
  })
})

describe('POST /api/email/unsubscribe (one-click RFC 8058)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('NOTIFICATION_API_SECRET', API_SECRET)
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key')

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: mockProfileSelect,
          update: mockUpdate,
        }
      }
      return {}
    })
    mockProfileSingle.mockResolvedValue({ data: { id: VALID_UUID }, error: null })
    mockUpdateEq.mockResolvedValue({ error: null })
  })

  it('возвращает 200 text/plain OK при валидном токене', async () => {
    const { uid, ts, sig } = generateToken(VALID_UUID, API_SECRET)
    const req = makePostRequest({ uid, ts, sig })
    const res = await POST(req)

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/plain')
    expect(await res.text()).toBe('OK')
  })

  it('возвращает 400 text/plain при невалидной подписи', async () => {
    const { uid, ts } = generateToken(VALID_UUID, API_SECRET)
    const req = makePostRequest({ uid, ts, sig: 'wrong-sig' })
    const res = await POST(req)

    expect(res.status).toBe(400)
    expect(res.headers.get('content-type')).toContain('text/plain')
  })

  it('возвращает 400 при истекшем токене', async () => {
    const expiredOffset = 31 * 24 * 60 * 60
    const { uid, ts, sig } = generateToken(VALID_UUID, API_SECRET, expiredOffset)
    const req = makePostRequest({ uid, ts, sig })
    const res = await POST(req)

    expect(res.status).toBe(400)
  })

  it('возвращает 400 при timestamp из будущего', async () => {
    const futureTs = String(Math.floor(Date.now() / 1000) + 3600)
    const canonical = `${VALID_UUID}:${futureTs}`
    const sig = createHmac('sha256', API_SECRET).update(canonical).digest('hex')
    const req = makePostRequest({ uid: VALID_UUID, ts: futureTs, sig })
    const res = await POST(req)

    expect(res.status).toBe(400)
  })

  it('возвращает 400 при malformed params (отсутствует ts)', async () => {
    const { uid, sig } = generateToken(VALID_UUID, API_SECRET)
    const req = makePostRequest({ uid, sig })
    const res = await POST(req)

    expect(res.status).toBe(400)
  })

  it('возвращает 400 при отсутствующем профиле', async () => {
    mockProfileSingle.mockResolvedValue({ data: null, error: { code: 'PGRST116' } })

    const { uid, ts, sig } = generateToken(VALID_UUID, API_SECRET)
    const req = makePostRequest({ uid, ts, sig })
    const res = await POST(req)

    expect(res.status).toBe(400)
  })

  it('повторный запрос (идемпотентность) возвращает 200 OK', async () => {
    mockUpdateEq.mockResolvedValue({ error: null })

    const { uid, ts, sig } = generateToken(VALID_UUID, API_SECRET)
    const req = makePostRequest({ uid, ts, sig })
    const res = await POST(req)

    expect(res.status).toBe(200)
    expect(await res.text()).toBe('OK')
  })

  it('обновляет email_notifications_enabled=false через admin client', async () => {
    const { uid, ts, sig } = generateToken(VALID_UUID, API_SECRET)
    const req = makePostRequest({ uid, ts, sig })
    await POST(req)

    expect(mockUpdate).toHaveBeenCalledWith({ email_notifications_enabled: false })
    expect(mockUpdateEq).toHaveBeenCalledWith('id', VALID_UUID)
  })
})
