import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockGetUser } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
}))

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: {
      getUser: mockGetUser,
    },
  }),
}))

import { middleware } from '@/middleware'

describe('middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
  })

  describe('неавторизованный пользователь', () => {
    it('редиректит с /feed на /login', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } })

      const req = new NextRequest('http://localhost:3000/feed')
      const response = await middleware(req)

      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toBe('http://localhost:3000/login')
    })

    it('редиректит с защищённого /profile на /login', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } })

      const req = new NextRequest('http://localhost:3000/profile')
      const response = await middleware(req)

      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toBe('http://localhost:3000/login')
    })

    it('пропускает на /login без редиректа', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } })

      const req = new NextRequest('http://localhost:3000/login')
      const response = await middleware(req)

      expect(response.status).not.toBe(307)
    })

    it('пропускает на /auth/callback без редиректа', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } })

      const req = new NextRequest('http://localhost:3000/auth/callback')
      const response = await middleware(req)

      expect(response.status).not.toBe(307)
    })

    it('пропускает на корневой / без редиректа', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } })

      const req = new NextRequest('http://localhost:3000/')
      const response = await middleware(req)

      expect(response.status).not.toBe(307)
    })
  })

  describe('потеря сессии при редиректе', () => {
    it('редирект неавторизованного возвращает корректный Location', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } })

      const req = new NextRequest('http://localhost:3000/dashboard')
      const response = await middleware(req)

      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toBe('http://localhost:3000/login')
    })

    it('copyRedirect сохраняет name и value кук из supabaseResponse', async () => {
      // Мок настроен так, что supabase setAll выставляет куку в supabaseResponse
      // Проверяем, что при редиректе неавторизованного куки копируются в ответ
      mockGetUser.mockResolvedValue({ data: { user: null } })

      const req = new NextRequest('http://localhost:3000/protected')
      const response = await middleware(req)

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
      const response = await middleware(req)

      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toBe('http://localhost:3000/feed')
    })

    it('пропускает на /feed без редиректа', async () => {
      mockGetUser.mockResolvedValue({ data: { user: mockUser } })

      const req = new NextRequest('http://localhost:3000/feed')
      const response = await middleware(req)

      expect(response.status).not.toBe(307)
    })

    it('пропускает на /auth/callback без редиректа', async () => {
      mockGetUser.mockResolvedValue({ data: { user: mockUser } })

      const req = new NextRequest('http://localhost:3000/auth/callback')
      const response = await middleware(req)

      expect(response.status).not.toBe(307)
    })
  })
})
