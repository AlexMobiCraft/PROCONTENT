import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// --- Моки подняты до импортов ---

// Мок цепочки Supabase update для posts
const {
  mockSelect,
  mockIs,
  mockLte,
  mockEq,
  mockUpdate,
  mockFrom,
  mockCreateAdminClient,
} = vi.hoisted(() => {
  const mockSelect = vi.fn()
  const mockIs = vi.fn(() => ({ select: mockSelect }))
  const mockLte = vi.fn(() => ({ is: mockIs }))
  const mockEq = vi.fn(() => ({ lte: mockLte }))
  const mockUpdate = vi.fn(() => ({ eq: mockEq }))
  const mockFrom = vi.fn(() => ({ update: mockUpdate }))
  const mockCreateAdminClient = vi.fn(() => ({ from: mockFrom }))
  return { mockSelect, mockIs, mockLte, mockEq, mockUpdate, mockFrom, mockCreateAdminClient }
})

vi.mock('@supabase/supabase-js', () => ({
  createClient: mockCreateAdminClient,
}))

// Рассылка вынесена в чистую функцию — cron вызывает её напрямую (без self-fetch).
const { mockSendNewPostNotification } = vi.hoisted(() => {
  const mockSendNewPostNotification = vi.fn()
  return { mockSendNewPostNotification }
})
vi.mock('@/lib/notifications/sendNewPostNotification', () => ({
  sendNewPostNotification: mockSendNewPostNotification,
}))

import { POST } from '@/app/api/cron/publish/route'

// Хелперы
const CRON_SECRET = 'test-cron-secret'

function makeRequest(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost/api/cron/publish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

function makeAuthorizedRequest(): NextRequest {
  return makeRequest({ Authorization: `Bearer ${CRON_SECRET}` })
}

const PUBLISHED_POSTS = [
  { id: '11111111-1111-1111-1111-111111111111', title: 'Post One', excerpt: 'Excerpt one' },
  { id: '22222222-2222-2222-2222-222222222222', title: 'Post Two', excerpt: null },
]

describe('POST /api/cron/publish', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('CRON_SECRET', CRON_SECRET)
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key')

    // Дефолтный мок: атомарный UPDATE возвращает опубликованные посты
    mockFrom.mockReturnValue({ update: mockUpdate })
    mockUpdate.mockReturnValue({ eq: mockEq })
    mockEq.mockReturnValue({ lte: mockLte })
    mockLte.mockReturnValue({ is: mockIs })
    mockIs.mockReturnValue({ select: mockSelect })
    mockSelect.mockResolvedValue({ data: PUBLISHED_POSTS, error: null })

    mockSendNewPostNotification.mockResolvedValue({ sent: 1, failed: 0 })
  })

  // --- AC1: Авторизация ---

  it('возвращает 401 если Authorization заголовок отсутствует', async () => {
    const req = makeRequest()
    const res = await POST(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('возвращает 401 если токен неверный', async () => {
    const req = makeRequest({ Authorization: 'Bearer wrong-token' })
    const res = await POST(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('возвращает 500 если CRON_SECRET не настроен', async () => {
    vi.stubEnv('CRON_SECRET', '')
    const req = makeAuthorizedRequest()
    const res = await POST(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Server misconfiguration')
  })

  // --- AC2: Атомарная публикация ---

  it('возвращает 200 и список опубликованных постов при валидном запросе', async () => {
    const req = makeAuthorizedRequest()
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.published).toBe(2)
    expect(body.emailErrors).toEqual([])
  })

  it('выполняет UPDATE с правильными условиями (status=scheduled, scheduled_at<=now, published_at IS NULL)', async () => {
    const req = makeAuthorizedRequest()
    await POST(req)

    expect(mockFrom).toHaveBeenCalledWith('posts')
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'published', published_at: expect.any(String) })
    )
    expect(mockEq).toHaveBeenCalledWith('status', 'scheduled')
    expect(mockLte).toHaveBeenCalledWith('scheduled_at', expect.any(String))
    expect(mockIs).toHaveBeenCalledWith('published_at', null)
    expect(mockSelect).toHaveBeenCalledWith('id, title, excerpt')
  })

  it('возвращает published=0 если нет постов для публикации', async () => {
    mockSelect.mockResolvedValue({ data: [], error: null })
    const req = makeAuthorizedRequest()
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.published).toBe(0)
    expect(mockSendNewPostNotification).not.toHaveBeenCalled()
  })

  // --- AC3: Email-уведомления (прямой вызов функции) ---

  it('вызывает sendNewPostNotification для каждого опубликованного поста (без self-fetch)', async () => {
    const req = makeAuthorizedRequest()
    await POST(req)

    expect(mockSendNewPostNotification).toHaveBeenCalledTimes(2)
    expect(mockSendNewPostNotification).toHaveBeenNthCalledWith(1, {
      id: PUBLISHED_POSTS[0].id,
      title: PUBLISHED_POSTS[0].title,
      excerpt: PUBLISHED_POSTS[0].excerpt,
    })
    expect(mockSendNewPostNotification).toHaveBeenNthCalledWith(2, {
      id: PUBLISHED_POSTS[1].id,
      title: PUBLISHED_POSTS[1].title,
      excerpt: PUBLISHED_POSTS[1].excerpt,
    })
  })

  // --- AC4: Идемпотентность ---

  it('повторный запрос не трогает посты с published_at IS NOT NULL (условие в запросе)', async () => {
    mockSelect.mockResolvedValueOnce({ data: PUBLISHED_POSTS, error: null })
    mockSelect.mockResolvedValueOnce({ data: [], error: null })

    const req1 = makeAuthorizedRequest()
    const res1 = await POST(req1)
    expect((await res1.json()).published).toBe(2)

    const req2 = makeAuthorizedRequest()
    const res2 = await POST(req2)
    expect((await res2.json()).published).toBe(0)

    // Рассылка вызвана только в первый раз (2 поста)
    expect(mockSendNewPostNotification).toHaveBeenCalledTimes(2)
  })

  // --- AC5: Изоляция ошибок email (один сбой не валит остальные) ---

  it('сбой рассылки одного поста не прерывает остальные, emailErrors содержит ошибку', async () => {
    mockSendNewPostNotification.mockRejectedValueOnce(new Error('Resend down'))
    mockSendNewPostNotification.mockResolvedValueOnce({ sent: 1, failed: 0 })

    const req = makeAuthorizedRequest()
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()

    // Оба поста опубликованы (DB-обновление было атомарным)
    expect(body.published).toBe(2)
    expect(body.emailErrors).toHaveLength(1)
    expect(body.emailErrors[0].postId).toBe(PUBLISHED_POSTS[0].id)
    expect(body.emailErrors[0].error).toContain('Resend down')
    // Второй вызов всё равно выполнен
    expect(mockSendNewPostNotification).toHaveBeenCalledTimes(2)
  })

  it('env-guard ошибка функции (нет NEXT_PUBLIC_SITE_URL) попадает в emailErrors per-post', async () => {
    mockSendNewPostNotification.mockRejectedValue(
      new Error('[notifications] NEXT_PUBLIC_SITE_URL is not configured')
    )

    const req = makeAuthorizedRequest()
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.published).toBe(2)
    expect(body.emailErrors).toHaveLength(2)
    expect(body.emailErrors[0].error).toContain('NEXT_PUBLIC_SITE_URL')
  })

  // --- Обработка ошибок БД ---

  it('возвращает 500 при ошибке базы данных', async () => {
    mockSelect.mockResolvedValue({ data: null, error: { message: 'DB connection failed' } })
    const req = makeAuthorizedRequest()
    const res = await POST(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Database error')
  })
})
