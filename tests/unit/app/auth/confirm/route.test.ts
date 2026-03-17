import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { mockVerifyOtp, mockGetUser, mockCreateServerClient } = vi.hoisted(() => {
  const mockVerifyOtp = vi.fn()
  const mockGetUser = vi.fn()
  const mockCreateServerClient = vi.fn(() => ({
    auth: {
      verifyOtp: mockVerifyOtp,
      exchangeCodeForSession: vi.fn().mockResolvedValue({ error: null }),
      getUser: mockGetUser,
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  }))

  return {
    mockVerifyOtp,
    mockGetUser,
    mockCreateServerClient,
  }
})

vi.mock('@supabase/ssr', () => ({
  createServerClient: mockCreateServerClient,
}))

// Мокируем stripe — не должен вызываться в базовых тестах (user без email)
vi.mock('@/lib/stripe', () => ({
  stripe: {
    customers: { list: vi.fn() },
    subscriptions: { list: vi.fn() },
  },
}))

import { GET } from '@/app/auth/confirm/route'

function makeRequest(query = 'token_hash=test-token&type=email') {
  return new NextRequest(`http://localhost:3000/auth/confirm?${query}`)
}

describe('GET /auth/confirm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
    // SUPABASE_SERVICE_ROLE_KEY необходим для проверки env guard в начале route
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
    delete process.env.AUTH_SUCCESS_REDIRECT_PATH
    mockVerifyOtp.mockResolvedValue({ error: null })
    // user без email → Stripe-блок пропускается, базовая навигация тестируется чисто
    mockGetUser.mockResolvedValue({ data: { user: null } })
  })

  afterEach(() => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
  })

  it('редиректит на /feed по умолчанию после успешной верификации (type=email)', async () => {
    const response = await GET(makeRequest())

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost:3000/feed')
    expect(mockVerifyOtp).toHaveBeenCalledWith({
      type: 'email',
      token_hash: 'test-token',
    })
  })

  it('НЕ редиректит на /update-password для type=signup — только recovery требует смены пароля', async () => {
    const response = await GET(makeRequest('token_hash=test-token&type=signup'))

    expect(response.status).toBe(307)
    // signup — обычная регистрация через email, пароль уже задан; редирект на success path, не /update-password
    expect(response.headers.get('location')).toBe('http://localhost:3000/feed')
  })

  it('редиректит на /update-password при успехе если type=recovery', async () => {
    const response = await GET(makeRequest('token_hash=test-token&type=recovery'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost:3000/update-password')
  })

  it('использует AUTH_SUCCESS_REDIRECT_PATH если next не передан и type=email', async () => {
    process.env.AUTH_SUCCESS_REDIRECT_PATH = '/dashboard'

    const response = await GET(makeRequest())

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost:3000/dashboard')
  })

  it('игнорирует `next` если передан внешний URL — защита от Open Redirect', async () => {
    const response = await GET(
      makeRequest('token_hash=test-token&type=email&next=https://evil.com')
    )

    expect(response.status).toBe(307)
    // Должен редиректить на default path, а не на внешний URL
    expect(response.headers.get('location')).toBe('http://localhost:3000/feed')
  })

  it('игнорирует `next` с protocol-relative URL (//evil.com) — защита от Open Redirect', async () => {
    const response = await GET(
      makeRequest('token_hash=test-token&type=email&next=//evil.com')
    )

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost:3000/feed')
  })

  it('отдаёт приоритет query next над AUTH_SUCCESS_REDIRECT_PATH (type=email)', async () => {
    process.env.AUTH_SUCCESS_REDIRECT_PATH = '/dashboard'

    const response = await GET(
      makeRequest('token_hash=test-token&type=email&next=/billing')
    )

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost:3000/billing')
  })

  it('редиректит на /login с ошибкой если verifyOtp завершился ошибкой', async () => {
    mockVerifyOtp.mockResolvedValueOnce({ error: { message: 'invalid otp' } })

    const response = await GET(makeRequest())

    expect(response.status).toBe(307)
    const url = new URL(response.headers.get('location') || '')
    expect(url.pathname).toBe('/login')
    expect(url.searchParams.get('error')).toBe('auth_callback_error_v2')
  })

  it('редиректит на /login?error=link-expired при ошибке verifyOtp для type=recovery', async () => {
    mockVerifyOtp.mockResolvedValueOnce({ error: { message: 'Token has expired or is invalid' } })

    const response = await GET(makeRequest('token_hash=test-token&type=recovery'))

    expect(response.status).toBe(307)
    const url = new URL(response.headers.get('location') || '')
    expect(url.pathname).toBe('/login')
    expect(url.searchParams.get('error')).toBe('link-expired')
  })

  it('не вызывает getUser и Stripe при успешной верификации type=recovery', async () => {
    const response = await GET(makeRequest('token_hash=test-token&type=recovery'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost:3000/update-password')
    // Stripe-синхронизация пропускается для recovery — пользователь уже зарегистрирован
    expect(mockGetUser).not.toHaveBeenCalled()
  })
})
