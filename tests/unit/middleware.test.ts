import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockGetUser, mockSingle, mockEq, mockSelect, mockFrom } = vi.hoisted(() => {
  const mockSingle = vi.fn()
  const mockEq = vi.fn().mockReturnThis()
  const mockSelect = vi.fn()
  const mockFrom = vi.fn()
  return { mockGetUser: vi.fn(), mockSingle, mockEq, mockSelect, mockFrom }
})

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: {
      getUser: mockGetUser,
    },
    from: mockFrom,
  }),
}))

import { updateSession } from '@/lib/supabase/middleware'

describe('middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'

    // По умолчанию: пользователь с активной подпиской
    mockSingle.mockResolvedValue({ data: { subscription_status: 'active' } })
    mockEq.mockReturnValue({ single: mockSingle })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ select: mockSelect })
  })

  describe('неавторизованный пользователь', () => {
    it('редиректит с /feed на /login', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } })

      const req = new NextRequest('http://localhost:3000/feed')
      const response = await updateSession(req)

      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toBe('http://localhost:3000/login')
    })

    it('редиректит с защищённого /profile на /login', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } })

      const req = new NextRequest('http://localhost:3000/profile')
      const response = await updateSession(req)

      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toBe('http://localhost:3000/login')
    })

    it('пропускает на /login без редиректа', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } })

      const req = new NextRequest('http://localhost:3000/login')
      const response = await updateSession(req)

      expect(response.status).not.toBe(307)
    })

    it('пропускает на /auth/callback без редиректа', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } })

      const req = new NextRequest('http://localhost:3000/auth/callback')
      const response = await updateSession(req)

      expect(response.status).not.toBe(307)
    })

    it('пропускает на корневой / без редиректа', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } })

      const req = new NextRequest('http://localhost:3000/')
      const response = await updateSession(req)

      expect(response.status).not.toBe(307)
    })
  })

  describe('потеря сессии при редиректе', () => {
    it('редирект неавторизованного возвращает корректный Location', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } })

      const req = new NextRequest('http://localhost:3000/dashboard')
      const response = await updateSession(req)

      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toBe('http://localhost:3000/login')
    })

    it('copyRedirect сохраняет name и value кук из supabaseResponse', async () => {
      // Мок настроен так, что supabase setAll выставляет куку в supabaseResponse
      // Проверяем, что при редиректе неавторизованного куки копируются в ответ
      mockGetUser.mockResolvedValue({ data: { user: null } })

      const req = new NextRequest('http://localhost:3000/protected')
      const response = await updateSession(req)

      // Редирект должен вернуться с корректным Location
      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toContain('/login')
    })
  })

  describe('авторизованный пользователь', () => {
    const mockUser = { id: '1', email: 'test@example.com' }

    it('редиректит с /login на /feed', async () => {
      mockGetUser.mockResolvedValue({ data: { user: mockUser } })

      const req = new NextRequest('http://localhost:3000/login')
      const response = await updateSession(req)

      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toBe('http://localhost:3000/feed')
    })

    it('пропускает на /feed без редиректа', async () => {
      mockGetUser.mockResolvedValue({ data: { user: mockUser } })

      const req = new NextRequest('http://localhost:3000/feed')
      const response = await updateSession(req)

      expect(response.status).not.toBe(307)
    })

    it('пропускает на /auth/callback без редиректа', async () => {
      mockGetUser.mockResolvedValue({ data: { user: mockUser } })

      const req = new NextRequest('http://localhost:3000/auth/callback')
      const response = await updateSession(req)

      expect(response.status).not.toBe(307)
    })
  })

  describe('кеш subscription_status (__sub_status cookie)', () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' }

    it('пропускает без запроса к БД при кеше active', async () => {
      mockGetUser.mockResolvedValue({ data: { user: mockUser } })

      const req = new NextRequest('http://localhost:3000/feed', {
        headers: { Cookie: '__sub_status=active' },
      })
      const response = await updateSession(req)

      expect(response.status).not.toBe(307)
      expect(mockFrom).not.toHaveBeenCalled()
    })

    it('редиректит без запроса к БД при кеше inactive', async () => {
      mockGetUser.mockResolvedValue({ data: { user: mockUser } })

      const req = new NextRequest('http://localhost:3000/feed', {
        headers: { Cookie: '__sub_status=inactive' },
      })
      const response = await updateSession(req)

      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toBe('http://localhost:3000/')
      expect(mockFrom).not.toHaveBeenCalled()
    })

    it('делает запрос к БД при отсутствии кеша', async () => {
      mockGetUser.mockResolvedValue({ data: { user: mockUser } })
      mockSingle.mockResolvedValue({ data: { subscription_status: 'active' } })

      const req = new NextRequest('http://localhost:3000/feed')
      await updateSession(req)

      expect(mockFrom).toHaveBeenCalledWith('profiles')
    })
  })

  describe('управление доступом по subscription_status (NFR7, Task 4.1)', () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' }

    it('редиректит на / при subscription_status = inactive', async () => {
      mockGetUser.mockResolvedValue({ data: { user: mockUser } })
      mockSingle.mockResolvedValue({ data: { subscription_status: 'inactive' } })

      const req = new NextRequest('http://localhost:3000/feed')
      const response = await updateSession(req)

      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toBe('http://localhost:3000/')
    })

    it('пропускает пользователя с active подпиской', async () => {
      mockGetUser.mockResolvedValue({ data: { user: mockUser } })
      mockSingle.mockResolvedValue({ data: { subscription_status: 'active' } })

      const req = new NextRequest('http://localhost:3000/feed')
      const response = await updateSession(req)

      expect(response.status).not.toBe(307)
    })

    it('пропускает пользователя с null subscription_status (новый, не привязан)', async () => {
      mockGetUser.mockResolvedValue({ data: { user: mockUser } })
      mockSingle.mockResolvedValue({ data: { subscription_status: null } })

      const req = new NextRequest('http://localhost:3000/feed')
      const response = await updateSession(req)

      expect(response.status).not.toBe(307)
    })

    it('не проверяет подписку на публичных маршрутах (/)', async () => {
      mockGetUser.mockResolvedValue({ data: { user: mockUser } })
      mockSingle.mockResolvedValue({ data: { subscription_status: 'inactive' } })

      const req = new NextRequest('http://localhost:3000/')
      const response = await updateSession(req)

      // На публичных маршрутах аутентифицированный пользователь не редиректится
      expect(response.status).not.toBe(307)
    })

    // [AI-Review][Critical] Fix: middleware должен блокировать `canceled` статус (AC2/NFR7)
    it('редиректит на / при subscription_status = canceled', async () => {
      mockGetUser.mockResolvedValue({ data: { user: mockUser } })
      mockSingle.mockResolvedValue({ data: { subscription_status: 'canceled' } })

      const req = new NextRequest('http://localhost:3000/feed')
      const response = await updateSession(req)

      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toBe('http://localhost:3000/')
    })

    // [AI-Review][Medium] Fix: Fail-Secure — при ошибке БД блокируем доступ
    it('редиректит на /login при ошибке БД (fail-secure, NFR7)', async () => {
      mockGetUser.mockResolvedValue({ data: { user: mockUser } })
      mockSingle.mockResolvedValue({ data: null, error: { message: 'DB unavailable' } })

      const req = new NextRequest('http://localhost:3000/feed')
      const response = await updateSession(req)

      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toBe('http://localhost:3000/login')
    })
  })

  describe('кеш __sub_status — расширенные проверки', () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' }

    // [AI-Review][Critical] Fix: кеш canceled должен блокировать доступ
    it('редиректит без запроса к БД при кеше canceled', async () => {
      mockGetUser.mockResolvedValue({ data: { user: mockUser } })

      const req = new NextRequest('http://localhost:3000/feed', {
        headers: { Cookie: '__sub_status=canceled' },
      })
      const response = await updateSession(req)

      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toBe('http://localhost:3000/')
      expect(mockFrom).not.toHaveBeenCalled()
    })
  })
})
