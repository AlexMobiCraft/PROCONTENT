import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// --- Моки подняты до импортов ---

// Рассылка вынесена в чистую функцию — route только делегирует в неё.
const { mockSendNewPostNotification } = vi.hoisted(() => {
  const mockSendNewPostNotification = vi.fn()
  return { mockSendNewPostNotification }
})

vi.mock('@/lib/notifications/sendNewPostNotification', () => ({
  sendNewPostNotification: mockSendNewPostNotification,
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

describe('POST /api/notifications/new-post', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('NOTIFICATION_API_SECRET', API_SECRET)
    mockSendNewPostNotification.mockResolvedValue({ sent: 2, failed: 0 })
  })

  describe('Authorization', () => {
    it('возвращает 401 без заголовка авторизации', async () => {
      mockCreateServerClient.mockResolvedValue({
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      })

      const req = makeRequest(VALID_POST)
      const res = await POST(req)
      expect(res.status).toBe(401)
      expect(mockSendNewPostNotification).not.toHaveBeenCalled()
    })

    it('принимает валидный NOTIFICATION_API_SECRET', async () => {
      const req = makeRequest(VALID_POST, { Authorization: `Bearer ${API_SECRET}` })
      const res = await POST(req)
      expect(res.status).toBe(200)
    })

    it('отклоняет неверный секрет', async () => {
      mockCreateServerClient.mockResolvedValue({
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      })

      const req = makeRequest(VALID_POST, { Authorization: 'Bearer wrong-secret' })
      const res = await POST(req)
      expect(res.status).toBe(401)
    })

    it('отклоняет secret той же длины, но другого значения (hash timingSafeEqual)', async () => {
      const sameLength = 'x'.repeat(API_SECRET.length)
      mockCreateServerClient.mockResolvedValue({
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      })

      const req = makeRequest(VALID_POST, { Authorization: `Bearer ${sameLength}` })
      const res = await POST(req)
      expect(res.status).toBe(401)
    })

    it('принимает сессию admin (без Authorization header)', async () => {
      const mockSessionSingle = vi.fn().mockResolvedValue({ data: { role: 'admin' } })
      const mockSessionEq = vi.fn().mockReturnValue({ single: mockSessionSingle })
      const mockSessionSelect = vi.fn().mockReturnValue({ eq: mockSessionEq })
      const mockSessionFrom = vi.fn().mockReturnValue({ select: mockSessionSelect })
      mockGetUser.mockResolvedValue({ data: { user: { id: 'admin-user-id' } } })
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
      const mockSessionSingle = vi.fn().mockResolvedValue({ data: { role: 'member' } })
      const mockSessionEq = vi.fn().mockReturnValue({ single: mockSessionSingle })
      const mockSessionSelect = vi.fn().mockReturnValue({ eq: mockSessionEq })
      const mockSessionFrom = vi.fn().mockReturnValue({ select: mockSessionSelect })
      mockGetUser.mockResolvedValue({ data: { user: { id: 'regular-user-id' } } })
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
      expect(mockSendNewPostNotification).not.toHaveBeenCalled()
    })

    it('возвращает 400 при rawBody = null', async () => {
      const req = new NextRequest('http://localhost/api/notifications/new-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_SECRET}` },
        body: 'null',
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
  })

  describe('Делегирование в sendNewPostNotification', () => {
    it('вызывает функцию с распарсенным post и возвращает sent/failed', async () => {
      mockSendNewPostNotification.mockResolvedValue({ sent: 5, failed: 1 })
      const req = makeRequest(
        { id: VALID_UUID, title: 'Test Post Title', excerpt: 'Анонс' },
        { Authorization: `Bearer ${API_SECRET}` }
      )
      const res = await POST(req)
      const body = await res.json()

      expect(mockSendNewPostNotification).toHaveBeenCalledOnce()
      expect(mockSendNewPostNotification).toHaveBeenCalledWith({
        id: VALID_UUID,
        title: 'Test Post Title',
        excerpt: 'Анонс',
      })
      expect(res.status).toBe(200)
      expect(body).toEqual({ sent: 5, failed: 1 })
    })

    it('partial-fail (failed > 0) всё равно возвращает HTTP 200', async () => {
      mockSendNewPostNotification.mockResolvedValue({ sent: 1, failed: 1 })
      const req = makeRequest(VALID_POST, { Authorization: `Bearer ${API_SECRET}` })
      const res = await POST(req)
      expect(res.status).toBe(200)
    })

    it('возвращает 500 если функция бросает (hard-ошибка)', async () => {
      mockSendNewPostNotification.mockRejectedValue(
        new Error('[notifications] NEXT_PUBLIC_SITE_URL is not configured')
      )
      const req = makeRequest(VALID_POST, { Authorization: `Bearer ${API_SECRET}` })
      const res = await POST(req)
      expect(res.status).toBe(500)
      const body = await res.json()
      expect(body.error).toBeTruthy()
    })
  })

  describe('Supabase Webhook payload format', () => {
    it('извлекает post из {type, table, record} и передаёт в функцию', async () => {
      const webhookBody = {
        type: 'INSERT',
        table: 'posts',
        schema: 'public',
        record: { id: VALID_UUID, title: 'Webhook Post Title' },
        old_record: null,
      }
      const req = makeRequest(webhookBody, { Authorization: `Bearer ${API_SECRET}` })
      const res = await POST(req)

      expect(res.status).toBe(200)
      expect(mockSendNewPostNotification).toHaveBeenCalledWith(
        expect.objectContaining({ id: VALID_UUID, title: 'Webhook Post Title' })
      )
    })
  })
})
