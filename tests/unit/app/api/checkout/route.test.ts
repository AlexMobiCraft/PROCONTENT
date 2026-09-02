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
import { PROMO_OFFER_CODE } from '@/lib/stripe/promoOffer'

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
    // Promo-режим выключен по умолчанию — каждый тест включает его сам.
    delete process.env.STRIPE_PROMO_PRICE_ID
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

  it('во время акции отклоняет старые тарифы в обход UI', async () => {
    process.env.STRIPE_PROMO_PRICE_ID = 'price_promo_test'

    for (const plan of ['monthly', 'quarterly'] as const) {
      const response = await POST(makeRequest({ plan }))

      expect(response.status).toBe(400)
      expect(mockSessionsCreate).not.toHaveBeenCalled()
    }
  })

  it('не считает акцию включённой на плейсхолдере из .env.example', async () => {
    process.env.STRIPE_PROMO_PRICE_ID = 'price_...'
    mockSessionsCreate.mockResolvedValueOnce({ url: 'https://checkout.stripe.com/test-monthly' })

    // Старые тарифы продолжают работать
    const monthly = await POST(makeRequest({ plan: 'monthly' }))
    expect(monthly.status).toBe(200)

    // А promo — недоступен, вместо checkout с битым id
    const promo = await POST(makeRequest({ plan: 'promo' }))
    expect(promo.status).toBe(500)
    expect(mockSessionsCreate).toHaveBeenCalledOnce()
  })

  it('использует STRIPE_PROMO_PRICE_ID и метки акции для тарифа promo', async () => {
    process.env.STRIPE_PROMO_PRICE_ID = 'price_promo_test'
    mockSessionsCreate.mockResolvedValueOnce({ url: 'https://checkout.stripe.com/test-promo' })

    const response = await POST(makeRequest({ plan: 'promo' }))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({ url: 'https://checkout.stripe.com/test-promo' })
    expect(mockSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'subscription',
        line_items: [{ price: 'price_promo_test', quantity: 1 }],
        // Акция сама по себе скидка — промокоды поверх неё отключены
        allow_promotion_codes: false,
        metadata: { offer: PROMO_OFFER_CODE },
        subscription_data: { metadata: { offer: PROMO_OFFER_CODE } },
      })
    )

    // Пояснение про отсутствие автопродления: страница Stripe покажет «every 3 months»
    const params = mockSessionsCreate.mock.calls[0][0]
    expect(params.custom_text.submit.message).toContain('ne podaljša samodejno')
  })

  it('возвращает 500 для promo, если STRIPE_PROMO_PRICE_ID не задан', async () => {
    const response = await POST(makeRequest({ plan: 'promo' }))
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data).toHaveProperty('error')
    expect(mockSessionsCreate).not.toHaveBeenCalled()
  })

  it('не добавляет promo-поля к обычным тарифам', async () => {
    mockSessionsCreate.mockResolvedValueOnce({ url: 'https://checkout.stripe.com/test-quarterly' })

    await POST(makeRequest({ plan: 'quarterly' }))

    const params = mockSessionsCreate.mock.calls[0][0]
    expect(params.subscription_data).toBeUndefined()
    expect(params.metadata).toBeUndefined()
    expect(params.custom_text).toBeUndefined()
    expect(params.allow_promotion_codes).toBe(true)
  })

  it('возвращает 400 при некорректном тарифе', async () => {
    const response = await POST(makeRequest({ plan: 'invalid' }))
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data).toHaveProperty('error')
    expect(mockSessionsCreate).not.toHaveBeenCalled()
  })

  // Guard от нестрогого сравнения (startsWith/includes) при будущих правках isPlan
  it('возвращает 400 при тарифе, похожем на promo', async () => {
    process.env.STRIPE_PROMO_PRICE_ID = 'price_promo_test'

    const response = await POST(makeRequest({ plan: 'promo2' }))

    expect(response.status).toBe(400)
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
        success_url: 'http://localhost:3000/register?session_id={CHECKOUT_SESSION_ID}',
        cancel_url: 'http://localhost:3000/#pricing',
      })
    )
  })
})
