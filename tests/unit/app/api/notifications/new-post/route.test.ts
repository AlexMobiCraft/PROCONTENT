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
const {
  mockAdminRange,
  mockAdminOrder,
  mockAdminEq,
  mockAdminNot,
  mockAdminIn,
  mockAdminSelect,
  mockAdminFrom,
  mockCreateAdminClient,
} = vi.hoisted(() => {
  const mockAdminRange = vi.fn()
  const mockAdminOrder = vi.fn(() => ({ range: mockAdminRange }))
  const mockAdminEq = vi.fn(() => ({ order: mockAdminOrder }))
  const mockAdminNot = vi.fn(() => ({ eq: mockAdminEq }))
  const mockAdminIn = vi.fn(() => ({ not: mockAdminNot }))
  const mockAdminSelect = vi.fn(() => ({ in: mockAdminIn }))
  const mockAdminFrom = vi.fn(() => ({ select: mockAdminSelect }))
  const mockCreateAdminClient = vi.fn(() => ({ from: mockAdminFrom }))
  return {
    mockAdminRange,
    mockAdminOrder,
    mockAdminEq,
    mockAdminNot,
    mockAdminIn,
    mockAdminSelect,
    mockAdminFrom,
    mockCreateAdminClient,
  }
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

import { POST, PAGE_SIZE } from '@/app/api/notifications/new-post/route'

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
  { id: '11111111-1111-1111-1111-111111111111', email: 'user1@example.com', display_name: 'Ana' },
  { id: '22222222-2222-2222-2222-222222222222', email: 'user2@example.com', display_name: null },
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
    // Цепочка: from → select → in → not → eq → order → range
    mockAdminFrom.mockReturnValue({ select: mockAdminSelect })
    mockAdminSelect.mockReturnValue({ in: mockAdminIn })
    mockAdminIn.mockReturnValue({ not: mockAdminNot })
    mockAdminNot.mockReturnValue({ eq: mockAdminEq })
    mockAdminEq.mockReturnValue({ order: mockAdminOrder })
    mockAdminOrder.mockReturnValue({ range: mockAdminRange })
    mockAdminRange.mockResolvedValue({ data: ACTIVE_SUBSCRIBERS, error: null })

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
      // NOTIFICATION_API_SECRET задан в beforeEach — обязателен для генерации unsubscribe URL.
      // Тест проверяет авторизацию через admin сессию (без Authorization header).
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
      mockAdminRange.mockResolvedValue({ data: [], error: null })

      const req = makeRequest(VALID_POST, { Authorization: `Bearer ${API_SECRET}` })
      const res = await POST(req)
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.sent).toBe(0)
      expect(mockSendEmailBatch).not.toHaveBeenCalled()
    })

    it('фильтрует подписчиков с null/пустым email', async () => {
      mockAdminRange.mockResolvedValue({
        data: [
          { id: '11111111-1111-1111-1111-111111111111', email: 'valid@example.com', display_name: 'Valid' },
          { id: '22222222-2222-2222-2222-222222222222', email: null, display_name: 'No Email' },
          { id: '33333333-3333-3333-3333-333333333333', email: '', display_name: 'Empty Email' },
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
      mockAdminRange.mockResolvedValue({ data: null, error: { message: 'DB error' } })

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

    it('не делает лишний запрос к БД при количестве строк кратном PAGE_SIZE', async () => {
      const exactPage = Array.from({ length: PAGE_SIZE }, (_, i) => ({
        id: `${i.toString().padStart(8, '0')}-0000-0000-0000-000000000000`,
        email: `user${i}@example.com`,
        display_name: null,
      }))

      mockAdminRange.mockResolvedValueOnce({ data: exactPage, error: null })
      mockSendEmailBatch.mockResolvedValue({ sent: PAGE_SIZE, failed: 0 })

      const req = makeRequest(VALID_POST, { Authorization: `Bearer ${API_SECRET}` })
      const res = await POST(req)
      const body = await res.json()

      expect(mockAdminRange).toHaveBeenCalledTimes(1)
      expect(mockAdminRange).toHaveBeenNthCalledWith(1, 0, PAGE_SIZE)
      expect(body.sent).toBe(PAGE_SIZE)
    })

    it('запрашивает вторую страницу, когда первая вернула PAGE_SIZE+1 строк', async () => {
      const page1 = Array.from({ length: PAGE_SIZE + 1 }, (_, i) => ({
        id: `${i.toString().padStart(8, '0')}-0000-0000-0000-000000000000`,
        email: `user${i}@example.com`,
        display_name: null,
      }))
      const page2 = [{ id: 'ffffffff-ffff-ffff-ffff-ffffffffffff', email: 'last@example.com', display_name: 'Last' }]

      mockAdminRange
        .mockResolvedValueOnce({ data: page1, error: null })
        .mockResolvedValueOnce({ data: page2, error: null })
      mockSendEmailBatch.mockResolvedValue({ sent: PAGE_SIZE + 1, failed: 0 })

      const req = makeRequest(VALID_POST, { Authorization: `Bearer ${API_SECRET}` })
      const res = await POST(req)
      const body = await res.json()

      expect(mockAdminRange).toHaveBeenCalledTimes(2)
      expect(mockAdminRange).toHaveBeenNthCalledWith(1, 0, PAGE_SIZE)
      expect(mockAdminRange).toHaveBeenNthCalledWith(2, PAGE_SIZE, PAGE_SIZE * 2)
      expect(body.sent).toBe(PAGE_SIZE + 1)
    })

    it('возвращает 500 при ошибке БД на второй странице', async () => {
      const page1 = Array.from({ length: PAGE_SIZE + 1 }, (_, i) => ({
        id: `${i.toString().padStart(8, '0')}-0000-0000-0000-000000000000`,
        email: `user${i}@example.com`,
        display_name: null,
      }))

      mockAdminRange
        .mockResolvedValueOnce({ data: page1, error: null })
        .mockResolvedValueOnce({ data: null, error: { message: 'DB error on page 2' } })

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

    it('не создаёт двойной слэш когда SITE_URL заканчивается на //', async () => {
      vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://procontent.si//')

      const req = makeRequest(VALID_POST, { Authorization: `Bearer ${API_SECRET}` })
      await POST(req)

      const [messages] = mockSendEmailBatch.mock.calls[0] as [Array<{ html: string }>]
      expect(messages[0].html).not.toContain('//feed/')
      expect(messages[0].html).toContain('/feed/')
    })

    it('не падает при excerpt числом (non-string) — обрабатывает как absent', async () => {
      // excerpt: 123 — не строка, normalizedExcerpt должен стать undefined, без TypeError
      const postWithNumericExcerpt = { id: VALID_UUID, title: 'Test Post', excerpt: 123 }
      const req = makeRequest(postWithNumericExcerpt, { Authorization: `Bearer ${API_SECRET}` })
      const res = await POST(req)

      // Не должно быть 500 (TypeError)
      expect(res.status).toBe(200)
    })

    it('whitespace-only excerpt не рендерится в письме', async () => {
      const postWithBlankExcerpt = { ...VALID_POST, excerpt: '   ' }
      const req = makeRequest(postWithBlankExcerpt, { Authorization: `Bearer ${API_SECRET}` })
      await POST(req)

      const [messages] = mockSendEmailBatch.mock.calls[0] as [Array<{ html: string }>]
      // Блок excerpt не должен появляться (используется CSS-стиль font-size:14px)
      expect(messages[0].html).not.toContain('font-size:14px;color:#6b5e52')
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

  describe('Supabase Webhook payload format', () => {
    it('принимает Supabase DB Webhook формат {type, table, record}', async () => {
      const webhookBody = {
        type: 'INSERT',
        table: 'posts',
        schema: 'public',
        record: VALID_POST,
        old_record: null,
      }
      const req = makeRequest(webhookBody, { Authorization: `Bearer ${API_SECRET}` })
      const res = await POST(req)
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.sent).toBe(2)
    })

    it('корректно передаёт title из record в тему письма', async () => {
      const webhookBody = {
        type: 'INSERT',
        table: 'posts',
        record: { id: VALID_UUID, title: 'Webhook Post Title' },
      }
      const req = makeRequest(webhookBody, { Authorization: `Bearer ${API_SECRET}` })
      await POST(req)

      const [messages] = mockSendEmailBatch.mock.calls[0] as [Array<{ subject: string }>]
      expect(messages[0].subject).toBe('Nova objava: Webhook Post Title')
    })
  })

  describe('Subscriber filtering', () => {
    it('отправляет письма подписчикам со статусом trialing', async () => {
      const trialingSubscribers = [{ id: '11111111-1111-1111-1111-111111111111', email: 'trial@example.com', display_name: 'Trial User' }]
      mockAdminRange.mockResolvedValue({ data: trialingSubscribers, error: null })
      mockSendEmailBatch.mockResolvedValue({ sent: 1, failed: 0 })

      const req = makeRequest(VALID_POST, { Authorization: `Bearer ${API_SECRET}` })
      const res = await POST(req)
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.sent).toBe(1)
      // Проверяем что запрос включает оба статуса
      expect(mockAdminIn).toHaveBeenCalledWith('subscription_status', ['active', 'trialing'])
    })

    it('фильтрует email без символа @', async () => {
      mockAdminRange.mockResolvedValue({
        data: [
          { id: '11111111-1111-1111-1111-111111111111', email: 'valid@example.com', display_name: 'Valid' },
          { id: '22222222-2222-2222-2222-222222222222', email: 'notanemail', display_name: 'No At Sign' },
          { id: '33333333-3333-3333-3333-333333333333', email: 'also-invalid', display_name: 'Another' },
        ],
        error: null,
      })
      mockSendEmailBatch.mockResolvedValue({ sent: 1, failed: 0 })

      const req = makeRequest(VALID_POST, { Authorization: `Bearer ${API_SECRET}` })
      await POST(req)

      const [messages] = mockSendEmailBatch.mock.calls[0] as [unknown[]]
      expect(messages).toHaveLength(1)
    })
  })

  describe('Round 7 security patches', () => {
    it('возвращает 400 при rawBody = null (валидный JSON — не бросает TypeError)', async () => {
      const req = new NextRequest('http://localhost/api/notifications/new-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_SECRET}` },
        body: 'null',
      })
      const res = await POST(req)
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toBeTruthy()
    })

    it('возвращает 500 при отсутствующих Supabase env vars (не бросает неперехваченную ошибку)', async () => {
      vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
      vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '')

      const req = makeRequest(VALID_POST, { Authorization: `Bearer ${API_SECRET}` })
      const res = await POST(req)

      expect(res.status).toBe(500)
      const body = await res.json()
      expect(body.error).toBeTruthy()
    })

    it('удаляет CRLF из заголовка поста для защиты от SMTP-инъекции', async () => {
      const maliciousPost = { id: VALID_UUID, title: 'Title\r\nBcc: attacker@evil.com' }
      const req = makeRequest(maliciousPost, { Authorization: `Bearer ${API_SECRET}` })
      const res = await POST(req)

      expect(res.status).toBe(200)
      const [messages] = mockSendEmailBatch.mock.calls[0] as [
        Array<{ subject: string; html: string; text: string }>,
      ]
      expect(messages[0].subject).not.toContain('\r')
      expect(messages[0].subject).not.toContain('\n')
      expect(messages[0].subject).toBe('Nova objava: TitleBcc: attacker@evil.com')
    })

    it('удаляет CRLF из тела письма (html и text) при вредоносном заголовке', async () => {
      const maliciousPost = { id: VALID_UUID, title: 'Title\r\nInjected: header' }
      const req = makeRequest(maliciousPost, { Authorization: `Bearer ${API_SECRET}` })
      await POST(req)

      const [messages] = mockSendEmailBatch.mock.calls[0] as [
        Array<{ html: string; text: string }>,
      ]
      expect(messages[0].html).not.toContain('\r\n' + 'Injected: header')
      expect(messages[0].text).not.toContain('\r\n' + 'Injected: header')
      expect(messages[0].html).toContain('TitleInjected: header')
      expect(messages[0].text).toContain('TitleInjected: header')
    })
  })

  describe('Email preferences filtering (Story 3.5)', () => {
    it('запрашивает только подписчиков с email_notifications_enabled=true', async () => {
      const req = makeRequest(VALID_POST, { Authorization: `Bearer ${API_SECRET}` })
      await POST(req)

      expect(mockAdminEq).toHaveBeenCalledWith('email_notifications_enabled', true)
    })

    it('генерирует уникальный unsubscribe URL для каждого получателя', async () => {
      const req = makeRequest(VALID_POST, { Authorization: `Bearer ${API_SECRET}` })
      await POST(req)

      const [messages] = mockSendEmailBatch.mock.calls[0] as [Array<{ html: string }>]
      expect(messages).toHaveLength(2)

      const url1 = new URL(
        messages[0].html.match(/api\/email\/unsubscribe\?[^"]+/)?.[0]
          ? `https://procontent.si/${messages[0].html.match(/api\/email\/unsubscribe\?[^"]+/)?.[0]}`
          : 'https://invalid'
      )
      const url2 = new URL(
        messages[1].html.match(/api\/email\/unsubscribe\?[^"]+/)?.[0]
          ? `https://procontent.si/${messages[1].html.match(/api\/email\/unsubscribe\?[^"]+/)?.[0]}`
          : 'https://invalid2'
      )

      // uid разный для каждого подписчика
      expect(url1.searchParams.get('uid')).toBe('11111111-1111-1111-1111-111111111111')
      expect(url2.searchParams.get('uid')).toBe('22222222-2222-2222-2222-222222222222')
    })

    it('письмо содержит /api/email/unsubscribe в footer', async () => {
      const req = makeRequest(VALID_POST, { Authorization: `Bearer ${API_SECRET}` })
      await POST(req)

      const [messages] = mockSendEmailBatch.mock.calls[0] as [Array<{ html: string; text: string }>]
      expect(messages[0].html).toContain('/api/email/unsubscribe')
      expect(messages[0].text).toContain('/api/email/unsubscribe')
    })

    it('сообщения содержат заголовки List-Unsubscribe и List-Unsubscribe-Post', async () => {
      const req = makeRequest(VALID_POST, { Authorization: `Bearer ${API_SECRET}` })
      await POST(req)

      const [messages] = mockSendEmailBatch.mock.calls[0] as [
        Array<{ headers?: Record<string, string> }>,
      ]
      expect(messages[0].headers).toBeDefined()
      expect(messages[0].headers?.['List-Unsubscribe']).toMatch(/^<https:\/\/.*\/api\/email\/unsubscribe/)
      expect(messages[0].headers?.['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click')
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
