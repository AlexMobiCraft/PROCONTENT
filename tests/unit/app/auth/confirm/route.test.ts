import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { mockVerifyOtp, mockCreateServerClient } = vi.hoisted(() => {
  const mockVerifyOtp = vi.fn()
  const mockCreateServerClient = vi.fn(() => ({
    auth: {
      verifyOtp: mockVerifyOtp,
    },
  }))

  return {
    mockVerifyOtp,
    mockCreateServerClient,
  }
})

vi.mock('@supabase/ssr', () => ({
  createServerClient: mockCreateServerClient,
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
    delete process.env.AUTH_SUCCESS_REDIRECT_PATH
    mockVerifyOtp.mockResolvedValue({ error: null })
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

  it('редиректит на /update-password при успехе если type=signup', async () => {
    const response = await GET(makeRequest('token_hash=test-token&type=signup'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost:3000/update-password')
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
})
