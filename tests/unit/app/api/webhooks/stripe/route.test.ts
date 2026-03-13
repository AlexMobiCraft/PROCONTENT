import { describe, expect, it, vi, beforeEach } from 'vitest'

// --- Моки подняты до импортов ---

const { mockConstructEvent, mockWebhooks, mockListLineItems, mockRetrieveSubscription } = vi.hoisted(() => {
  const mockConstructEvent = vi.fn()
  const mockListLineItems = vi.fn()
  // Fix [AI-Review][Critical] Round 21: мок для проверки статуса подписки в Stripe (out-of-order race)
  const mockRetrieveSubscription = vi.fn()
  return {
    mockConstructEvent,
    mockListLineItems,
    mockRetrieveSubscription,
    mockWebhooks: { constructEvent: mockConstructEvent },
  }
})

vi.mock('@/lib/stripe', () => ({
  stripe: {
    invoices: {
      listLineItems: mockListLineItems,
    },
    subscriptions: {
      retrieve: mockRetrieveSubscription,
    },
    webhooks: mockWebhooks,
  },
}))

const {
  mockFrom,
  mockEq,
  mockIs,
  mockIsSelectFn,
  mockUpdate,
  mockOr,
  mockOrChain,
  mockCreateClient,
  mockSelectAfterEq,
  mockRpc,
  mockUpsert,
  mockNeq,
  mockGetUserById,
} = vi.hoisted(() => {
  const mockOr = vi.fn()
  const mockUpdate = vi.fn()
  const mockFrom = vi.fn()
  const mockGetUserById = vi.fn()
  // Fix [AI-Review][Medium] Round 14: мок для upsert (fallback при отсутствии профиля)
  const mockUpsert = vi.fn().mockResolvedValue({ error: null })

  // mockSelectAfterEq: используется для цепочки .update().eq().select('id')
  const mockSelectAfterEq = vi.fn()

  // mockIsSelectFn: используется в цепочке .is(...).select('id') — Fix Round 21 Email Spoofing Guard
  const mockIsSelectFn = vi.fn()

  // mockIs: финальный await в цепочке .eq(...).is(...) [существующие обработчики],
  // а также .eq(...).is(...).select('id') — Fix Round 21 Email Spoofing Guard в checkout step 2.
  // Возвращает thenable с поддержкой .select() для цепочки is().select().
  const mockIs = vi.fn().mockImplementation(() => {
    const result = Promise.resolve({ error: null })
    Object.assign(result, { select: mockIsSelectFn })
    return result
  })

  // mockNeq: финальный await в цепочке .eq(...).neq(...)
  // Fix [AI-Review][High] Round 16: .neq() используется в fallback invoice.payment_succeeded (step 2b)
  const mockNeq = vi.fn().mockResolvedValue({ error: null })

  // mockOrChain: используется для цепочки .eq(...).or(...).select('id')
  // Fix [AI-Review][High] Round 8: guard от stale payment_failed вебхуков
  const mockOrChain = vi.fn().mockImplementation(() => {
    const result = Promise.resolve({ data: [{ id: 'profile-1' }], error: null })
    Object.assign(result, { select: mockSelectAfterEq })
    return result
  })

  // mockEq: thenable + chainable с .select(), .is(), .or(), .eq(), .neq() чтобы поддерживать:
  //   await supabase.from(...).update(...).eq(...)               — прямое await
  //   await supabase.from(...).update(...).eq(...).select()      — chain с select
  //   await supabase.from(...).update(...).eq(...).is(...)       — chain с is (null guard)
  //   await supabase.from(...).update(...).eq(...).neq(...)      — chain с neq (Round 16: invoice.payment_succeeded)
  //   await supabase.from(...).update(...).eq(...).eq(...)       — double-chain (Round 16: eq fallback)
  //   await supabase.from(...).update(...).eq(...).or(...).select() — chain с or (period_end guard)
  const mockEq = vi.fn().mockImplementation(() => {
    const result = Promise.resolve({ error: null })
    Object.assign(result, { select: mockSelectAfterEq, is: mockIs, or: mockOrChain, neq: mockNeq, eq: mockEq })
    return result
  })

  // Fix [AI-Review][Critical] Round 8: мок supabase.rpc для O(1) поиска user по email через Postgres RPC
  const mockRpc = vi.fn()

  const mockCreateClient = vi.fn(() => ({
    auth: {
      admin: {
        getUserById: mockGetUserById,
      },
    },
    from: mockFrom,
    rpc: mockRpc,
  }))

  return {
    mockFrom,
    mockEq,
    mockIs,
    mockIsSelectFn,
    mockUpdate,
    mockOr,
    mockOrChain,
    mockCreateClient,
    mockSelectAfterEq,
    mockRpc,
    mockUpsert,
    mockNeq,
    mockGetUserById,
  }
})

vi.mock('@supabase/supabase-js', () => ({
  createClient: mockCreateClient,
}))

import { POST } from '@/app/api/webhooks/stripe/route'
import { resetStripeWebhookRateLimitStore } from '@/lib/stripe/webhook-rate-limit'

const DEFAULT_PERIOD_END_TS = 1800000000
const UPGRADED_PERIOD_END_TS = 1900000000
const NON_SUBSCRIPTION_PERIOD_END_TS = 9999999999

// --- Фабрики тестовых данных ---

function makeRequest(
  body: string,
  signature = 'valid-signature',
  extraHeaders: Record<string, string> = {}
) {
  return new Request('http://localhost/api/webhooks/stripe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'stripe-signature': signature,
      ...extraHeaders,
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
        payment_status: 'paid', // [AI-Review][Critical] Round 12: только paid/no_payment_required активируют подписку
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
        current_period_end: UPGRADED_PERIOD_END_TS,
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
        id: 'in_123',
        customer: 'cus_123',
        status: 'paid',
        parent: {
          subscription_details: { subscription: 'sub_123' },
        },
        lines: {
          data: [{ id: 'line_1', type: 'subscription', period: { end: DEFAULT_PERIOD_END_TS } }],
          has_more: false,
        },
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
    process.env.STRIPE_WEBHOOK_RATE_LIMIT_MAX = '60'
    process.env.STRIPE_WEBHOOK_RATE_LIMIT_WINDOW_SECONDS = '60'
    resetStripeWebhookRateLimitStore()

    // mockEq: thenable + chainable с .select(), .is() и .or() чтобы поддерживать:
    //   await ...eq(...).select()      — chain с select
    //   await ...eq(...).is(...)       — chain с is (fallback guard)
    //   await ...eq(...).or(...).select() — chain с or (period_end guard, Round 8)
    mockEq.mockImplementation(() => {
      const result = Promise.resolve({ error: null })
      Object.assign(result, { select: mockSelectAfterEq, is: mockIs, or: mockOrChain, neq: mockNeq, eq: mockEq })
      return result
    })
    // mockIs теперь реализован в vi.hoisted как mockImplementation — сбрасывать не нужно,
    // но нужно дефолтное поведение mockIsSelectFn (цепочка .is().select() в email fallback step 2)
    mockIsSelectFn.mockResolvedValue({ data: [{ id: 'profile-1' }], error: null })
    mockNeq.mockResolvedValue({ error: null })
    // mockSelectAfterEq: по умолчанию возвращает найденную строку
    mockSelectAfterEq.mockResolvedValue({ data: [{ id: 'profile-1' }], error: null })

    mockOr.mockResolvedValue({ error: null })
    mockOrChain.mockImplementation(() => {
      const result = Promise.resolve({ data: [{ id: 'profile-1' }], error: null })
      Object.assign(result, { select: mockSelectAfterEq })
      return result
    })
    mockUpdate.mockReturnValue({ eq: mockEq, or: mockOr })
    mockUpsert.mockResolvedValue({ error: null })
    mockGetUserById.mockResolvedValue({ data: { user: { email: 'auth-user@example.com' } }, error: null })
    mockListLineItems.mockResolvedValue({ data: [], has_more: false })
    // Fix [AI-Review][Critical] Round 21: дефолт — подписка активна в Stripe (out-of-order race guard)
    mockRetrieveSubscription.mockResolvedValue({ status: 'active' })
    mockFrom.mockReturnValue({ update: mockUpdate, upsert: mockUpsert })

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

  it('возвращает 429 если один IP превышает webhook rate limit', async () => {
    process.env.STRIPE_WEBHOOK_RATE_LIMIT_MAX = '2'
    mockConstructEvent.mockReturnValue({
      id: 'evt_unknown',
      type: 'some.unknown.event',
      data: { object: {} },
    } as unknown as import('stripe').default.Event)

    const firstResponse = await POST(
      makeRequest('{}', 'valid-signature', { 'x-forwarded-for': '203.0.113.10' })
    )
    const secondResponse = await POST(
      makeRequest('{}', 'valid-signature', { 'x-forwarded-for': '203.0.113.10' })
    )
    const thirdResponse = await POST(
      makeRequest('{}', 'valid-signature', { 'x-forwarded-for': '203.0.113.10' })
    )

    expect(firstResponse.status).toBe(200)
    expect(secondResponse.status).toBe(200)
    expect(thirdResponse.status).toBe(429)
    expect(thirdResponse.headers.get('Retry-After')).toBe('60')
    expect(mockConstructEvent).toHaveBeenCalledTimes(2)
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

    // Fix [AI-Review][High] Round 14: IDs привязываются, но статус не активируется при unpaid
    it('привязывает IDs без активации подписки если payment_status = unpaid (bank transfer pending)', async () => {
      mockConstructEvent.mockReturnValueOnce(
        makeCheckoutEvent({ payment_status: 'unpaid' })
      )

      const response = await POST(makeRequest('{}'))

      expect(response.status).toBe(200)
      // IDs должны записаться (чтобы invoice.payment_succeeded нашёл пользователя по customer_id)
      expect(mockUpdate).toHaveBeenCalledWith({
        stripe_customer_id: 'cus_123',
        stripe_subscription_id: 'sub_123',
      })
      // Подписка НЕ активируется — только при paid/no_payment_required
      expect(mockUpdate).not.toHaveBeenCalledWith(
        expect.objectContaining({ subscription_status: 'active' })
      )
    })

    it('выдаёт доступ если payment_status = no_payment_required (бесплатный трайал)', async () => {
      mockConstructEvent.mockReturnValueOnce(
        makeCheckoutEvent({ payment_status: 'no_payment_required' })
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

    // Fix [AI-Review][Critical] Round 21: Email Spoofing Guard — is.null защищает существующие привязки
    it('логирует warn если email fallback не обновил профиль (уже привязан к Stripe или не создан)', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      mockConstructEvent.mockReturnValueOnce(makeCheckoutEvent())
      // Шаг 1 (customer_id) → 0 строк
      mockSelectAfterEq.mockResolvedValueOnce({ data: [], error: null })
      // Шаг 2 (userId): .update().eq().is('stripe_customer_id', null).select() → 0 строк
      // (профиль уже привязан к Stripe — is.null guard срабатывает)
      mockIsSelectFn.mockResolvedValueOnce({ data: [], error: null })

      const response = await POST(makeRequest('{}'))

      expect(response.status).toBe(200)
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          '[webhook] checkout.session.completed: профиль'
        )
      )
      consoleSpy.mockRestore()
    })

    // Fix [AI-Review][Critical] Round 21: Email Spoofing Guard — upsert НЕ вызывается в email-пути
    it('не вызывает upsert через email fallback (защита от email spoofing, Round 21)', async () => {
      mockConstructEvent.mockReturnValueOnce(makeCheckoutEvent())
      // Шаг 1 (customer_id) → 0 строк
      mockSelectAfterEq.mockResolvedValueOnce({ data: [], error: null })
      // Шаг 2 (userId): is.null guard → 0 строк (профиль уже привязан или не создан)
      mockIsSelectFn.mockResolvedValueOnce({ data: [], error: null })

      const response = await POST(makeRequest('{}'))

      expect(response.status).toBe(200)
      // Upsert НЕ должен вызываться через email fallback (риск spoofing)
      expect(mockUpsert).not.toHaveBeenCalled()
    })

    // Fix [AI-Review][High] Round 15: при ошибке upsert (Auth Trigger Collision) — retry с update
    // Перенесён с email-пути на client_reference_id (upsert безопасен только когда userId подтверждён)
    it('делает retry update если upsert завершился ошибкой (Auth Trigger Collision, Round 15)', async () => {
      mockConstructEvent.mockReturnValueOnce(
        makeCheckoutEvent({ client_reference_id: 'known-user-id' })
      )
      // Шаг 0 (client_reference_id) → 0 строк → upsert fallback
      mockSelectAfterEq.mockResolvedValueOnce({ data: [], error: null })
      // Upsert ошибка (23505 unique_violation — триггер создал профиль одновременно)
      mockUpsert.mockResolvedValueOnce({ error: { message: 'duplicate key value', code: '23505' } })

      const response = await POST(makeRequest('{}'))

      expect(response.status).toBe(200)
      // upsert вызван, затем retry update по userId
      expect(mockUpsert).toHaveBeenCalled()
      // Второй вызов update — retry после upsert failure (шаг 0 + retry = 2)
      expect(mockUpdate).toHaveBeenCalledTimes(2)
    })

    it('возвращает 500 если upsert и retry update не сохранили профиль по client_reference_id (Round 19 High)', async () => {
      mockConstructEvent.mockReturnValueOnce(
        makeCheckoutEvent({ client_reference_id: 'known-user-id' })
      )
      // Шаг 0 (client_reference_id) → 0 строк → upsert fallback
      mockSelectAfterEq.mockResolvedValueOnce({ data: [], error: null })
      // upsert падает → retry update
      mockUpsert.mockResolvedValueOnce({ error: { message: 'duplicate key value', code: '23505' } })
      // retry update отрабатывает без DB error, но не сохраняет ни одной строки → fail-loud
      mockSelectAfterEq.mockResolvedValueOnce({ data: [], error: null })

      const response = await POST(makeRequest('{}'))

      expect(response.status).toBe(500)
      expect(mockUpdate).toHaveBeenCalledTimes(2)
    })

    // Fix [AI-Review][High] Round 14: проверяем что IDs привязываются при unpaid (дополнительный тест)
    it('invoice.payment_succeeded находит пользователя по customer_id после unpaid checkout (High Round 14)', async () => {
      // Сценарий: checkout пришёл с payment_status='unpaid', IDs привязаны (Fix Round 14)
      // Теперь симулируем что Шаг 1 нашёл профиль по customer_id → ранний выход
      mockConstructEvent.mockReturnValueOnce(makeCheckoutEvent({ payment_status: 'unpaid' }))

      const response = await POST(makeRequest('{}'))

      expect(response.status).toBe(200)
      // customer_id записан в профиль — будущий invoice.payment_succeeded найдёт пользователя
      expect(mockEq).toHaveBeenCalledWith('stripe_customer_id', 'cus_123')
    })

    // Fix [AI-Review][High] Round 13: динамический updateData — не сбрасываем данные если значение undefined
    it('не записывает null в stripe_customer_id если customer отсутствует в сессии (Round 13 High fix)', async () => {
      mockConstructEvent.mockReturnValueOnce(
        makeCheckoutEvent({ customer: null, subscription: 'sub_999' })
      )
      // Шаг 1 (customer_id) пропускается (customerId = null) → шаг 2 (RPC)
      // RPC возвращает пользователя → обновляем профиль по userId

      const response = await POST(makeRequest('{}'))

      expect(response.status).toBe(200)
      // updateData должен содержать stripe_subscription_id, но НЕ stripe_customer_id (customer = null)
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ stripe_subscription_id: 'sub_999', subscription_status: 'active' })
      )
      expect(mockUpdate).not.toHaveBeenCalledWith(
        expect.objectContaining({ stripe_customer_id: null })
      )
    })
  })

  describe('invoice.payment_succeeded', () => {
    // Fix [AI-Review][High]: двухшаговый подход; Fix [AI-Review][Medium] Round 6: ранний выход
    // Fix [AI-Review][Medium] Round 16: current_period_end берётся только из строки type=subscription
    it('обновляет статус и current_period_end по stripe_subscription_id (шаг 1, AC1, Task 3.2)', async () => {
      mockConstructEvent.mockReturnValueOnce(
        makeInvoiceEvent('invoice.payment_succeeded', {
          lines: { data: [{ type: 'subscription', period: { end: DEFAULT_PERIOD_END_TS } }] },
        })
      )
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

    it('игнорирует invoice.payment_succeeded если invoice.status не paid (Round 17 Medium)', async () => {
      mockConstructEvent.mockReturnValueOnce(
        makeInvoiceEvent('invoice.payment_succeeded', {
          status: 'open',
        })
      )

      const response = await POST(makeRequest('{}'))

      expect(response.status).toBe(200)
      expect(mockUpdate).not.toHaveBeenCalled()
      expect(mockListLineItems).not.toHaveBeenCalled()
    })

    // [AI-Review][High] Fix Round 9: fallback захватывает профили с null ИЛИ устаревшим sub_id
    // Fix [AI-Review][High] Round 16: два отдельных запроса вместо .or() строковой интерполяции
    it('fallback по customer_id использует is/neq вместо OR-строки (re-subscription fix, Round 16)', async () => {
      mockConstructEvent.mockReturnValueOnce(makeInvoiceEvent('invoice.payment_succeeded'))
      // Шаг 1 возвращает 0 строк → переходим к fallback
      mockSelectAfterEq.mockResolvedValueOnce({ data: [], error: null })

      const response = await POST(makeRequest('{}'))

      expect(response.status).toBe(200)
      expect(mockEq).toHaveBeenCalledWith('stripe_subscription_id', 'sub_123')
      expect(mockEq).toHaveBeenCalledWith('stripe_customer_id', 'cus_123')
      // Шаг 2a: профили без sub_id
      expect(mockIs).toHaveBeenCalledWith('stripe_subscription_id', null)
      // Шаг 2b: профили со старым sub_id (переподписка)
      expect(mockNeq).toHaveBeenCalledWith('stripe_subscription_id', 'sub_123')
    })

    // [AI-Review][Medium] Fix Round 5: ищем строку с type==='subscription' для точного period_end
    it('использует period.end из строки с type=subscription, а не первой строки (AC1)', async () => {
      mockConstructEvent.mockReturnValueOnce(
        makeInvoiceEvent('invoice.payment_succeeded', {
          lines: {
            data: [
              { type: 'invoiceitem', period: { end: NON_SUBSCRIPTION_PERIOD_END_TS } }, // не subscription — должен быть проигнорирован
              { type: 'subscription', period: { end: DEFAULT_PERIOD_END_TS } }, // верный period_end
            ],
          },
        })
      )

      const response = await POST(makeRequest('{}'))

      expect(response.status).toBe(200)
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          current_period_end: new Date(DEFAULT_PERIOD_END_TS * 1000).toISOString(),
        })
      )
    })

    // Fix [AI-Review][Medium] Round 20: пагинирует invoice.lines при has_more=true.
    // Предыдущий фикс Round 19 отключал доп. запросы во избежание таймаута,
    // что приводило к потере current_period_end для длинных инвойсов.
    // Теперь: страницы перебираются (макс MAX_LINE_ITEM_PAGES) до нахождения subscription-строки.
    it('пагинирует invoice.lines и находит subscription-строку на второй странице (Round 20 Medium)', async () => {
      mockConstructEvent.mockReturnValueOnce(
        makeInvoiceEvent('invoice.payment_succeeded', {
          lines: {
            data: [{ id: 'line_1', type: 'invoiceitem', period: { end: NON_SUBSCRIPTION_PERIOD_END_TS } }],
            has_more: true,
          },
        })
      )
      // Вторая страница содержит subscription-строку
      mockListLineItems.mockResolvedValueOnce({
        data: [{ id: 'line_2', type: 'subscription', period: { end: DEFAULT_PERIOD_END_TS } }],
        has_more: false,
      })

      const response = await POST(makeRequest('{}'))

      expect(response.status).toBe(200)
      expect(mockListLineItems).toHaveBeenCalledWith('in_123', {
        limit: 100,
        starting_after: 'line_1',
      })
      expect(mockUpdate.mock.calls[0]?.[0]).toHaveProperty(
        'current_period_end',
        new Date(DEFAULT_PERIOD_END_TS * 1000).toISOString()
      )
    })

    it('не устанавливает current_period_end если subscription-строка не найдена даже после пагинации (Round 20 Medium)', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      mockConstructEvent.mockReturnValueOnce(
        makeInvoiceEvent('invoice.payment_succeeded', {
          lines: {
            data: [{ id: 'line_1', type: 'invoiceitem', period: { end: NON_SUBSCRIPTION_PERIOD_END_TS } }],
            has_more: false,
          },
        })
      )

      const response = await POST(makeRequest('{}'))

      expect(response.status).toBe(200)
      expect(mockListLineItems).not.toHaveBeenCalled()
      expect(mockUpdate.mock.calls[0]?.[0]).not.toHaveProperty('current_period_end')
      consoleSpy.mockRestore()
    })

    it('fallback по customer_id когда subscription_id отсутствует — ранний выход (Round 12 High fix)', async () => {
      // Fix [AI-Review][High] Round 12: invoice без subscriptionId (разовый инвойс) — ранний выход.
      // Мы больше НЕ делаем fallback по customerId — нет subscriptionId = нет права на активацию подписки.
      mockConstructEvent.mockReturnValueOnce(
        makeInvoiceEvent('invoice.payment_succeeded', {
          parent: { subscription_details: { subscription: null } },
        })
      )

      const response = await POST(makeRequest('{}'))

      expect(response.status).toBe(200)
      // Без subscriptionId — обновления не происходит вообще (ранний выход)
      expect(mockUpdate).not.toHaveBeenCalled()
    })

    // [AI-Review][High] Fix Round 9: сценарий переподписки (re-subscription)
    // Профиль имеет устаревший sub_id; новый инвойс пришёл до checkout.session.completed
    // Fix [AI-Review][High] Round 16: два запроса вместо .or() строковой интерполяции
    it('обновляет профиль с устаревшим sub_id при повторной подписке (re-subscription, Round 16)', async () => {
      mockConstructEvent.mockReturnValueOnce(makeInvoiceEvent('invoice.payment_succeeded'))
      // Шаг 1 (новый sub_id sub_123) возвращает 0 строк → профиль имеет старый sub_id
      mockSelectAfterEq.mockResolvedValueOnce({ data: [], error: null })

      const response = await POST(makeRequest('{}'))

      expect(response.status).toBe(200)
      // Шаг 1: пытается найти по новому subscription_id
      expect(mockEq).toHaveBeenCalledWith('stripe_subscription_id', 'sub_123')
      // Шаг 2a: захватывает профили без sub_id
      expect(mockIs).toHaveBeenCalledWith('stripe_subscription_id', null)
      // Шаг 2b: захватывает профили со старым sub_id (sub_old != sub_123)
      expect(mockNeq).toHaveBeenCalledWith('stripe_subscription_id', 'sub_123')
    })

    // Fix [AI-Review][Critical] Round 11: fallback ТЕПЕРЬ включает stripe_subscription_id.
    // При переподписке профиль сохраняет старый sub_old если fallback его не обновит;
    // тогда customer.subscription.deleted для sub_old ложно переводит пользователя в inactive.
    it('fallback по customer_id обновляет stripe_subscription_id при переподписке (Resubscription fix, Round 11)', async () => {
      mockConstructEvent.mockReturnValueOnce(makeInvoiceEvent('invoice.payment_succeeded'))
      // Шаг 1 возвращает 0 строк → fallback (сценарий переподписки: профиль имеет sub_old)
      mockSelectAfterEq.mockResolvedValueOnce({ data: [], error: null })

      await POST(makeRequest('{}'))

      // Шаг 1 (mockUpdate.calls[0]): включает stripe_subscription_id
      expect(mockUpdate.mock.calls[0]?.[0]).toHaveProperty('stripe_subscription_id', 'sub_123')
      // Шаг 2 fallback (mockUpdate.calls[1]): ТОЖЕ включает stripe_subscription_id (Round 11 fix)
      expect(mockUpdate.mock.calls[1]?.[0]).toHaveProperty('stripe_subscription_id', 'sub_123')
      expect(mockUpdate.mock.calls[1]?.[0]).toMatchObject({ subscription_status: 'active' })
    })
  })

  describe('customer.subscription.deleted', () => {
    // Fix [AI-Review][Medium] Round 10: current_period_end сбрасывается при удалении подписки
    it('переводит пользователя в inactive и сбрасывает current_period_end (AC2, Round 10)', async () => {
      mockConstructEvent.mockReturnValueOnce(
        makeSubscriptionEvent('customer.subscription.deleted')
      )

      const response = await POST(makeRequest('{}'))

      expect(response.status).toBe(200)
      expect(mockUpdate).toHaveBeenCalledWith({
        subscription_status: 'inactive',
        current_period_end: null,
        stripe_subscription_id: null,
      })
    })

    // Fix [AI-Review][Medium] Round 6: ранний выход если шаг 1 нашёл строку
    it('обновляет по stripe_subscription_id в шаге 1, не вызывает fallback если найден', async () => {
      mockConstructEvent.mockReturnValueOnce(
        makeSubscriptionEvent('customer.subscription.deleted')
      )
      // mockSelectAfterEq по умолчанию возвращает строку → ранний выход

      const response = await POST(makeRequest('{}'))

      expect(response.status).toBe(200)
      expect(mockUpdate).toHaveBeenCalledWith({
        subscription_status: 'inactive',
        current_period_end: null,
        stripe_subscription_id: null,
      })
      expect(mockEq).toHaveBeenCalledWith('stripe_subscription_id', 'sub_123')
      expect(mockEq).not.toHaveBeenCalledWith('stripe_customer_id', expect.anything())
    })

    // Fix [AI-Review][Critical] Round 15: fallback использует IS NULL guard.
    // Fix [AI-Review][High] Round 16: типобезопасные методы SDK вместо .or() строковой интерполяции.
    // Fix [AI-Review][Medium] Round 20: убран redundant Step 2b (.eq sub_id),
    //   т.к. Step 1 уже проверил весь датасет по этому sub_id и нашёл 0 строк.
    it('fallback по customer_id с IS NULL guard если шаг 1 не нашёл строку (Round 20 — Step 2b убран)', async () => {
      mockConstructEvent.mockReturnValueOnce(
        makeSubscriptionEvent('customer.subscription.deleted')
      )
      // Шаг 1 возвращает 0 строк → fallback
      mockSelectAfterEq.mockResolvedValueOnce({ data: [], error: null })

      const response = await POST(makeRequest('{}'))

      expect(response.status).toBe(200)
      // Шаг 1: поиск по stripe_subscription_id
      expect(mockEq).toHaveBeenCalledWith('stripe_subscription_id', 'sub_123')
      // Шаг 2a (единственный fallback): по customer_id с is.null
      expect(mockEq).toHaveBeenCalledWith('stripe_customer_id', 'cus_123')
      expect(mockIs).toHaveBeenCalledWith('stripe_subscription_id', null)
      // Round 20: Step 2b удалён — ровно 2 вызова update (Step 1 + Step 2a)
      expect(mockUpdate).toHaveBeenCalledTimes(2)
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

    // Fix [AI-Review][Critical] Round 15: IS NULL guard не затрагивает профили с sub_new.
    // Fix [AI-Review][Medium] Round 20: Step 2b (eq.sub_id) удалён как guaranteed-empty.
    //   После Step 1 (весь датасет по sub_old → 0 строк) запрос с тем же sub_old + customer_id
    //   тоже вернёт 0 строк — дополнительный запрос бессмыслен.
    //   IS NULL (Step 2a) достаточен: захватывает профили без sub_id и не трогает профили с sub_new.
    it('не переводит профиль с sub_new в inactive при получении subscription.deleted для sub_old (Round 20)', async () => {
      mockConstructEvent.mockReturnValueOnce(
        makeSubscriptionEvent('customer.subscription.deleted')
        // event.subscription.id = 'sub_123' (= sub_old, уже удалённый)
      )
      // Шаг 1: профиль не найден по sub_old (у профиля sub_new записан checkout'ом)
      mockSelectAfterEq.mockResolvedValueOnce({ data: [], error: null })

      const response = await POST(makeRequest('{}'))

      expect(response.status).toBe(200)
      // Шаг 2a (единственный fallback): is.null — захватывает только профили без sub_id
      expect(mockIs).toHaveBeenCalledWith('stripe_subscription_id', null)
      // Шаг 1: поиск по sub_old проходит через всю таблицу (Step 2b более не дублирует)
      expect(mockUpdate).toHaveBeenCalledTimes(2)
    })
  })

  describe('customer.subscription.updated', () => {
    // Fix [AI-Review][Medium] Round 15: trialing сохраняется в БД как 'trialing' (не 'active')
    it('сохраняет trialing для подписки со статусом trialing (Trialing as-is, Round 15)', async () => {
      mockConstructEvent.mockReturnValueOnce(
        makeSubscriptionEvent('customer.subscription.updated', {
          status: 'trialing',
          cancel_at_period_end: false,
        })
      )

      const response = await POST(makeRequest('{}'))

      expect(response.status).toBe(200)
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ subscription_status: 'trialing' })
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

    // Fix [AI-Review][Medium] Round 11: plan upgrade — cancel_at = null, используем current_period_end
    it('обновляет current_period_end через current_period_end при апгрейде тарифа (cancel_at = null)', async () => {
      mockConstructEvent.mockReturnValueOnce(
        makeSubscriptionEvent('customer.subscription.updated', {
          status: 'active',
          cancel_at: null,
          cancel_at_period_end: false,
          current_period_end: UPGRADED_PERIOD_END_TS, // актуальная дата конца периода (не cancel_at)
        })
      )

      const response = await POST(makeRequest('{}'))

      expect(response.status).toBe(200)
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          subscription_status: 'active',
          current_period_end: new Date(UPGRADED_PERIOD_END_TS * 1000).toISOString(),
        })
      )
    })

    // Fix [AI-Review][Critical] Round 15: fallback subscription.updated использует IS NULL guard
    // Fix [AI-Review][High] Round 16: два запроса вместо .or() строковой интерполяции
    // Fix [AI-Review][Medium] Round 21: Step 2b удалён (guaranteed-empty запрос)
    it('fallback по customer_id с IS NULL guard если subscription_id не привязан (Round 16, Round 21)', async () => {
      mockConstructEvent.mockReturnValueOnce(
        makeSubscriptionEvent('customer.subscription.updated')
      )
      // Шаг 1 возвращает 0 строк → fallback
      mockSelectAfterEq.mockResolvedValueOnce({ data: [], error: null })

      const response = await POST(makeRequest('{}'))

      expect(response.status).toBe(200)
      expect(mockEq).toHaveBeenCalledWith('stripe_subscription_id', 'sub_123')
      expect(mockEq).toHaveBeenCalledWith('stripe_customer_id', 'cus_123')
      // Round 16: Step 2a — is.null (Step 2b удалён в Round 21)
      expect(mockIs).toHaveBeenCalledWith('stripe_subscription_id', null)
    })

    // Fix [AI-Review][Medium] Round 21: Step 2b удалён — не выполняется избыточный запрос
    it('не выполняет Step 2b в subscription.updated — гарантированно пустой запрос (Round 21 Medium)', async () => {
      mockConstructEvent.mockReturnValueOnce(
        makeSubscriptionEvent('customer.subscription.updated')
      )
      // Шаг 1 возвращает 0 строк → fallback
      mockSelectAfterEq.mockResolvedValueOnce({ data: [], error: null })

      await POST(makeRequest('{}'))

      // Без Step 2b: ровно 2 update вызова (Step 1 + Step 2a)
      expect(mockUpdate).toHaveBeenCalledTimes(2)
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

    // Fix [AI-Review][High] Round 10: guard на current_period_end удалён
    // Stripe шлёт payment_failed в grace period — period_end ещё в будущем,
    // поэтому прежний guard (.or period_end.is.null OR lte.now) слепо игнорировал событие
    it('переводит в inactive даже если current_period_end в будущем (grace period, Round 10)', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockConstructEvent.mockReturnValueOnce(makeInvoiceEvent('invoice.payment_failed'))

      const response = await POST(makeRequest('{}'))

      expect(response.status).toBe(200)
      expect(mockUpdate).toHaveBeenCalledWith({
        subscription_status: 'inactive',
        current_period_end: null,
      })
      // Fix Round 10: .or() guard для current_period_end удалён — платёж всегда обрабатывается
      expect(mockOrChain).not.toHaveBeenCalledWith(
        expect.stringContaining('current_period_end')
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

    // Fix [AI-Review][Critical] Round 15: IS NULL guard в fallback payment.failed.
    // Fix [AI-Review][High] Round 16: типобезопасные методы SDK вместо .or() строковой интерполяции.
    // Fix [AI-Review][Medium] Round 20: Step 2b (.eq sub_id) удалён как guaranteed-empty.
    it('fallback использует только IS NULL guard если шаг 1 не нашёл строку (Round 20 — Step 2b убран)', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockConstructEvent.mockReturnValueOnce(makeInvoiceEvent('invoice.payment_failed'))
      // Шаг 1 не найдёт строку → fallback
      mockSelectAfterEq.mockResolvedValueOnce({ data: [], error: null })

      const response = await POST(makeRequest('{}'))

      expect(response.status).toBe(200)
      // Шаг 1: поиск по subscription_id
      expect(mockEq).toHaveBeenCalledWith('stripe_subscription_id', 'sub_123')
      // Шаг 2a: только IS NULL (Step 2b удалён)
      expect(mockEq).toHaveBeenCalledWith('stripe_customer_id', 'cus_123')
      expect(mockIs).toHaveBeenCalledWith('stripe_subscription_id', null)
      // Round 20: ровно 2 update вызова (Step 1 + Step 2a)
      expect(mockUpdate).toHaveBeenCalledTimes(2)
      consoleSpy.mockRestore()
    })
  })

  // Fix [AI-Review][Critical] Round 16: Account Takeover fix — client_reference_id
  describe('checkout.session.completed — client_reference_id (Round 16)', () => {
    it('использует client_reference_id для привязки профиля, не вызывает RPC lookup (Critical Round 16)', async () => {
      mockConstructEvent.mockReturnValueOnce(
        makeCheckoutEvent({ client_reference_id: 'known-user-id' })
      )
      // mockSelectAfterEq по умолчанию возвращает строку → шаг 0 нашёл профиль → ранний выход

      const response = await POST(makeRequest('{}'))

      expect(response.status).toBe(200)
      // Шаг 0: обновление по client_reference_id (userId)
      expect(mockEq).toHaveBeenCalledWith('id', 'known-user-id')
      // RPC lookup НЕ вызывается — client_reference_id достаточно
      expect(mockRpc).not.toHaveBeenCalled()
    })

    it('upsert по client_reference_id использует canonical email из auth.users (Round 17 Critical)', async () => {
      mockConstructEvent.mockReturnValueOnce(
        makeCheckoutEvent({ client_reference_id: 'known-user-id' })
      )
      // Шаг 0 update возвращает 0 строк → upsert fallback
      mockSelectAfterEq.mockResolvedValueOnce({ data: [], error: null })

      const response = await POST(makeRequest('{}'))

      expect(response.status).toBe(200)
      expect(mockGetUserById).toHaveBeenCalledWith('known-user-id')
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'known-user-id', email: 'auth-user@example.com' }),
        { onConflict: 'id' }
      )
    })

    // Fix [AI-Review][Critical] Round 21: Out-of-order Webhook Race Condition
    it('не активирует подписку если она удалена в Stripe до получения checkout (Out-of-order Race, Round 21)', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      mockConstructEvent.mockReturnValueOnce(
        makeCheckoutEvent({ client_reference_id: 'known-user-id' })
      )
      // Stripe: подписка уже удалена (retrieve выбрасывает ошибку — 404)
      mockRetrieveSubscription.mockRejectedValueOnce(new Error('No such subscription: sub_123'))

      const response = await POST(makeRequest('{}'))

      expect(response.status).toBe(200)
      // IDs привязываются (stripe_customer_id, stripe_subscription_id), но статус НЕ активируется
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ stripe_customer_id: 'cus_123', stripe_subscription_id: 'sub_123' })
      )
      expect(mockUpdate).not.toHaveBeenCalledWith(
        expect.objectContaining({ subscription_status: 'active' })
      )
      consoleSpy.mockRestore()
    })

    it('не активирует подписку если статус в Stripe canceled (Out-of-order Race, Round 21)', async () => {
      mockConstructEvent.mockReturnValueOnce(
        makeCheckoutEvent({ client_reference_id: 'known-user-id' })
      )
      // Stripe: подписка уже отменена
      mockRetrieveSubscription.mockResolvedValueOnce({ status: 'canceled' })

      const response = await POST(makeRequest('{}'))

      expect(response.status).toBe(200)
      expect(mockUpdate).not.toHaveBeenCalledWith(
        expect.objectContaining({ subscription_status: 'active' })
      )
    })
  })

  // Fix [AI-Review][Critical] Round 20: Middleware не блокирует webhook маршрут
  describe('isPublicPath — webhook path (Round 20 Critical)', () => {
    it('считает /api/webhooks/stripe публичным маршрутом (не перехватывается middleware)', async () => {
      const { isPublicPath } = await import('@/lib/app-routes')
      expect(isPublicPath('/api/webhooks/stripe')).toBe(true)
      expect(isPublicPath('/api/webhooks/stripe/other')).toBe(true)
    })
  })

  // Fix [AI-Review][Critical] Round 20: глобальный rate limit key для Stripe webhook
  describe('rate limiting — глобальный ключ (Round 20 Critical)', () => {
    it('два запроса с разными x-forwarded-for считаются против одного лимита (global key)', async () => {
      // Устанавливаем жёсткий лимит = 1 запрос для теста
      process.env.STRIPE_WEBHOOK_RATE_LIMIT_MAX = '1'
      process.env.STRIPE_WEBHOOK_RATE_LIMIT_WINDOW_SECONDS = '60'
      resetStripeWebhookRateLimitStore()

      mockConstructEvent.mockReturnValue(makeCheckoutEvent())

      // Первый запрос с IP 1.1.1.1 — должен пройти
      const res1 = await POST(makeRequest('{}', 'valid-sig', { 'x-forwarded-for': '1.1.1.1' }))
      expect(res1.status).toBe(200)

      // Второй запрос с другим IP 2.2.2.2 — должен быть заблокирован (один глобальный счётчик)
      const res2 = await POST(makeRequest('{}', 'valid-sig', { 'x-forwarded-for': '2.2.2.2' }))
      expect(res2.status).toBe(429)
    })
  })

  // Fix [AI-Review][Medium] Round 16: period_end не берётся из первой строки инвойса
  describe('invoice.payment_succeeded — period_end без fallback (Round 16)', () => {
    it('не устанавливает current_period_end если нет строки type=subscription (Medium Round 16)', async () => {
      mockConstructEvent.mockReturnValueOnce(
        makeInvoiceEvent('invoice.payment_succeeded', {
          lines: {
            data: [
              // Только разовые позиции — нет строки type=subscription
              { type: 'invoiceitem', period: { end: NON_SUBSCRIPTION_PERIOD_END_TS } },
            ],
          },
        })
      )

      const response = await POST(makeRequest('{}'))

      expect(response.status).toBe(200)
      // current_period_end НЕ должен браться из разовой позиции инвойса
      expect(mockUpdate.mock.calls[0]?.[0]).not.toHaveProperty('current_period_end')
    })
  })
})
