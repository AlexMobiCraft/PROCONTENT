import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockGetUser,
  mockRetrieveSession,
  mockRetrieveSubscription,
  mockAdminSelect,
  mockAdminEq,
  mockAdminUpdate,
  mockAdminFrom,
  mockCreateAdminClient,
} = vi.hoisted(() => {
  const mockAdminSelect = vi.fn()
  const mockAdminEq = vi.fn(() => ({ select: mockAdminSelect }))
  const mockAdminUpdate = vi.fn(() => ({ eq: mockAdminEq }))
  const mockAdminFrom = vi.fn(() => ({ update: mockAdminUpdate }))
  return {
    mockGetUser: vi.fn(),
    mockRetrieveSession: vi.fn(),
    mockRetrieveSubscription: vi.fn(),
    mockAdminSelect,
    mockAdminEq,
    mockAdminUpdate,
    mockAdminFrom,
    mockCreateAdminClient: vi.fn(() => ({ from: mockAdminFrom })),
  }
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: mockGetUser } }),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: mockCreateAdminClient,
}))

vi.mock('@/lib/stripe', () => ({
  stripe: {
    checkout: { sessions: { retrieve: mockRetrieveSession } },
    subscriptions: { retrieve: mockRetrieveSubscription },
  },
}))

import { linkSubscriptionAfterSignup } from '@/features/auth/api/server-actions'

const PERIOD_END_TS = 1800000000

function paidSession(overrides = {}) {
  return {
    id: 'cs_live_abc123',
    mode: 'subscription',
    status: 'complete',
    payment_status: 'paid',
    customer: 'cus_123',
    subscription: 'sub_123',
    customer_details: { email: 'nova@example.com' },
    ...overrides,
  }
}

describe('linkSubscriptionAfterSignup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service_role_key_test'

    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'nova@example.com' } },
    })
    mockRetrieveSession.mockResolvedValue(paidSession())
    mockRetrieveSubscription.mockResolvedValue({
      id: 'sub_123',
      status: 'active',
      cancel_at: null,
      current_period_end: PERIOD_END_TS,
    })
    mockAdminSelect.mockResolvedValue({ data: [{ id: 'user-1' }], error: null })
  })

  it('привязывает оплаченную подписку к профилю', async () => {
    const result = await linkSubscriptionAfterSignup('cs_live_abc123')

    expect(result).toEqual({ linked: true, status: 'active' })
    expect(mockAdminFrom).toHaveBeenCalledWith('profiles')
    expect(mockAdminUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        subscription_status: 'active',
        stripe_customer_id: 'cus_123',
        stripe_subscription_id: 'sub_123',
        current_period_end: new Date(PERIOD_END_TS * 1000).toISOString(),
        is_vip: false,
      })
    )
    expect(mockAdminEq).toHaveBeenCalledWith('id', 'user-1')
  })

  // Для promo-подписки без автопродления реальная дата окончания — cancel_at.
  it('предпочитает cancel_at при снятом автопродлении', async () => {
    mockRetrieveSubscription.mockResolvedValue({
      id: 'sub_123',
      status: 'active',
      cancel_at: 1700000000,
      current_period_end: PERIOD_END_TS,
    })

    await linkSubscriptionAfterSignup('cs_live_abc123')

    expect(mockAdminUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        current_period_end: new Date(1700000000 * 1000).toISOString(),
      })
    )
  })

  it('не падает, если Stripe не отдал дату окончания периода', async () => {
    mockRetrieveSubscription.mockResolvedValue({ id: 'sub_123', status: 'active', cancel_at: null })

    const result = await linkSubscriptionAfterSignup('cs_live_abc123')

    expect(result).toEqual({ linked: true, status: 'active' })
    expect(mockAdminUpdate).toHaveBeenCalledWith(
      expect.not.objectContaining({ current_period_end: expect.anything() })
    )
  })

  // session_id приходит из URL: без сверки email чужая оплата присваивалась бы.
  it('отказывает, если email сессии Stripe не совпадает с email пользователя', async () => {
    mockRetrieveSession.mockResolvedValue(
      paidSession({ customer_details: { email: 'someone.else@example.com' } })
    )

    const result = await linkSubscriptionAfterSignup('cs_live_abc123')

    expect(result).toEqual({ linked: false, reason: 'email_mismatch' })
    expect(mockAdminUpdate).not.toHaveBeenCalled()
  })

  it('сверяет email без учёта регистра', async () => {
    mockRetrieveSession.mockResolvedValue(
      paidSession({ customer_details: { email: 'Nova@Example.com' } })
    )

    const result = await linkSubscriptionAfterSignup('cs_live_abc123')

    expect(result).toEqual({ linked: true, status: 'active' })
  })

  it('отказывает неавторизованному вызову', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const result = await linkSubscriptionAfterSignup('cs_live_abc123')

    expect(result).toEqual({ linked: false, reason: 'unauthenticated' })
    expect(mockRetrieveSession).not.toHaveBeenCalled()
  })

  it('отказывает при неоплаченной сессии', async () => {
    mockRetrieveSession.mockResolvedValue(paidSession({ payment_status: 'unpaid' }))

    const result = await linkSubscriptionAfterSignup('cs_live_abc123')

    expect(result).toEqual({ linked: false, reason: 'not_paid' })
    expect(mockAdminUpdate).not.toHaveBeenCalled()
  })

  it('отказывает при незавершённой сессии', async () => {
    mockRetrieveSession.mockResolvedValue(paidSession({ status: 'open' }))

    const result = await linkSubscriptionAfterSignup('cs_live_abc123')

    expect(result).toEqual({ linked: false, reason: 'invalid_session' })
  })

  it('отказывает при разовом платеже', async () => {
    mockRetrieveSession.mockResolvedValue(paidSession({ mode: 'payment' }))

    const result = await linkSubscriptionAfterSignup('cs_live_abc123')

    expect(result).toEqual({ linked: false, reason: 'invalid_session' })
  })

  it('не открывает доступ, если подписка в Stripe уже неактивна', async () => {
    mockRetrieveSubscription.mockResolvedValue({ id: 'sub_123', status: 'canceled' })

    const result = await linkSubscriptionAfterSignup('cs_live_abc123')

    expect(result).toEqual({ linked: false, reason: 'no_subscription' })
    expect(mockAdminUpdate).not.toHaveBeenCalled()
  })

  it('открывает доступ подписке в статусе trialing', async () => {
    mockRetrieveSubscription.mockResolvedValue({
      id: 'sub_123',
      status: 'trialing',
      cancel_at: null,
      current_period_end: PERIOD_END_TS,
    })

    const result = await linkSubscriptionAfterSignup('cs_live_abc123')

    expect(result).toEqual({ linked: true, status: 'trialing' })
  })

  it('сообщает об ошибке, если профиль не обновился', async () => {
    mockAdminSelect.mockResolvedValue({ data: [], error: null })

    const result = await linkSubscriptionAfterSignup('cs_live_abc123')

    expect(result).toEqual({ linked: false, reason: 'update_failed' })
  })

  it('возвращает invalid_session, если сессия недоступна в Stripe', async () => {
    mockRetrieveSession.mockRejectedValue(new Error('No such checkout session'))

    const result = await linkSubscriptionAfterSignup('cs_live_abc123')

    expect(result).toEqual({ linked: false, reason: 'invalid_session' })
  })

  it('возвращает invalid_session при пустом sessionId, не дёргая Stripe', async () => {
    const result = await linkSubscriptionAfterSignup('')

    expect(result).toEqual({ linked: false, reason: 'invalid_session' })
    expect(mockGetUser).not.toHaveBeenCalled()
    expect(mockRetrieveSession).not.toHaveBeenCalled()
  })
})
