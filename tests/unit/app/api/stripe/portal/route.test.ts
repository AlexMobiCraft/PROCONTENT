import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockPortalSessionsCreate = vi.hoisted(() => vi.fn())
const mockGetUser = vi.hoisted(() => vi.fn())
const mockSingle = vi.hoisted(() => vi.fn())

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

import { POST } from '@/app/api/stripe/portal/route'

const makeRequest = (url = 'http://localhost:3000/api/stripe/portal') =>
  new Request(url, { method: 'POST' })

describe('POST /api/stripe/portal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } } })
    mockSingle.mockResolvedValue({ data: { stripe_customer_id: 'cus_test123' } })
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

  it('использует origin из URL запроса для return_url', async () => {
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

  it('возвращает 400 при ошибке Supabase (нет stripe_customer_id)', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'DB connection error' } })

    const response = await POST(makeRequest())
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data).toHaveProperty('error')
    expect(mockPortalSessionsCreate).not.toHaveBeenCalled()
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
