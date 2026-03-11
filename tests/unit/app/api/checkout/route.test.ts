import { describe, expect, it, vi, beforeEach } from 'vitest'

const mockSessionsCreate = vi.hoisted(() => vi.fn())

vi.mock('@/lib/stripe', () => ({
  stripe: {
    checkout: {
      sessions: {
        create: mockSessionsCreate,
      },
    },
  },
}))

import { POST } from '@/app/api/checkout/route'

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/checkout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.STRIPE_MONTHLY_PRICE_ID = 'price_monthly_test'
    process.env.STRIPE_QUARTERLY_PRICE_ID = 'price_quarterly_test'
    process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000'
  })

  it('возвращает URL при тарифе monthly', async () => {
    mockSessionsCreate.mockResolvedValueOnce({ url: 'https://checkout.stripe.com/test-monthly' })

    const response = await POST(makeRequest({ plan: 'monthly' }))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({ url: 'https://checkout.stripe.com/test-monthly' })
    expect(mockSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'subscription',
        line_items: [{ price: 'price_monthly_test', quantity: 1 }],
        locale: 'sl',
        allow_promotion_codes: true,
      })
    )
  })

  it('использует STRIPE_QUARTERLY_PRICE_ID для тарифа quarterly', async () => {
    mockSessionsCreate.mockResolvedValueOnce({ url: 'https://checkout.stripe.com/test-quarterly' })

    const response = await POST(makeRequest({ plan: 'quarterly' }))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({ url: 'https://checkout.stripe.com/test-quarterly' })
    expect(mockSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [{ price: 'price_quarterly_test', quantity: 1 }],
      })
    )
  })

  it('возвращает 400 при некорректном тарифе', async () => {
    const response = await POST(makeRequest({ plan: 'invalid' }))
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data).toHaveProperty('error')
    expect(mockSessionsCreate).not.toHaveBeenCalled()
  })

  it('возвращает 400 при невалидном JSON', async () => {
    const request = new Request('http://localhost/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not valid json{{{',
    })
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data).toHaveProperty('error')
    expect(mockSessionsCreate).not.toHaveBeenCalled()
  })

  it('возвращает 500 при ошибке Stripe', async () => {
    mockSessionsCreate.mockRejectedValueOnce(new Error('Stripe connection error'))

    const response = await POST(makeRequest({ plan: 'monthly' }))
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data).toHaveProperty('error')
  })

  it('возвращает 500 если отсутствует env-переменная Price ID', async () => {
    delete process.env.STRIPE_MONTHLY_PRICE_ID

    const response = await POST(makeRequest({ plan: 'monthly' }))
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data).toHaveProperty('error')
    expect(mockSessionsCreate).not.toHaveBeenCalled()
  })

  it('возвращает 500 если отсутствует NEXT_PUBLIC_SITE_URL', async () => {
    delete process.env.NEXT_PUBLIC_SITE_URL

    const response = await POST(makeRequest({ plan: 'monthly' }))
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data).toHaveProperty('error')
    expect(mockSessionsCreate).not.toHaveBeenCalled()
  })

  it('возвращает 400 при null в теле запроса', async () => {
    const request = new Request('http://localhost/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'null',
    })
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data).toHaveProperty('error')
    expect(mockSessionsCreate).not.toHaveBeenCalled()
  })

  it('возвращает 400 при пустом массиве в теле запроса', async () => {
    const request = new Request('http://localhost/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '[]',
    })
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data).toHaveProperty('error')
    expect(mockSessionsCreate).not.toHaveBeenCalled()
  })

  it('возвращает 400 при отсутствии поля plan в теле запроса', async () => {
    const response = await POST(makeRequest({}))
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data).toHaveProperty('error')
    expect(mockSessionsCreate).not.toHaveBeenCalled()
  })

  it('нормализует NEXT_PUBLIC_SITE_URL с trailing slash', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000/'
    mockSessionsCreate.mockResolvedValueOnce({ url: 'https://checkout.stripe.com/test' })

    const response = await POST(makeRequest({ plan: 'monthly' }))

    expect(response.status).toBe(200)
    expect(mockSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        success_url: 'http://localhost:3000/onboarding?session_id={CHECKOUT_SESSION_ID}',
        cancel_url: 'http://localhost:3000/#pricing',
      })
    )
  })
})
