import { beforeEach, describe, expect, it, vi } from 'vitest'

// Мок Supabase-клиента
const mockSignInWithPassword = vi.fn()
const mockUpdateUser = vi.fn()
const mockSignOut = vi.fn()
const mockGetSession = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: mockSignInWithPassword,
      updateUser: mockUpdateUser,
      signOut: mockSignOut,
      getSession: mockGetSession,
    },
  }),
}))

import { getSession, signInWithPassword, signOut, updatePassword } from '@/features/auth/api/auth'

describe('auth API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('signInWithPassword', () => {
    it('вызывает supabase.auth.signInWithPassword с правильными параметрами', async () => {
      mockSignInWithPassword.mockResolvedValue({ data: {}, error: null })

      await signInWithPassword({ email: 'test@example.com', password: 'password123' })

      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      })
    })

    it('возвращает ошибку от Supabase', async () => {
      const error = { message: 'Invalid credentials', status: 400 }
      mockSignInWithPassword.mockResolvedValue({ data: null, error })

      const result = await signInWithPassword({ email: 'test@example.com', password: 'wrong' })

      expect(result.error).toEqual(error)
    })

    it('возвращает data при успехе', async () => {
      mockSignInWithPassword.mockResolvedValue({ data: { session: null, user: null }, error: null })

      const result = await signInWithPassword({ email: 'test@example.com', password: 'password123' })

      expect(result.error).toBeNull()
    })
  })

  describe('updatePassword', () => {
    it('вызывает supabase.auth.updateUser с правильными параметрами', async () => {
      mockUpdateUser.mockResolvedValue({ data: {}, error: null })

      await updatePassword('newpassword123')

      expect(mockUpdateUser).toHaveBeenCalledWith({
        password: 'newpassword123',
      })
    })

    it('возвращает ошибку от Supabase при обновлении', async () => {
      const error = { message: 'Weak password', status: 400 }
      mockUpdateUser.mockResolvedValue({ data: null, error })

      const result = await updatePassword('123')

      expect(result.error).toEqual(error)
    })

    it('возвращает data при успешном обновлении', async () => {
      const user = { id: '1' }
      mockUpdateUser.mockResolvedValue({ data: { user }, error: null })

      const result = await updatePassword('newpassword123')

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
