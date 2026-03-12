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
  mockIs,
  mockSingle,
  mockUpdate,
  mockOr,
  mockOrChain,
  mockCreateClient,
  mockSelectAfterEq,
  mockRpc,
} = vi.hoisted(() => {
  const mockSingle = vi.fn()
  const mockOr = vi.fn()
  const mockSelect = vi.fn()
  const mockUpdate = vi.fn()
  const mockFrom = vi.fn()

  // mockSelectAfterEq: используется для цепочки .update().eq().select('id')
  const mockSelectAfterEq = vi.fn()

  // mockIs: финальный await в цепочке .eq(...).is(...)
  const mockIs = vi.fn().mockResolvedValue({ error: null })

  // mockOrChain: используется для цепочки .eq(...).or(...).select('id')
  // Fix [AI-Review][High] Round 8: guard от stale payment_failed вебхуков
  const mockOrChain = vi.fn().mockImplementation(() => {
    const result = Promise.resolve({ data: [{ id: 'profile-1' }], error: null })
    Object.assign(result, { select: mockSelectAfterEq })
    return result
  })

  // mockEq: thenable + chainable с .select(), .is() и .or() чтобы поддерживать:
  //   await supabase.from(...).update(...).eq(...)               — прямое await
  //   await supabase.from(...).update(...).eq(...).select()      — chain с select
  //   await supabase.from(...).update(...).eq(...).is(...)       — chain с is (fallback guard)
  //   await supabase.from(...).update(...).eq(...).or(...).select() — chain с or (period_end guard)
  const mockEq = vi.fn().mockImplementation(() => {
    const result = Promise.resolve({ error: null })
    Object.assign(result, { select: mockSelectAfterEq, is: mockIs, or: mockOrChain })
    return result
  })

  // Fix [AI-Review][Critical] Round 8: мок supabase.rpc для O(1) поиска user по email через Postgres RPC
  const mockRpc = vi.fn()

  const mockCreateClient = vi.fn(() => ({
    from: mockFrom,
    rpc: mockRpc,
  }))

  return {
    mockFrom,
    mockSelect,
    mockEq,
    mockIs,
    mockSingle,
    mockUpdate,
    mockOr,
    mockOrChain,
    mockCreateClient,
    mockSelectAfterEq,
    mockRpc,
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
        mode: 'subscription', // [AI-Review][High] Round 5: mode обязателен для активации подписки
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

    // mockEq: thenable + chainable с .select(), .is() и .or() чтобы поддерживать:
    //   await ...eq(...).select()      — chain с select
    //   await ...eq(...).is(...)       — chain с is (fallback guard)
    //   await ...eq(...).or(...).select() — chain с or (period_end guard, Round 8)
    mockEq.mockImplementation(() => {
      const result = Promise.resolve({ error: null })
      Object.assign(result, { select: mockSelectAfterEq, is: mockIs, or: mockOrChain })
      return result
    })
    mockIs.mockResolvedValue({ error: null })
    // mockSelectAfterEq: по умолчанию возвращает найденную строку
    mockSelectAfterEq.mockResolvedValue({ data: [{ id: 'profile-1' }], error: null })

    mockOr.mockResolvedValue({ error: null })
    mockOrChain.mockImplementation(() => {
      const result = Promise.resolve({ data: [{ id: 'profile-1' }], error: null })
      Object.assign(result, { select: mockSelectAfterEq })
      return result
    })
    mockUpdate.mockReturnValue({ eq: mockEq, or: mockOr })
    mockFrom.mockReturnValue({ update: mockUpdate })

    // Fix [AI-Review][Critical] Round 8: дефолтный мок RPC — пользователь найден по email (O(1) поиск)
    mockRpc.mockResolvedValue({ data: 'auth-user-id', error: null })
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
    // Симулируем ошибку БД в шаге 1 checkout через .select('id')
    mockSelectAfterEq.mockResolvedValueOnce({ data: null, error: { message: 'БД недоступна' } })

    const response = await POST(makeRequest('{}'))

    expect(response.status).toBe(500)
    const data = await response.json()
    expect(data).toHaveProperty('error')
  })

  // Task 3.5: неизвестное событие → 200 (без retry)
  // [AI-Review][Low] Fix Round 5: теперь логирует event.type в default блоке
  it('возвращает 200 для неизвестного типа события', async () => {
    mockConstructEvent.mockReturnValueOnce({
      id: 'evt_unknown',
      type: 'some.unknown.event',
      data: { object: {} },
    } as unknown as import('stripe').default.Event)

    const response = await POST(makeRequest('{}'))

    expect(response.status).toBe(200)
  })

  it('логирует тип необрабатываемого события в default блоке', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    mockConstructEvent.mockReturnValueOnce({
      id: 'evt_unknown',
      type: 'payment_intent.created',
      data: { object: {} },
    } as unknown as import('stripe').default.Event)

    await POST(makeRequest('{}'))

    expect(consoleSpy).toHaveBeenCalledWith(
      '[webhook] Игнорируем необрабатываемое событие:',
      'payment_intent.created'
    )
    consoleSpy.mockRestore()
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
    // Fix [AI-Review][Critical] Round 8: шаг 2 теперь использует RPC (O(1)) вместо listUsers
    it('обновляет профиль по user ID из auth.users если step 1 не нашёл профиль (AC1)', async () => {
      mockConstructEvent.mockReturnValueOnce(makeCheckoutEvent())
      // Шаг 1 (customer_id) не нашёл строк → переходим к RPC lookup
      mockSelectAfterEq.mockResolvedValueOnce({ data: [], error: null })

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
      // Шаг 2: O(1) lookup через RPC → eq('id', userId)
      expect(mockRpc).toHaveBeenCalledWith('get_auth_user_id_by_email', { p_email: 'user@example.com' })
      expect(mockEq).toHaveBeenCalledWith('id', 'auth-user-id')
    })

    // Fix [AI-Review][Critical] Round 6: ранний выход если шаг 1 нашёл профиль
    it('обновляет по stripe_customer_id в шаге 1, не вызывает RPC если профиль найден (Data Corruption fix)', async () => {
      mockConstructEvent.mockReturnValueOnce(makeCheckoutEvent())
      // mockSelectAfterEq по умолчанию возвращает строку → ранний выход после шага 1

      const response = await POST(makeRequest('{}'))

      expect(response.status).toBe(200)
      expect(mockEq).toHaveBeenCalledWith('stripe_customer_id', 'cus_123')
      // Шаг 2 (RPC lookup) НЕ должен вызываться — ранний выход
      expect(mockRpc).not.toHaveBeenCalled()
    })

    it('вызывает RPC lookup если профиль не найден по stripe_customer_id (шаг 2)', async () => {
      mockConstructEvent.mockReturnValueOnce(makeCheckoutEvent())
      // Шаг 1 возвращает 0 строк → переходим к шагу 2 (RPC)
      mockSelectAfterEq.mockResolvedValueOnce({ data: [], error: null })

      const response = await POST(makeRequest('{}'))

      expect(response.status).toBe(200)
      expect(mockEq).toHaveBeenCalledWith('stripe_customer_id', 'cus_123')
      // Fix [AI-Review][Critical] Round 8: O(1) RPC вместо listUsers({page, perPage})
      expect(mockRpc).toHaveBeenCalledWith('get_auth_user_id_by_email', { p_email: 'user@example.com' })
      expect(mockEq).toHaveBeenCalledWith('id', 'auth-user-id')
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

    // [AI-Review][High] Fix Round 5: session.mode должен быть 'subscription'
    it('не обновляет профиль если session.mode не subscription (AC1 защита)', async () => {
      mockConstructEvent.mockReturnValueOnce(
        makeCheckoutEvent({ mode: 'payment' })
      )

      const response = await POST(makeRequest('{}'))

      expect(response.status).toBe(200)
      // Нет обновления профиля для разовых платежей
      expect(mockUpdate).not.toHaveBeenCalled()
    })

    it('обновляет профиль если session.mode === subscription', async () => {
      mockConstructEvent.mockReturnValueOnce(
        makeCheckoutEvent({ mode: 'subscription' })
      )

      const response = await POST(makeRequest('{}'))

      expect(response.status).toBe(200)
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ subscription_status: 'active' })
      )
    })

    it('логирует warn если пользователь не найден в auth.users по email (RPC вернул null)', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      mockConstructEvent.mockReturnValueOnce(makeCheckoutEvent())
      // Шаг 1 (customer_id) → 0 строк → переходим к шагу 2
      mockSelectAfterEq.mockResolvedValueOnce({ data: [], error: null })
      // Fix [AI-Review][Critical] Round 8: RPC вернул null → пользователь не найден
      mockRpc.mockResolvedValueOnce({ data: null, error: null })

      const response = await POST(makeRequest('{}'))

      expect(response.status).toBe(200)
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          '[webhook] checkout.session.completed: пользователь не найден в auth.users по email'
        )
      )
      consoleSpy.mockRestore()
    })

    it('логирует warn если профиль не найден в public.profiles для userId из auth.users (0 строк)', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      mockConstructEvent.mockReturnValueOnce(makeCheckoutEvent())
      // Шаг 1 (customer_id) → 0 строк
      mockSelectAfterEq.mockResolvedValueOnce({ data: [], error: null })
      // auth.users вернул пользователя → шаг 2
      // profiles.update().eq('id', ...).select('id') → 0 строк
      mockSelectAfterEq.mockResolvedValueOnce({ data: [], error: null })

      const response = await POST(makeRequest('{}'))

      expect(response.status).toBe(200)
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          '[webhook] checkout.session.completed: профиль не найден для userId'
        )
      )
      consoleSpy.mockRestore()
    })
  })

  describe('invoice.payment_succeeded', () => {
    // Fix [AI-Review][High]: двухшаговый подход; Fix [AI-Review][Medium] Round 6: ранний выход
    it('обновляет статус и current_period_end по stripe_subscription_id (шаг 1, AC1, Task 3.2)', async () => {
      mockConstructEvent.mockReturnValueOnce(makeInvoiceEvent('invoice.payment_succeeded'))
      // mockSelectAfterEq по умолчанию возвращает строку → ранний выход

      const response = await POST(makeRequest('{}'))

      expect(response.status).toBe(200)
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          subscription_status: 'active',
          current_period_end: expect.any(String),
          stripe_subscription_id: 'sub_123',
        })
      )
      // Только шаг 1 — subscription_id найден, шаг 2 не нужен
      expect(mockEq).toHaveBeenCalledWith('stripe_subscription_id', 'sub_123')
      expect(mockEq).not.toHaveBeenCalledWith('stripe_customer_id', expect.anything())
    })

    it('fallback по customer_id если шаг 1 не нашёл строк (Double Update fix)', async () => {
      mockConstructEvent.mockReturnValueOnce(makeInvoiceEvent('invoice.payment_succeeded'))
      // Шаг 1 возвращает 0 строк → переходим к fallback
      mockSelectAfterEq.mockResolvedValueOnce({ data: [], error: null })

      const response = await POST(makeRequest('{}'))

      expect(response.status).toBe(200)
      expect(mockEq).toHaveBeenCalledWith('stripe_subscription_id', 'sub_123')
      expect(mockEq).toHaveBeenCalledWith('stripe_customer_id', 'cus_123')
      expect(mockIs).toHaveBeenCalledWith('stripe_subscription_id', null)
    })

    // [AI-Review][Medium] Fix Round 5: ищем строку с type==='subscription' для точного period_end
    it('использует period.end из строки с type=subscription, а не первой строки (AC1)', async () => {
      mockConstructEvent.mockReturnValueOnce(
        makeInvoiceEvent('invoice.payment_succeeded', {
          lines: {
            data: [
              { type: 'invoiceitem', period: { end: 9999999999 } }, // не subscription — должен быть проигнорирован
              { type: 'subscription', period: { end: 1800000000 } }, // верный period_end
            ],
          },
        })
      )

      const response = await POST(makeRequest('{}'))

      expect(response.status).toBe(200)
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          current_period_end: new Date(1800000000 * 1000).toISOString(),
        })
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
      // Только шаг 2 (subscription_id недоступен): customer_id с .is() guard
      expect(mockEq).not.toHaveBeenCalledWith('stripe_subscription_id', expect.anything())
      expect(mockEq).toHaveBeenCalledWith('stripe_customer_id', 'cus_123')
      expect(mockIs).toHaveBeenCalledWith('stripe_subscription_id', null)
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

    // Fix [AI-Review][Medium] Round 6: ранний выход если шаг 1 нашёл строку
    it('обновляет по stripe_subscription_id в шаге 1, не вызывает fallback если найден', async () => {
      mockConstructEvent.mockReturnValueOnce(
        makeSubscriptionEvent('customer.subscription.deleted')
      )
      // mockSelectAfterEq по умолчанию возвращает строку → ранний выход

      const response = await POST(makeRequest('{}'))

      expect(response.status).toBe(200)
      expect(mockUpdate).toHaveBeenCalledWith({ subscription_status: 'inactive' })
      expect(mockEq).toHaveBeenCalledWith('stripe_subscription_id', 'sub_123')
      expect(mockEq).not.toHaveBeenCalledWith('stripe_customer_id', expect.anything())
    })

    // [AI-Review][High] Fix: fallback с IS NULL guard когда шаг 1 не нашёл строку
    it('fallback по customer_id с IS NULL guard если шаг 1 не нашёл строку (AC2)', async () => {
      mockConstructEvent.mockReturnValueOnce(
        makeSubscriptionEvent('customer.subscription.deleted')
      )
      // Шаг 1 возвращает 0 строк → fallback
      mockSelectAfterEq.mockResolvedValueOnce({ data: [], error: null })

      const response = await POST(makeRequest('{}'))

      expect(response.status).toBe(200)
      expect(mockEq).toHaveBeenCalledWith('stripe_subscription_id', 'sub_123')
      expect(mockEq).toHaveBeenCalledWith('stripe_customer_id', 'cus_123')
      expect(mockIs).toHaveBeenCalledWith('stripe_subscription_id', null)
    })

    // [AI-Review][Medium] Fix: не падает при undefined customerId (PostgREST undefined fix)
    it('не падает если customer в подписке undefined (customerId guard)', async () => {
      mockConstructEvent.mockReturnValueOnce(
        makeSubscriptionEvent('customer.subscription.deleted', {
          customer: undefined,
        })
      )

      const response = await POST(makeRequest('{}'))

      // Только первый шаг (subscription_id), customer_id пропускается
      expect(response.status).toBe(200)
      expect(mockEq).toHaveBeenCalledWith('stripe_subscription_id', 'sub_123')
      expect(mockEq).not.toHaveBeenCalledWith('stripe_customer_id', expect.anything())
    })
  })

  describe('customer.subscription.updated', () => {
    // Fix [AI-Review][High] Round 8: trialing = пробный период, пользователь имеет активный доступ
    it('сохраняет active для подписки со статусом trialing (Trial users fix, Round 8)', async () => {
      mockConstructEvent.mockReturnValueOnce(
        makeSubscriptionEvent('customer.subscription.updated', {
          status: 'trialing',
          cancel_at_period_end: false,
        })
      )

      const response = await POST(makeRequest('{}'))

      expect(response.status).toBe(200)
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ subscription_status: 'active' })
      )
    })

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

    // Fix [AI-Review][High] Round 6: fallback если subscription.updated пришёл до checkout.session.completed
    it('fallback по customer_id если subscription_id не привязан (Race Condition fix)', async () => {
      mockConstructEvent.mockReturnValueOnce(
        makeSubscriptionEvent('customer.subscription.updated')
      )
      // Шаг 1 возвращает 0 строк → fallback
      mockSelectAfterEq.mockResolvedValueOnce({ data: [], error: null })

      const response = await POST(makeRequest('{}'))

      expect(response.status).toBe(200)
      expect(mockEq).toHaveBeenCalledWith('stripe_subscription_id', 'sub_123')
      expect(mockEq).toHaveBeenCalledWith('stripe_customer_id', 'cus_123')
      expect(mockIs).toHaveBeenCalledWith('stripe_subscription_id', null)
    })
  })

  describe('invoice.payment_failed', () => {
    it('переводит в inactive, сбрасывает current_period_end и логирует ошибку (AC2)', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockConstructEvent.mockReturnValueOnce(makeInvoiceEvent('invoice.payment_failed'))

      const response = await POST(makeRequest('{}'))

      expect(response.status).toBe(200)
      // Fix [AI-Review][Medium] Round 7: current_period_end сбрасывается при неуплате
      expect(mockUpdate).toHaveBeenCalledWith({
        subscription_status: 'inactive',
        current_period_end: null,
      })
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[webhook] invoice.payment_failed:'),
        expect.any(String)
      )
      consoleSpy.mockRestore()
    })

    // Fix [AI-Review][Medium] Round 6: fallback если payment_failed пришёл до checkout.session.completed
    it('fallback по customer_id если subscription_id не привязан (Race Condition fix, AC2)', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockConstructEvent.mockReturnValueOnce(
        makeInvoiceEvent('invoice.payment_failed', {
          parent: { subscription_details: { subscription: null } },
        })
      )

      const response = await POST(makeRequest('{}'))

      expect(response.status).toBe(200)
      // Только шаг 2 (нет subscription_id): customer_id с .is() guard
      expect(mockEq).not.toHaveBeenCalledWith('stripe_subscription_id', expect.anything())
      expect(mockEq).toHaveBeenCalledWith('stripe_customer_id', 'cus_123')
      expect(mockIs).toHaveBeenCalledWith('stripe_subscription_id', null)
      consoleSpy.mockRestore()
    })

    // Fix [AI-Review][High] Round 8: guard от stale payment_failed вебхуков
    it('вызывает .or() guard для current_period_end при payment_failed (Race Condition Round 8)', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockConstructEvent.mockReturnValueOnce(makeInvoiceEvent('invoice.payment_failed'))

      const response = await POST(makeRequest('{}'))

      expect(response.status).toBe(200)
      // Проверяем что .or() был вызван с защитным условием period_end
      expect(mockOrChain).toHaveBeenCalledWith(
        expect.stringContaining('current_period_end.is.null')
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
      // Fix [AI-Review][Medium] Round 7: current_period_end сбрасывается при неуплате
      expect(mockUpdate).toHaveBeenCalledWith({
        subscription_status: 'inactive',
        current_period_end: null,
      })
      consoleSpy.mockRestore()
    })
  })
})
