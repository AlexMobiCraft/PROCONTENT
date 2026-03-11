import { describe, expect, it, vi, beforeEach } from 'vitest'

// --- Моки подняты до импортов ---

const { mockConstructEvent, mockWebhooks } = vi.hoisted(() => {
  const mockConstructEvent = vi.fn()
  return {
    mockConstructEvent,
    mockWebhooks: { constructEvent: mockConstructEvent },
  }
})

vi.mock('@/lib/stripe', () => ({
  stripe: {
    webhooks: mockWebhooks,
  },
}))

const {
  mockFrom,
  mockSelect,
  mockEq,
  mockSingle,
  mockUpdate,
  mockOr,
  mockCreateClient,
} = vi.hoisted(() => {
  const mockSingle = vi.fn()
  const mockOr = vi.fn()
  const mockEq = vi.fn().mockReturnThis()
  const mockSelect = vi.fn()
  const mockUpdate = vi.fn()
  const mockFrom = vi.fn()

  const mockCreateClient = vi.fn(() => ({
    from: mockFrom,
  }))

  return { mockFrom, mockSelect, mockEq, mockSingle, mockUpdate, mockOr, mockCreateClient }
})

vi.mock('@supabase/supabase-js', () => ({
  createClient: mockCreateClient,
}))

import { POST } from '@/app/api/webhooks/stripe/route'

// --- Фабрики тестовых данных ---

function makeRequest(body: string, signature = 'valid-signature') {
  return new Request('http://localhost/api/webhooks/stripe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'stripe-signature': signature,
    },
    body,
  })
}

function makeCheckoutEvent(overrides = {}): import('stripe').default.Event {
  return {
    id: 'evt_checkout_123',
    type: 'checkout.session.completed',
    data: {
      object: {
        customer: 'cus_123',
        subscription: 'sub_123',
        customer_details: { email: 'user@example.com' },
        ...overrides,
      },
    },
  } as unknown as import('stripe').default.Event
}

function makeSubscriptionEvent(
  type: string,
  overrides = {}
): import('stripe').default.Event {
  return {
    id: `evt_${type}_123`,
    type,
    data: {
      object: {
        id: 'sub_123',
        customer: 'cus_123',
        status: 'active',
        current_period_end: 1800000000,
        cancel_at_period_end: false,
        ...overrides,
      },
    },
  } as unknown as import('stripe').default.Event
}

function makeInvoiceEvent(
  type: string,
  overrides = {}
): import('stripe').default.Event {
  return {
    id: `evt_invoice_123`,
    type,
    data: {
      object: {
        // В Stripe API 2026: subscription_id живёт в parent.subscription_details.subscription
        parent: {
          subscription_details: { subscription: 'sub_123' },
        },
        lines: { data: [{ period: { end: 1800000000 } }] },
        ...overrides,
      },
    },
  } as unknown as import('stripe').default.Event
}

// --- Настройка среды ---

describe('POST /api/webhooks/stripe', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test'
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service_role_key_test'

    // Настраиваем цепочку supabase.from().update().eq() → success
    const mockEqResult = { error: null }
    const mockOrResult = { error: null }
    mockEq.mockResolvedValue(mockEqResult)
    mockOr.mockResolvedValue(mockOrResult)
    mockUpdate.mockReturnValue({ eq: mockEq, or: mockOr })
    mockFrom.mockReturnValue({ update: mockUpdate })
  })

  // AC1, AC4: валидная подпись — успешная обработка
  it('возвращает 200 при валидной подписи и известном событии', async () => {
    mockConstructEvent.mockReturnValueOnce(makeCheckoutEvent())

    const response = await POST(makeRequest('{}'))

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data).toEqual({ received: true })
  })

  // AC4: невалидная подпись → 400
  it('возвращает 400 при невалидной подписи Stripe', async () => {
    mockConstructEvent.mockImplementationOnce(() => {
      throw new Error('Невалидная подпись')
    })

    const response = await POST(makeRequest('{}', 'invalid-sig'))

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data).toHaveProperty('error')
  })

  // AC4: отсутствует stripe-signature → 400
  it('возвращает 400 при отсутствии заголовка stripe-signature', async () => {
    const request = new Request('http://localhost/api/webhooks/stripe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })

    const response = await POST(request)

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data).toHaveProperty('error')
    expect(mockConstructEvent).not.toHaveBeenCalled()
  })

  // AC3, NFR18: повторная обработка идентичного события — нет дублирования (update идемпотентен)
  it('обрабатывает повторный webhook идемпотентно (не падает)', async () => {
    mockConstructEvent.mockReturnValue(makeCheckoutEvent())
    mockEq.mockResolvedValue({ error: null })

    const req1 = await POST(makeRequest('{}'))
    const req2 = await POST(makeRequest('{}'))

    expect(req1.status).toBe(200)
    expect(req2.status).toBe(200)
  })

  // AC4, NFR19: ошибка БД → 500 (Stripe начнёт retry)
  it('возвращает 500 при ошибке БД во время обработки события', async () => {
    mockConstructEvent.mockReturnValueOnce(makeCheckoutEvent())
    mockEq.mockResolvedValueOnce({ error: { message: 'БД недоступна' } })

    const response = await POST(makeRequest('{}'))

    expect(response.status).toBe(500)
    const data = await response.json()
    expect(data).toHaveProperty('error')
  })

  // Task 3.5: неизвестное событие → 200 (без retry)
  it('возвращает 200 для неизвестного типа события', async () => {
    mockConstructEvent.mockReturnValueOnce({
      id: 'evt_unknown',
      type: 'some.unknown.event',
      data: { object: {} },
    } as unknown as import('stripe').default.Event)

    const response = await POST(makeRequest('{}'))

    expect(response.status).toBe(200)
  })

  // Task 5: отсутствует STRIPE_WEBHOOK_SECRET → 500
  it('возвращает 500 если STRIPE_WEBHOOK_SECRET не настроен', async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET

    const response = await POST(makeRequest('{}'))

    expect(response.status).toBe(500)
    expect(mockConstructEvent).not.toHaveBeenCalled()
  })

  // Task 2.3: constructEvent вызывается с правильными аргументами
  it('вызывает stripe.webhooks.constructEvent с payload, signature и secret', async () => {
    const payload = '{"type":"checkout.session.completed"}'
    mockConstructEvent.mockReturnValueOnce(makeCheckoutEvent())

    await POST(makeRequest(payload, 'test-sig'))

    expect(mockConstructEvent).toHaveBeenCalledWith(payload, 'test-sig', 'whsec_test')
  })

  describe('checkout.session.completed', () => {
    it('обновляет профиль пользователя по email (AC1)', async () => {
      mockConstructEvent.mockReturnValueOnce(makeCheckoutEvent())

      const response = await POST(makeRequest('{}'))

      expect(response.status).toBe(200)
      expect(mockFrom).toHaveBeenCalledWith('profiles')
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          stripe_customer_id: 'cus_123',
          stripe_subscription_id: 'sub_123',
          subscription_status: 'active',
        })
      )
      expect(mockEq).toHaveBeenCalledWith('email', 'user@example.com')
    })

    it('не падает если email отсутствует в сессии', async () => {
      mockConstructEvent.mockReturnValueOnce(
        makeCheckoutEvent({ customer_details: { email: null } })
      )

      const response = await POST(makeRequest('{}'))

      // Нет email — пропускаем обновление, но всё равно 200
      expect(response.status).toBe(200)
      expect(mockUpdate).not.toHaveBeenCalled()
    })
  })

  describe('invoice.payment_succeeded', () => {
    it('обновляет статус и current_period_end (AC1, Task 3.2)', async () => {
      mockConstructEvent.mockReturnValueOnce(makeInvoiceEvent('invoice.payment_succeeded'))

      const response = await POST(makeRequest('{}'))

      expect(response.status).toBe(200)
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          subscription_status: 'active',
          current_period_end: expect.any(String),
        })
      )
      expect(mockEq).toHaveBeenCalledWith('stripe_subscription_id', 'sub_123')
    })
  })

  describe('customer.subscription.deleted', () => {
    it('переводит пользователя в inactive (AC2)', async () => {
      mockConstructEvent.mockReturnValueOnce(
        makeSubscriptionEvent('customer.subscription.deleted')
      )

      const response = await POST(makeRequest('{}'))

      expect(response.status).toBe(200)
      expect(mockUpdate).toHaveBeenCalledWith({ subscription_status: 'inactive' })
    })
  })

  describe('customer.subscription.updated', () => {
    it('сохраняет active при cancel_at_period_end=true (AC5)', async () => {
      mockConstructEvent.mockReturnValueOnce(
        makeSubscriptionEvent('customer.subscription.updated', {
          status: 'active',
          cancel_at_period_end: true,
        })
      )

      const response = await POST(makeRequest('{}'))

      expect(response.status).toBe(200)
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ subscription_status: 'active' })
      )
    })

    it('переводит в canceled при status=canceled (Task 3.4)', async () => {
      mockConstructEvent.mockReturnValueOnce(
        makeSubscriptionEvent('customer.subscription.updated', {
          status: 'canceled',
          cancel_at_period_end: false,
        })
      )

      const response = await POST(makeRequest('{}'))

      expect(response.status).toBe(200)
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ subscription_status: 'canceled' })
      )
    })
  })

  describe('invoice.payment_failed', () => {
    it('переводит в inactive и логирует ошибку (AC2)', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockConstructEvent.mockReturnValueOnce(makeInvoiceEvent('invoice.payment_failed'))

      const response = await POST(makeRequest('{}'))

      expect(response.status).toBe(200)
      expect(mockUpdate).toHaveBeenCalledWith({ subscription_status: 'inactive' })
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[webhook] invoice.payment_failed:'),
        expect.any(String)
      )
      consoleSpy.mockRestore()
    })
  })
})
