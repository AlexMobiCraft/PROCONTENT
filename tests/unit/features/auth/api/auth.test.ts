import { beforeEach, describe, expect, it, vi } from 'vitest'

// Мок Supabase-клиента
const mockSignInWithOtp = vi.fn()
const mockVerifyOtp = vi.fn()
const mockSignOut = vi.fn()
const mockGetSession = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signInWithOtp: mockSignInWithOtp,
      verifyOtp: mockVerifyOtp,
      signOut: mockSignOut,
      getSession: mockGetSession,
    },
  }),
}))

import { getSession, signInWithOtp, signOut, verifyOtp } from '@/features/auth/api/auth'

describe('auth API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // window.location.origin доступен в jsdom
    Object.defineProperty(window, 'location', {
      value: { origin: 'http://localhost:3000' },
      writable: true,
    })
  })

  describe('signInWithOtp', () => {
    it('вызывает supabase.auth.signInWithOtp с правильными параметрами', async () => {
      mockSignInWithOtp.mockResolvedValue({ data: {}, error: null })

      await signInWithOtp('test@example.com')

      expect(mockSignInWithOtp).toHaveBeenCalledWith({
        email: 'test@example.com',
        options: {
          shouldCreateUser: true,
          emailRedirectTo: 'http://localhost:3000/auth/callback',
        },
      })
    })

    it('возвращает ошибку от Supabase', async () => {
      const error = { message: 'Rate limit exceeded', status: 429 }
      mockSignInWithOtp.mockResolvedValue({ data: null, error })

      const result = await signInWithOtp('test@example.com')

      expect(result.error).toEqual(error)
    })

    it('возвращает data при успехе', async () => {
      mockSignInWithOtp.mockResolvedValue({ data: { user: null }, error: null })

      const result = await signInWithOtp('test@example.com')

      expect(result.error).toBeNull()
    })
  })

  describe('verifyOtp', () => {
    it('вызывает supabase.auth.verifyOtp с правильными параметрами', async () => {
      mockVerifyOtp.mockResolvedValue({ data: {}, error: null })

      await verifyOtp('test@example.com', '123456')

      expect(mockVerifyOtp).toHaveBeenCalledWith({
        email: 'test@example.com',
        token: '123456',
        type: 'email',
      })
    })

    it('возвращает ошибку при невалидном OTP', async () => {
      const error = { message: 'Token has expired or is invalid', status: 422 }
      mockVerifyOtp.mockResolvedValue({ data: null, error })

      const result = await verifyOtp('test@example.com', '000000')

      expect(result.error).toEqual(error)
      expect(result.error?.status).toBe(422)
    })

    it('возвращает data при успешной верификации', async () => {
      const session = { access_token: 'token', user: { id: '1' } }
      mockVerifyOtp.mockResolvedValue({ data: { session }, error: null })

      const result = await verifyOtp('test@example.com', '123456')

      expect(result.error).toBeNull()
    })
  })

  describe('signOut', () => {
    it('вызывает supabase.auth.signOut', async () => {
      mockSignOut.mockResolvedValue({ error: null })

      await signOut()

      expect(mockSignOut).toHaveBeenCalledOnce()
    })

    it('возвращает результат signOut', async () => {
      mockSignOut.mockResolvedValue({ error: null })

      const result = await signOut()

      expect(result.error).toBeNull()
    })
  })

  describe('getSession', () => {
    it('вызывает supabase.auth.getSession', async () => {
      mockGetSession.mockResolvedValue({ data: { session: null }, error: null })

      await getSession()

      expect(mockGetSession).toHaveBeenCalledOnce()
    })

    it('возвращает сессию при авторизованном пользователе', async () => {
      const session = { access_token: 'token', user: { id: '1' } }
      mockGetSession.mockResolvedValue({ data: { session }, error: null })

      const result = await getSession()

      expect(result.data.session).toEqual(session)
    })
  })
})
