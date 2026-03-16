import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockPortalSessionsCreate = vi.hoisted(() => vi.fn())
const mockGetUser = vi.hoisted(() => vi.fn())
const mockSingle = vi.hoisted(() => vi.fn())
const mockConsumePortalRateLimit = vi.hoisted(() => vi.fn())

vi.mock('@/lib/stripe', () => ({
  stripe: {
    billingPortal: {
      sessions: {
        create: mockPortalSessionsCreate,
      },
    },
  },
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: mockSingle,
    })),
  })),
}))

vi.mock('@/lib/stripe/portal-rate-limit', () => ({
  consumePortalRateLimit: mockConsumePortalRateLimit,
}))

import { POST } from '@/app/api/stripe/portal/route'

const makeRequest = (url = 'http://localhost:3000/api/stripe/portal') =>
  new Request(url, { method: 'POST' })

describe('POST /api/stripe/portal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } } })
    mockSingle.mockResolvedValue({ data: { stripe_customer_id: 'cus_test123' } })
    mockConsumePortalRateLimit.mockReturnValue({ allowed: true })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('возвращает URL портала при успешном запросе', async () => {
    mockPortalSessionsCreate.mockResolvedValueOnce({
      url: 'https://billing.stripe.com/session/test',
    })

    const response = await POST(makeRequest())
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({ url: 'https://billing.stripe.com/session/test' })
    expect(mockPortalSessionsCreate).toHaveBeenCalledWith({
      customer: 'cus_test123',
      return_url: 'http://localhost:3000/profile',
    })
  })

  it('устанавливает Cache-Control: no-store в успешном ответе', async () => {
    mockPortalSessionsCreate.mockResolvedValueOnce({
      url: 'https://billing.stripe.com/session/test',
    })

    const response = await POST(makeRequest())

    expect(response.headers.get('Cache-Control')).toBe('no-store')
  })

  it('использует returnUrl переданный клиентом (надёжно за reverse proxy), если он совпадает с origin', async () => {
    mockPortalSessionsCreate.mockResolvedValueOnce({
      url: 'https://billing.stripe.com/session/test',
    })

    const request = new Request('https://myapp.example.com/api/stripe/portal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ returnUrl: 'https://myapp.example.com/profile' }),
    })

    await POST(request)

    expect(mockPortalSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        return_url: 'https://myapp.example.com/profile',
      })
    )
  })

  it('блокирует subdomain-spoofing: returnUrl начинается с origin, но принадлежит другому домену', async () => {
    mockPortalSessionsCreate.mockResolvedValueOnce({
      url: 'https://billing.stripe.com/session/test',
    })

    const request = new Request('https://procontent.ru/api/stripe/portal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ returnUrl: 'https://procontent.ru.evil.com/profile' }),
    })

    await POST(request)

    expect(mockPortalSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        return_url: 'https://procontent.ru/profile',
      })
    )
  })

  it('игнорирует returnUrl от клиента, если он указывает на другой домен (защита от Open Redirect)', async () => {
    mockPortalSessionsCreate.mockResolvedValueOnce({
      url: 'https://billing.stripe.com/session/test',
    })

    const request = new Request('http://localhost:3000/api/stripe/portal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ returnUrl: 'https://evil-phishing.com/profile' }),
    })

    await POST(request)

    expect(mockPortalSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        return_url: 'http://localhost:3000/profile',
      })
    )
  })

  it('использует NEXT_PUBLIC_SITE_URL вместо request.url.origin (надёжно за reverse proxy)', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://procontent.ru'
    mockPortalSessionsCreate.mockResolvedValueOnce({
      url: 'https://billing.stripe.com/session/test',
    })

    // request.url указывает на внутренний Docker/Vercel-адрес
    const request = new Request('http://172.16.0.1/api/stripe/portal', { method: 'POST' })
    await POST(request)

    expect(mockPortalSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        return_url: 'https://procontent.ru/profile',
      })
    )
    delete process.env.NEXT_PUBLIC_SITE_URL
  })

  it('использует origin из URL запроса для return_url если клиент не прислал returnUrl', async () => {
    mockPortalSessionsCreate.mockResolvedValueOnce({
      url: 'https://billing.stripe.com/session/test',
    })

    await POST(makeRequest('https://procontent.ru/api/stripe/portal'))

    expect(mockPortalSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        return_url: 'https://procontent.ru/profile',
      })
    )
  })

  it('возвращает 401 при отсутствии авторизации', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } })

    const response = await POST(makeRequest())
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data).toHaveProperty('error')
    expect(mockPortalSessionsCreate).not.toHaveBeenCalled()
  })

  it('возвращает 400 если stripe_customer_id равен null', async () => {
    mockSingle.mockResolvedValueOnce({ data: { stripe_customer_id: null } })

    const response = await POST(makeRequest())
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data).toHaveProperty('error')
    expect(mockPortalSessionsCreate).not.toHaveBeenCalled()
  })

  it('возвращает 400 если профиль не найден', async () => {
    mockSingle.mockResolvedValueOnce({ data: null })

    const response = await POST(makeRequest())
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data).toHaveProperty('error')
    expect(mockPortalSessionsCreate).not.toHaveBeenCalled()
  })

  it('возвращает 400 при PGRST116 (профиль не найден — ожидаемый кейс, не фатальная ошибка)', async () => {
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' },
    })

    const response = await POST(makeRequest())
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data).toHaveProperty('error')
    expect(mockPortalSessionsCreate).not.toHaveBeenCalled()
  })

  it('возвращает 500 при ошибке Supabase (фатальная ошибка БД)', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: { code: 'PGRST301', message: 'DB connection error' } })

    const response = await POST(makeRequest())
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data).toHaveProperty('error')
    expect(mockPortalSessionsCreate).not.toHaveBeenCalled()
  })

  it('возвращает 429 при превышении rate limit', async () => {
    mockConsumePortalRateLimit.mockReturnValueOnce({ allowed: false })

    const response = await POST(makeRequest())
    const data = await response.json()

    expect(response.status).toBe(429)
    expect(data).toHaveProperty('error')
    expect(mockPortalSessionsCreate).not.toHaveBeenCalled()
  })

  it('устанавливает Retry-After: 60 заголовок в ответе 429', async () => {
    mockConsumePortalRateLimit.mockReturnValueOnce({ allowed: false })

    const response = await POST(makeRequest())

    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBe('60')
  })

  it('не падает если NEXT_PUBLIC_SITE_URL содержит невалидный URL (safe catch block)', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'not-a-valid-url'
    mockPortalSessionsCreate.mockResolvedValueOnce({
      url: 'https://billing.stripe.com/session/test',
    })

    // Запрос без тела → catch block в returnUrl-логике; NEXT_PUBLIC_SITE_URL невалиден → fallback на request.url
    const request = new Request('http://localhost:3000/api/stripe/portal', { method: 'POST' })
    const response = await POST(request)

    // Функция не должна падать; Stripe получает корректный return_url
    expect(response.status).toBe(200)
    expect(mockPortalSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        return_url: 'http://localhost:3000/profile',
      })
    )
    delete process.env.NEXT_PUBLIC_SITE_URL
  })

  it('возвращает 500 при ошибке Stripe с понятным сообщением', async () => {
    mockPortalSessionsCreate.mockRejectedValueOnce(new Error('Stripe connection error'))

    const response = await POST(makeRequest())
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data).toHaveProperty('error')
    expect(data.error).toContain('Не удалось открыть портал')
  })
})
