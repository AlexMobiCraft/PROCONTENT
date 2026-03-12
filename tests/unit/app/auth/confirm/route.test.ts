import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { mockVerifyOtp, mockCreateClient } = vi.hoisted(() => {
  const mockVerifyOtp = vi.fn()
  const mockCreateClient = vi.fn(async () => ({
    auth: {
      verifyOtp: mockVerifyOtp,
    },
  }))

  return {
    mockVerifyOtp,
    mockCreateClient,
  }
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: mockCreateClient,
}))

import { GET } from '@/app/auth/confirm/route'

function makeRequest(query = 'token_hash=test-token&type=email') {
  return new NextRequest(`http://localhost:3000/auth/confirm?${query}`)
}

describe('GET /auth/confirm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.AUTH_SUCCESS_REDIRECT_PATH
    mockVerifyOtp.mockResolvedValue({ error: null })
  })

  it('редиректит на /feed по умолчанию после успешной верификации', async () => {
    const response = await GET(makeRequest())

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost:3000/feed')
    expect(mockVerifyOtp).toHaveBeenCalledWith({
      type: 'email',
      token_hash: 'test-token',
    })
  })

  it('использует AUTH_SUCCESS_REDIRECT_PATH если next не передан', async () => {
    process.env.AUTH_SUCCESS_REDIRECT_PATH = '/dashboard'

    const response = await GET(makeRequest())

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost:3000/dashboard')
  })

  it('отдаёт приоритет query next над AUTH_SUCCESS_REDIRECT_PATH', async () => {
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
    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/login?error=auth_callback_error'
    )
  })
})
