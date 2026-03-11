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
  mockSelectAfterEq,
} = vi.hoisted(() => {
  const mockSingle = vi.fn()
  const mockOr = vi.fn()
  const mockSelect = vi.fn()
  const mockUpdate = vi.fn()
  const mockFrom = vi.fn()

  // mockSelectAfterEq: используется для цепочки .update().eq().select('id')
  const mockSelectAfterEq = vi.fn()

  // mockEq: thenable + chainable с .select() чтобы поддерживать:
  //   await supabase.from(...).update(...).eq(...)           — прямое await
  //   await supabase.from(...).update(...).eq(...).select()  — chain с select
  const mockEq = vi.fn().mockImplementation(() => {
    const result = Promise.resolve({ error: null })
    Object.assign(result, { select: mockSelectAfterEq })
    return result
  })

  const mockCreateClient = vi.fn(() => ({
    from: mockFrom,
  }))

  return {
    mockFrom,
    mockSelect,
    mockEq,
    mockSingle,
    mockUpdate,
    mockOr,
    mockCreateClient,
    mockSelectAfterEq,
  }
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
        customer: 'cus_123',
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

    // mockEq: thenable + chainable с .select() (поддерживает оба паттерна использования)
    mockEq.mockImplementation(() => {
      const result = Promise.resolve({ error: null })
      Object.assign(result, { select: mockSelectAfterEq })
      return result
    })
    // mockSelectAfterEq: по умолчанию возвращает найденную строку
    mockSelectAfterEq.mockResolvedValue({ data: [{ id: 'profile-1' }], error: null })

    mockOr.mockResolvedValue({ error: null })
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
    // Не переопределяем mockEq — beforeEach уже настроил правильную цепочку с .select()

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

    it('пробует обновить по stripe_customer_id перед email (Race Condition fix)', async () => {
      mockConstructEvent.mockReturnValueOnce(makeCheckoutEvent())

      const response = await POST(makeRequest('{}'))

      expect(response.status).toBe(200)
      // Первый шаг — обновление по stripe_customer_id (идемпотентность при retry)
      expect(mockEq).toHaveBeenCalledWith('stripe_customer_id', 'cus_123')
      // Второй шаг — первичная привязка по email
      expect(mockEq).toHaveBeenCalledWith('email', 'user@example.com')
    })

    it('логирует event.id при ошибке обработки события', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockConstructEvent.mockReturnValueOnce(makeCheckoutEvent()) // id = 'evt_checkout_123'
      mockEq.mockResolvedValueOnce({ error: { message: 'БД недоступна' } })

      await POST(makeRequest('{}'))

      expect(consoleSpy).toHaveBeenCalledWith(
        '[webhook] Ошибка обработки события:',
        'evt_checkout_123',
        expect.any(Error)
      )
      consoleSpy.mockRestore()
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

    it('логирует warn если профиль не найден по email (0 строк обновлено)', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      mockConstructEvent.mockReturnValueOnce(makeCheckoutEvent())
      // Первый mockEq (customer_id) → ок
      // Second call goes to mockSelectAfterEq via .select()
      mockSelectAfterEq.mockResolvedValueOnce({ data: [], error: null }) // 0 rows found by email

      const response = await POST(makeRequest('{}'))

      expect(response.status).toBe(200)
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          '[webhook] checkout.session.completed: профиль не найден по email'
        )
      )
      consoleSpy.mockRestore()
    })
  })

  describe('invoice.payment_succeeded', () => {
    it('обновляет статус и current_period_end через OR-фильтр (AC1, Task 3.2)', async () => {
      mockConstructEvent.mockReturnValueOnce(makeInvoiceEvent('invoice.payment_succeeded'))

      const response = await POST(makeRequest('{}'))

      expect(response.status).toBe(200)
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          subscription_status: 'active',
          current_period_end: expect.any(String),
          stripe_subscription_id: 'sub_123',
        })
      )
      // Fix [High]: использует .or() с обоими условиями
      expect(mockOr).toHaveBeenCalledWith(
        'stripe_subscription_id.eq.sub_123,stripe_customer_id.eq.cus_123'
      )
    })

    it('fallback по customer_id когда subscription_id не привязан (event ordering fix)', async () => {
      // Симулируем invoice, пришедший до checkout.session.completed (нет subscription)
      mockConstructEvent.mockReturnValueOnce(
        makeInvoiceEvent('invoice.payment_succeeded', {
          parent: { subscription_details: { subscription: null } },
        })
      )

      const response = await POST(makeRequest('{}'))

      expect(response.status).toBe(200)
      // Только customer_id в OR-фильтре (subscription_id недоступен)
      expect(mockOr).toHaveBeenCalledWith('stripe_customer_id.eq.cus_123')
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

    it('повторный payment_failed для уже inactive профиля не падает (NFR18 идемпотентность)', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      // Оба вызова возвращают одно и то же событие
      mockConstructEvent.mockReturnValue(makeInvoiceEvent('invoice.payment_failed'))

      const res1 = await POST(makeRequest('{}'))
      const res2 = await POST(makeRequest('{}'))

      expect(res1.status).toBe(200)
      expect(res2.status).toBe(200)
      // Оба обновления выполнены (update идемпотентен — same data, same row)
      expect(mockUpdate).toHaveBeenCalledTimes(2)
      expect(mockUpdate).toHaveBeenCalledWith({ subscription_status: 'inactive' })
      consoleSpy.mockRestore()
    })
  })
})
