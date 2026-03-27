import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// --- Моки подняты до импортов ---

const { mockSendEmailBatch } = vi.hoisted(() => {
  const mockSendEmailBatch = vi.fn()
  return { mockSendEmailBatch }
})

vi.mock('@/lib/email', () => ({
  sendEmailBatch: mockSendEmailBatch,
}))

// Мок admin Supabase-клиента (createClient из @supabase/supabase-js)
// Используется для запроса активных подписчиков
const { mockAdminEq, mockAdminSelect, mockAdminFrom, mockCreateAdminClient } = vi.hoisted(() => {
  const mockAdminEq = vi.fn()
  const mockAdminSelect = vi.fn(() => ({ eq: mockAdminEq }))
  const mockAdminFrom = vi.fn(() => ({ select: mockAdminSelect }))
  const mockCreateAdminClient = vi.fn(() => ({ from: mockAdminFrom }))
  return { mockAdminEq, mockAdminSelect, mockAdminFrom, mockCreateAdminClient }
})

vi.mock('@supabase/supabase-js', () => ({
  createClient: mockCreateAdminClient,
}))

const { mockGetUser, mockCreateServerClient } = vi.hoisted(() => {
  const mockGetUser = vi.fn()
  const mockCreateServerClient = vi.fn()
  return { mockGetUser, mockCreateServerClient }
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: mockCreateServerClient,
}))

import { POST } from '@/app/api/notifications/new-post/route'

// Хелперы
function makeRequest(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost/api/notifications/new-post', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000'
const VALID_POST = { id: VALID_UUID, title: 'Test Post Title' }
const API_SECRET = 'test-secret-key'

const ACTIVE_SUBSCRIBERS = [
  { email: 'user1@example.com', display_name: 'Ana' },
  { email: 'user2@example.com', display_name: null },
]

describe('POST /api/notifications/new-post', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('NOTIFICATION_API_SECRET', API_SECRET)
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key')
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://procontent.si')
    vi.stubEnv('RESEND_API_KEY', 're_test_key')
    vi.stubEnv('RESEND_FROM_EMAIL', 'noreply@procontent.si')

    // Дефолтный мок: admin client возвращает активных подписчиков
    mockAdminFrom.mockReturnValue({ select: mockAdminSelect })
    mockAdminSelect.mockReturnValue({ eq: mockAdminEq })
    mockAdminEq.mockResolvedValue({ data: ACTIVE_SUBSCRIBERS, error: null })

    mockSendEmailBatch.mockResolvedValue({ sent: 2, failed: 0 })
  })

  describe('Authorization', () => {
    it('возвращает 401 без заголовка авторизации', async () => {
      mockCreateServerClient.mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
        },
      })

      const req = makeRequest(VALID_POST)
      const res = await POST(req)
      expect(res.status).toBe(401)
    })

    it('принимает валидный NOTIFICATION_API_SECRET', async () => {
      const req = makeRequest(VALID_POST, { Authorization: `Bearer ${API_SECRET}` })
      const res = await POST(req)
      expect(res.status).toBe(200)
    })

    it('отклоняет неверный секрет', async () => {
      mockCreateServerClient.mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
        },
      })

      const req = makeRequest(VALID_POST, { Authorization: 'Bearer wrong-secret' })
      const res = await POST(req)
      expect(res.status).toBe(401)
    })

    it('принимает сессию admin', async () => {
      vi.stubEnv('NOTIFICATION_API_SECRET', '')

      const adminUser = { id: 'admin-user-id' }
      mockGetUser.mockResolvedValue({ data: { user: adminUser } })

      const mockSessionSingle = vi.fn().mockResolvedValue({ data: { role: 'admin' } })
      const mockSessionEq = vi.fn().mockReturnValue({ single: mockSessionSingle })
      const mockSessionSelect = vi.fn().mockReturnValue({ eq: mockSessionEq })
      const mockSessionFrom = vi.fn().mockReturnValue({ select: mockSessionSelect })

      mockCreateServerClient.mockResolvedValue({
        auth: { getUser: mockGetUser },
        from: mockSessionFrom,
      })

      const req = makeRequest(VALID_POST)
      const res = await POST(req)
      expect(res.status).toBe(200)
    })

    it('отклоняет сессию не-admin', async () => {
      vi.stubEnv('NOTIFICATION_API_SECRET', '')

      const regularUser = { id: 'regular-user-id' }
      mockGetUser.mockResolvedValue({ data: { user: regularUser } })

      const mockSessionSingle = vi.fn().mockResolvedValue({ data: { role: 'member' } })
      const mockSessionEq = vi.fn().mockReturnValue({ single: mockSessionSingle })
      const mockSessionSelect = vi.fn().mockReturnValue({ eq: mockSessionEq })
      const mockSessionFrom = vi.fn().mockReturnValue({ select: mockSessionSelect })

      mockCreateServerClient.mockResolvedValue({
        auth: { getUser: mockGetUser },
        from: mockSessionFrom,
      })

      const req = makeRequest(VALID_POST)
      const res = await POST(req)
      expect(res.status).toBe(401)
    })
  })

  describe('Request validation', () => {
    it('возвращает 400 при невалидном JSON', async () => {
      const req = new NextRequest('http://localhost/api/notifications/new-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_SECRET}` },
        body: 'not-json',
      })
      const res = await POST(req)
      expect(res.status).toBe(400)
    })

    it('возвращает 400 при отсутствии id', async () => {
      const req = makeRequest({ title: 'Post title' }, { Authorization: `Bearer ${API_SECRET}` })
      const res = await POST(req)
      expect(res.status).toBe(400)
    })

    it('возвращает 400 при отсутствии title', async () => {
      const req = makeRequest({ id: VALID_UUID }, { Authorization: `Bearer ${API_SECRET}` })
      const res = await POST(req)
      expect(res.status).toBe(400)
    })

    it('возвращает 400 при невалидном UUID в id', async () => {
      const req = makeRequest(
        { id: 'not-a-uuid', title: 'Test' },
        { Authorization: `Bearer ${API_SECRET}` }
      )
      const res = await POST(req)
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toContain('UUID')
    })

    it('возвращает 500 при отсутствии NEXT_PUBLIC_SITE_URL', async () => {
      vi.stubEnv('NEXT_PUBLIC_SITE_URL', '')
      const req = makeRequest(VALID_POST, { Authorization: `Bearer ${API_SECRET}` })
      const res = await POST(req)
      expect(res.status).toBe(500)
    })
  })

  describe('Email sending', () => {
    it('возвращает 200 и sent/failed при успехе', async () => {
      const req = makeRequest(VALID_POST, { Authorization: `Bearer ${API_SECRET}` })
      const res = await POST(req)
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.sent).toBe(2)
      expect(body.failed).toBe(0)
    })

    it('вызывает sendEmailBatch с правильным количеством сообщений', async () => {
      const req = makeRequest(VALID_POST, { Authorization: `Bearer ${API_SECRET}` })
      await POST(req)

      expect(mockSendEmailBatch).toHaveBeenCalledOnce()
      const [messages] = mockSendEmailBatch.mock.calls[0] as [unknown[]]
      expect(messages).toHaveLength(2)
    })

    it('формирует правильный subject письма', async () => {
      const req = makeRequest(VALID_POST, { Authorization: `Bearer ${API_SECRET}` })
      await POST(req)

      const [messages] = mockSendEmailBatch.mock.calls[0] as [Array<{ subject: string }>]
      expect(messages[0].subject).toBe('Nova objava: Test Post Title')
    })

    it('включает имя получателя в HTML', async () => {
      const req = makeRequest(VALID_POST, { Authorization: `Bearer ${API_SECRET}` })
      await POST(req)

      const [messages] = mockSendEmailBatch.mock.calls[0] as [Array<{ html: string }>]
      expect(messages[0].html).toContain('Ana')
    })

    it('формирует URL поста через /feed/', async () => {
      const req = makeRequest(VALID_POST, { Authorization: `Bearer ${API_SECRET}` })
      await POST(req)

      const [messages] = mockSendEmailBatch.mock.calls[0] as [Array<{ html: string }>]
      expect(messages[0].html).toContain(`/feed/${VALID_UUID}`)
      expect(messages[0].html).not.toContain(`/post/${VALID_UUID}`)
    })

    it('возвращает { sent: 0 } при отсутствии активных подписчиков', async () => {
      mockAdminEq.mockResolvedValue({ data: [], error: null })

      const req = makeRequest(VALID_POST, { Authorization: `Bearer ${API_SECRET}` })
      const res = await POST(req)
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.sent).toBe(0)
      expect(mockSendEmailBatch).not.toHaveBeenCalled()
    })

    it('фильтрует подписчиков с null/пустым email', async () => {
      mockAdminEq.mockResolvedValue({
        data: [
          { email: 'valid@example.com', display_name: 'Valid' },
          { email: null, display_name: 'No Email' },
          { email: '', display_name: 'Empty Email' },
        ],
        error: null,
      })
      mockSendEmailBatch.mockResolvedValue({ sent: 1, failed: 0 })

      const req = makeRequest(VALID_POST, { Authorization: `Bearer ${API_SECRET}` })
      await POST(req)

      const [messages] = mockSendEmailBatch.mock.calls[0] as [unknown[]]
      expect(messages).toHaveLength(1)
    })

    it('возвращает 500 при ошибке запроса к БД', async () => {
      mockAdminEq.mockResolvedValue({ data: null, error: { message: 'DB error' } })

      const req = makeRequest(VALID_POST, { Authorization: `Bearer ${API_SECRET}` })
      const res = await POST(req)

      expect(res.status).toBe(500)
    })

    it('возвращает 500 при ошибке sendEmailBatch', async () => {
      mockSendEmailBatch.mockRejectedValue(new Error('RESEND_API_KEY is not configured'))

      const req = makeRequest(VALID_POST, { Authorization: `Bearer ${API_SECRET}` })
      const res = await POST(req)

      expect(res.status).toBe(500)
    })

    it('не создаёт двойной слэш когда SITE_URL заканчивается на /', async () => {
      vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://procontent.si/')

      const req = makeRequest(VALID_POST, { Authorization: `Bearer ${API_SECRET}` })
      await POST(req)

      const [messages] = mockSendEmailBatch.mock.calls[0] as [Array<{ html: string }>]
      expect(messages[0].html).not.toContain('//feed/')
      expect(messages[0].html).toContain('/feed/')
    })

    it('передаёт excerpt в сгенерированное письмо', async () => {
      const postWithExcerpt = { ...VALID_POST, excerpt: 'Краткий анонс поста.' }
      const req = makeRequest(postWithExcerpt, { Authorization: `Bearer ${API_SECRET}` })
      await POST(req)

      const [messages] = mockSendEmailBatch.mock.calls[0] as [Array<{ html: string; text: string }>]
      expect(messages[0].html).toContain('Краткий анонс поста.')
      expect(messages[0].text).toContain('Краткий анонс поста.')
    })
  })

  describe('Authorization security', () => {
    it('отклоняет secret той же длины, но другого значения', async () => {
      // Проверяем что hash-based timingSafeEqual правильно отклоняет matching-length secrets
      const sameLength = 'x'.repeat(API_SECRET.length)
      mockCreateServerClient.mockResolvedValue({
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      })

      const req = makeRequest(VALID_POST, { Authorization: `Bearer ${sameLength}` })
      const res = await POST(req)
      expect(res.status).toBe(401)
    })

    it('отклоняет secret неверной длины', async () => {
      mockCreateServerClient.mockResolvedValue({
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      })

      const req = makeRequest(VALID_POST, { Authorization: 'Bearer short' })
      const res = await POST(req)
      expect(res.status).toBe(401)
    })
  })
})
