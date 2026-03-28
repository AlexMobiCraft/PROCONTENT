import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockGetUser, mockSingle, mockEq, mockSelect, mockFrom, mockCreateServerClient } = vi.hoisted(() => {
  const mockSingle = vi.fn()
  const mockEq = vi.fn().mockReturnThis()
  const mockSelect = vi.fn()
  const mockFrom = vi.fn()
  const mockCreateServerClient = vi.fn()
  return { mockGetUser: vi.fn(), mockSingle, mockEq, mockSelect, mockFrom, mockCreateServerClient }
})

vi.mock('@supabase/ssr', () => ({
  createServerClient: mockCreateServerClient,
}))

import { updateSession, createCacheToken, parseCacheToken } from '@/lib/supabase/auth-middleware'

// Хелпер: создаёт HMAC-подписанное значение cookie (идентично логике middleware).
// Используется в тестах для генерации валидных signed tokens.
async function makeSignedCookie(
  userId: string,
  status: string,
  secret = 'test-cookie-secret'
): Promise<string> {
  const data = `${userId}:${status}`
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(data))
  const bytes = new Uint8Array(sig)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  const sigStr = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  return `${data}:${sigStr}`
}

describe('middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
    delete process.env.AUTH_SUCCESS_REDIRECT_PATH
    delete process.env.SUBSCRIPTION_CACHE_TTL_SECONDS
    // [AI-Review][Critical] Round 9: COOKIE_SECRET для HMAC-подписания кеша
    process.env.COOKIE_SECRET = 'test-cookie-secret'

    // По умолчанию: пользователь с активной подпиской
    mockSingle.mockResolvedValue({ data: { subscription_status: 'active' } })
    // Fix [AI-Review][High] Round 11: поддержка maybeSingle (см. middleware.ts)
    mockEq.mockReturnValue({ single: mockSingle, maybeSingle: mockSingle })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ select: mockSelect })
    mockCreateServerClient.mockImplementation(() => ({
      auth: {
        getUser: mockGetUser,
      },
      from: mockFrom,
    }))
  })

  afterEach(() => {
    delete process.env.COOKIE_SECRET
    delete process.env.AUTH_SUCCESS_REDIRECT_PATH
    delete process.env.SUBSCRIPTION_CACHE_TTL_SECONDS
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

    it('редиректит с /onboarding на /login', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } })

      const req = new NextRequest('http://localhost:3000/onboarding')
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

    it('пропускает на /forgot-password без редиректа', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } })

      const req = new NextRequest('http://localhost:3000/forgot-password')
      const response = await updateSession(req)

      expect(response.status).not.toBe(307)
    })

    // [AI-Review][Critical] Story 3.5: unsubscribe маршруты должны быть публичными
    it('пропускает на /email-preferences без редиректа (публичная страница результата unsubscribe)', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } })

      const req = new NextRequest('http://localhost:3000/email-preferences?status=unsubscribed')
      const response = await updateSession(req)

      expect(response.status).not.toBe(307)
    })

    it('пропускает на /api/email/unsubscribe без редиректа (GET unsubscribe endpoint)', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } })

      const req = new NextRequest('http://localhost:3000/api/email/unsubscribe?uid=test&ts=123&sig=abc')
      const response = await updateSession(req)

      expect(response.status).not.toBe(307)
    })

    it('редиректит неавторизованного с /api/email/other на /login (не является публичным маршрутом)', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } })

      const req = new NextRequest('http://localhost:3000/api/email/other')
      const response = await updateSession(req)

      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toBe('http://localhost:3000/login')
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
      mockGetUser.mockResolvedValue({ data: { user: null } })

      const req = new NextRequest('http://localhost:3000/protected')
      const response = await updateSession(req)

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

    it('редиректит с /login на AUTH_SUCCESS_REDIRECT_PATH если он задан', async () => {
      process.env.AUTH_SUCCESS_REDIRECT_PATH = '/dashboard'
      mockGetUser.mockResolvedValue({ data: { user: mockUser } })

      const req = new NextRequest('http://localhost:3000/login')
      const response = await updateSession(req)

      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toBe('http://localhost:3000/dashboard')
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

  // [AI-Review][High] Fix Round 9: fail-secure при отсутствии env переменных
  describe('fail-secure при отсутствии Supabase env переменных', () => {
    beforeEach(() => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    })

    it('редиректит на /login при обращении к защищённому маршруту без env', async () => {
      const req = new NextRequest('http://localhost:3000/feed')
      const response = await updateSession(req)

      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toBe('http://localhost:3000/login')
    })

    it('пропускает на /login без редиректа (публичный маршрут)', async () => {
      const req = new NextRequest('http://localhost:3000/login')
      const response = await updateSession(req)

      expect(response.status).not.toBe(307)
    })

    it('пропускает на / без редиректа (публичный маршрут)', async () => {
      const req = new NextRequest('http://localhost:3000/')
      const response = await updateSession(req)

      expect(response.status).not.toBe(307)
    })

    it('пропускает на /inactive без редиректа (публичный маршрут)', async () => {
      const req = new NextRequest('http://localhost:3000/inactive')
      const response = await updateSession(req)

      expect(response.status).not.toBe(307)
    })

    it('пропускает на /forgot-password без редиректа (публичный маршрут)', async () => {
      const req = new NextRequest('http://localhost:3000/forgot-password')
      const response = await updateSession(req)

      expect(response.status).not.toBe(307)
    })

    it('не вызывает supabase при отсутствии env', async () => {
      const req = new NextRequest('http://localhost:3000/feed')
      await updateSession(req)

      expect(mockGetUser).not.toHaveBeenCalled()
    })
  })

  describe('кеш subscription_status (__sub_status cookie)', () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' }

    // [AI-Review][Critical] Fix Round 9: cookie подписана HMAC — нужны валидные токены в тестах
    it('пропускает без запроса к БД при подписанном кеше active', async () => {
      mockGetUser.mockResolvedValue({ data: { user: mockUser } })
      const signedCookie = await makeSignedCookie('user-123', 'active')

      const req = new NextRequest('http://localhost:3000/feed', {
        headers: { Cookie: `__sub_status=${signedCookie}` },
      })
      const response = await updateSession(req)

      expect(response.status).not.toBe(307)
      expect(mockFrom).not.toHaveBeenCalled()
    })

    it('редиректит без запроса к БД при подписанном кеше inactive', async () => {
      mockGetUser.mockResolvedValue({ data: { user: mockUser } })
      const signedCookie = await makeSignedCookie('user-123', 'inactive')

      const req = new NextRequest('http://localhost:3000/feed', {
        headers: { Cookie: `__sub_status=${signedCookie}` },
      })
      const response = await updateSession(req)

      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toBe('http://localhost:3000/inactive')
      expect(mockFrom).not.toHaveBeenCalled()
    })

    it('делает запрос к БД при отсутствии кеша', async () => {
      mockGetUser.mockResolvedValue({ data: { user: mockUser } })
      mockSingle.mockResolvedValue({ data: { subscription_status: 'active' } })

      const req = new NextRequest('http://localhost:3000/feed')
      await updateSession(req)

      expect(mockFrom).toHaveBeenCalledWith('profiles')
    })

    // [AI-Review][Critical] Fix Round 9: неподписанный cookie игнорируется → DB lookup
    it('игнорирует неподписанный cookie и делает запрос к БД (HMAC protection)', async () => {
      mockGetUser.mockResolvedValue({ data: { user: mockUser } })
      mockSingle.mockResolvedValue({ data: { subscription_status: 'active' } })

      // Неподписанный формат (как было до Round 9 — уязвимый)
      const req = new NextRequest('http://localhost:3000/feed', {
        headers: { Cookie: '__sub_status=user-123:active' },
      })
      const response = await updateSession(req)

      expect(response.status).not.toBe(307)
      // Cookie не прошла HMAC-проверку → обязательный DB запрос
      expect(mockFrom).toHaveBeenCalledWith('profiles')
    })

    it('игнорирует подделанный cookie (изменённый status) и делает DB запрос', async () => {
      mockGetUser.mockResolvedValue({ data: { user: mockUser } })
      mockSingle.mockResolvedValue({ data: { subscription_status: 'active' } })

      // Валидный signed inactive токен, к которому добавлен 'X' — подпись неверна
      const validSigned = await makeSignedCookie('user-123', 'inactive')
      const tamperedCookie = validSigned.replace(':inactive:', ':active:')

      const req = new NextRequest('http://localhost:3000/feed', {
        headers: { Cookie: `__sub_status=${tamperedCookie}` },
      })
      const response = await updateSession(req)

      // Подпись не совпала → DB lookup, статус active → доступ разрешён
      expect(response.status).not.toBe(307)
      expect(mockFrom).toHaveBeenCalledWith('profiles')
    })

    it('игнорирует кеш если COOKIE_SECRET не задан → всегда DB lookup', async () => {
      delete process.env.COOKIE_SECRET
      mockGetUser.mockResolvedValue({ data: { user: mockUser } })
      mockSingle.mockResolvedValue({ data: { subscription_status: 'active' } })

      // createCacheToken вернёт null → cookie не устанавливается в следующем запросе
      // parseCacheToken вернёт null → кеш игнорируется
      const req = new NextRequest('http://localhost:3000/feed', {
        headers: { Cookie: '__sub_status=user-123:active:fakesig' },
      })
      const response = await updateSession(req)

      expect(response.status).not.toBe(307)
      expect(mockFrom).toHaveBeenCalledWith('profiles')
    })

    // Fix [AI-Review][Critical] Round 4: кеш другого пользователя должен игнорироваться
    it('игнорирует кеш и делает запрос к БД если userId не совпадает', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: 'user-456', email: 'other@example.com' } },
      })
      mockSingle.mockResolvedValue({ data: { subscription_status: 'active' } })

      // Кеш принадлежит user-123, текущий пользователь — user-456
      const signedCookie = await makeSignedCookie('user-123', 'active')
      const req = new NextRequest('http://localhost:3000/feed', {
        headers: { Cookie: `__sub_status=${signedCookie}` },
      })
      const response = await updateSession(req)

      expect(response.status).not.toBe(307)
      expect(mockFrom).toHaveBeenCalledWith('profiles')
    })

    it('не позволяет кешу inactive другого пользователя заблокировать текущего', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: 'user-456', email: 'other@example.com' } },
      })
      mockSingle.mockResolvedValue({ data: { subscription_status: 'active' } })

      const signedCookie = await makeSignedCookie('user-123', 'inactive')
      const req = new NextRequest('http://localhost:3000/feed', {
        headers: { Cookie: `__sub_status=${signedCookie}` },
      })
      const response = await updateSession(req)

      expect(response.status).not.toBe(307)
      expect(mockFrom).toHaveBeenCalledWith('profiles')
    })
  })

  describe('управление доступом по subscription_status (NFR7, Task 4.1)', () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' }

    it('редиректит на /inactive при subscription_status = inactive', async () => {
      mockGetUser.mockResolvedValue({ data: { user: mockUser } })
      mockSingle.mockResolvedValue({ data: { subscription_status: 'inactive' } })

      const req = new NextRequest('http://localhost:3000/feed')
      const response = await updateSession(req)

      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toBe('http://localhost:3000/inactive')
    })

    it('пропускает пользователя с active подпиской', async () => {
      mockGetUser.mockResolvedValue({ data: { user: mockUser } })
      mockSingle.mockResolvedValue({ data: { subscription_status: 'active' } })

      const req = new NextRequest('http://localhost:3000/feed')
      const response = await updateSession(req)

      expect(response.status).not.toBe(307)
    })

    it('пропускает пользователя с trialing подпиской', async () => {
      mockGetUser.mockResolvedValue({ data: { user: mockUser } })
      mockSingle.mockResolvedValue({ data: { subscription_status: 'trialing' } })

      const req = new NextRequest('http://localhost:3000/feed')
      const response = await updateSession(req)

      expect(response.status).not.toBe(307)
    })

    // [AI-Review][Medium] Fix Round 9: whitelist подход — null статус тоже блокируется
    it('блокирует пользователя с null subscription_status (whitelist: только active/trialing)', async () => {
      mockGetUser.mockResolvedValue({ data: { user: mockUser } })
      mockSingle.mockResolvedValue({ data: { subscription_status: null } })

      const req = new NextRequest('http://localhost:3000/feed')
      const response = await updateSession(req)

      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toBe('http://localhost:3000/inactive')
    })

    it('не проверяет подписку на публичных маршрутах (/)', async () => {
      mockGetUser.mockResolvedValue({ data: { user: mockUser } })
      mockSingle.mockResolvedValue({ data: { subscription_status: 'inactive' } })

      const req = new NextRequest('http://localhost:3000/')
      const response = await updateSession(req)

      expect(response.status).not.toBe(307)
    })

    // [AI-Review][Critical] Fix: middleware должен блокировать `canceled` статус (AC2/NFR7)
    it('редиректит на /inactive при subscription_status = canceled', async () => {
      mockGetUser.mockResolvedValue({ data: { user: mockUser } })
      mockSingle.mockResolvedValue({ data: { subscription_status: 'canceled' } })

      const req = new NextRequest('http://localhost:3000/feed')
      const response = await updateSession(req)

      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toBe('http://localhost:3000/inactive')
    })

    // [AI-Review][Medium] Fix: Fail-Secure — при ошибке БД блокируем доступ
    // [AI-Review][Critical] Fix Round 5: редиректим на / (не /login) чтобы избежать бесконечного цикла
    it('редиректит на / при ошибке БД (fail-secure, без бесконечного цикла, NFR7)', async () => {
      mockGetUser.mockResolvedValue({ data: { user: mockUser } })
      mockSingle.mockResolvedValue({ data: null, error: { message: 'DB unavailable' } })

      const req = new NextRequest('http://localhost:3000/feed')
      const response = await updateSession(req)

      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toBe('http://localhost:3000/')
    })

    it('не попадает в бесконечный цикл при ошибке БД (ошибка → /, не /login → /feed)', async () => {
      mockGetUser.mockResolvedValue({ data: { user: mockUser } })
      mockSingle.mockResolvedValue({ data: null, error: { message: 'DB unavailable' } })

      const req = new NextRequest('http://localhost:3000/feed')
      const response = await updateSession(req)

      expect(response.headers.get('location')).not.toContain('/login')
      expect(response.headers.get('location')).toBe('http://localhost:3000/')
    })
  })

  // [AI-Review][Medium] Fix Round 9: UX Dead-End на /inactive
  describe('/inactive — перенаправление active пользователей', () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' }

    it('редиректит active пользователя с /inactive на /feed (оплата прошла)', async () => {
      mockGetUser.mockResolvedValue({ data: { user: mockUser } })
      // По умолчанию mockSingle вернёт active
      mockSingle.mockResolvedValue({ data: { subscription_status: 'active' } })

      const req = new NextRequest('http://localhost:3000/inactive')
      const response = await updateSession(req)

      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toBe('http://localhost:3000/feed')
    })

    it('редиректит trialing пользователя с /inactive на /feed', async () => {
      mockGetUser.mockResolvedValue({ data: { user: mockUser } })
      mockSingle.mockResolvedValue({ data: { subscription_status: 'trialing' } })

      const req = new NextRequest('http://localhost:3000/inactive')
      const response = await updateSession(req)

      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toBe('http://localhost:3000/feed')
    })

    it('пропускает inactive пользователя на /inactive (показывает страницу)', async () => {
      mockGetUser.mockResolvedValue({ data: { user: mockUser } })
      mockSingle.mockResolvedValue({ data: { subscription_status: 'inactive' } })

      const req = new NextRequest('http://localhost:3000/inactive')
      const response = await updateSession(req)

      expect(response.status).not.toBe(307)
    })

    it('пропускает пользователя с null статусом на /inactive', async () => {
      mockGetUser.mockResolvedValue({ data: { user: mockUser } })
      mockSingle.mockResolvedValue({ data: { subscription_status: null } })

      const req = new NextRequest('http://localhost:3000/inactive')
      const response = await updateSession(req)

      expect(response.status).not.toBe(307)
    })

    it('пропускает при ошибке БД на /inactive (остаёмся на странице)', async () => {
      mockGetUser.mockResolvedValue({ data: { user: mockUser } })
      mockSingle.mockResolvedValue({ data: null, error: { message: 'DB unavailable' } })

      const req = new NextRequest('http://localhost:3000/inactive')
      const response = await updateSession(req)

      expect(response.status).not.toBe(307)
    })

    // Fix [AI-Review][Medium] Round 14: создаём новую active куку вместо удаления
    it('устанавливает новую active куку при редиректе с /inactive на /feed (Round 14 Medium)', async () => {
      mockGetUser.mockResolvedValue({ data: { user: mockUser } })
      mockSingle.mockResolvedValue({ data: { subscription_status: 'active' } })

      const req = new NextRequest('http://localhost:3000/inactive')
      const response = await updateSession(req)

      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toBe('http://localhost:3000/feed')
      // Fix Round 14: создаём новую подписанную куку с active-статусом — не удаляем.
      // Это предотвращает лишний DB lookup при следующем запросе к /feed.
      const cachedCookie = response.cookies.get('__sub_status')
      expect(cachedCookie?.value).toMatch(/^user-123:active:.+/)
    })

    it('проверяет подписку через DB при посещении /inactive (не только кеш)', async () => {
      mockGetUser.mockResolvedValue({ data: { user: mockUser } })
      mockSingle.mockResolvedValue({ data: { subscription_status: 'active' } })

      const req = new NextRequest('http://localhost:3000/inactive')
      await updateSession(req)

      // Для /inactive всегда делаем свежий DB запрос (не кешируем)
      expect(mockFrom).toHaveBeenCalledWith('profiles')
    })

    it('пропускает неавторизованного пользователя на /inactive без проверки подписки', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } })

      const req = new NextRequest('http://localhost:3000/inactive')
      const response = await updateSession(req)

      expect(response.status).not.toBe(307)
      expect(mockFrom).not.toHaveBeenCalled()
    })
  })

  describe('кеш __sub_status — расширенные проверки (HMAC-подписанные)', () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' }

    // Fix [AI-Review][High] Round 6: кешируем inactive/canceled в редиректе
    it('устанавливает подписанный __sub_status cookie при редиректе с inactive статуса', async () => {
      mockGetUser.mockResolvedValue({ data: { user: mockUser } })
      mockSingle.mockResolvedValue({ data: { subscription_status: 'inactive' } })

      const req = new NextRequest('http://localhost:3000/feed')
      const response = await updateSession(req)

      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toBe('http://localhost:3000/inactive')
      const cachedCookie = response.cookies.get('__sub_status')
      // [Round 9]: значение теперь подписано — начинается с "user-123:inactive:"
      expect(cachedCookie?.value).toMatch(/^user-123:inactive:.+/)
    })

    it('использует SUBSCRIPTION_CACHE_TTL_SECONDS для __sub_status cookie', async () => {
      process.env.SUBSCRIPTION_CACHE_TTL_SECONDS = '45'
      mockGetUser.mockResolvedValue({ data: { user: mockUser } })
      mockSingle.mockResolvedValue({ data: { subscription_status: 'inactive' } })

      const req = new NextRequest('http://localhost:3000/feed')
      const response = await updateSession(req)

      expect(response.status).toBe(307)
      expect(response.headers.get('set-cookie')).toContain('Max-Age=45')
    })

    it('ставит secure для __sub_status cookie в production (Round 19 High)', async () => {
      vi.stubEnv('NODE_ENV', 'production')
      mockGetUser.mockResolvedValue({ data: { user: mockUser } })
      mockSingle.mockResolvedValue({ data: { subscription_status: 'inactive' } })

      const req = new NextRequest('http://localhost:3000/feed')
      const response = await updateSession(req)

      expect(response.status).toBe(307)
      expect(response.headers.get('set-cookie')).toContain('Secure')
    })

    it('устанавливает подписанный __sub_status cookie при редиректе с canceled статуса', async () => {
      mockGetUser.mockResolvedValue({ data: { user: mockUser } })
      mockSingle.mockResolvedValue({ data: { subscription_status: 'canceled' } })

      const req = new NextRequest('http://localhost:3000/feed')
      const response = await updateSession(req)

      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toBe('http://localhost:3000/inactive')
      const cachedCookie = response.cookies.get('__sub_status')
      expect(cachedCookie?.value).toMatch(/^user-123:canceled:.+/)
    })

    it('редиректит без запроса к БД при подписанном кеше canceled', async () => {
      mockGetUser.mockResolvedValue({ data: { user: mockUser } })
      const signedCookie = await makeSignedCookie('user-123', 'canceled')

      const req = new NextRequest('http://localhost:3000/feed', {
        headers: { Cookie: `__sub_status=${signedCookie}` },
      })
      const response = await updateSession(req)

      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toBe('http://localhost:3000/inactive')
      expect(mockFrom).not.toHaveBeenCalled()
    })

    // [AI-Review][Medium] Round 9 whitelist: подписанный кеш с 'none' тоже блокирует
    it('редиректит без запроса к БД при подписанном кеше none (whitelist)', async () => {
      mockGetUser.mockResolvedValue({ data: { user: mockUser } })
      const signedCookie = await makeSignedCookie('user-123', 'none')

      const req = new NextRequest('http://localhost:3000/feed', {
        headers: { Cookie: `__sub_status=${signedCookie}` },
      })
      const response = await updateSession(req)

      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toBe('http://localhost:3000/inactive')
      expect(mockFrom).not.toHaveBeenCalled()
    })

    // Проверяем что createCacheToken возвращает валидный токен
    it('createCacheToken создаёт токен, который parseCacheToken верифицирует', async () => {
      const token = await createCacheToken('user-xyz', 'active')
      expect(token).not.toBeNull()
      expect(token).toMatch(/^user-xyz:active:.+/)
    })

    it('createCacheToken возвращает null если COOKIE_SECRET не задан', async () => {
      delete process.env.COOKIE_SECRET
      const token = await createCacheToken('user-xyz', 'active')
      expect(token).toBeNull()
    })
  })

  // Fix [AI-Review][High] Round 11: Auth-Profile Race Condition (maybeSingle)
  describe('свежий пользователь без профиля (PGRST116 → maybeSingle fix)', () => {
    const mockUser = { id: 'new-user-id', email: 'new@example.com' }

    it('редиректит на /inactive если профиль ещё не создан (data = null, нет ошибки)', async () => {
      mockGetUser.mockResolvedValue({ data: { user: mockUser } })
      // maybeSingle при 0 строках: { data: null, error: null } — не ошибка
      mockSingle.mockResolvedValue({ data: null, error: null })

      const req = new NextRequest('http://localhost:3000/feed')
      const response = await updateSession(req)

      // Whitelist: null статус → /inactive (не бесконечный цикл через / → /feed)
      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toBe('http://localhost:3000/inactive')
    })

    it('не создаёт бесконечный цикл для свежего пользователя (не редиректит на /)', async () => {
      mockGetUser.mockResolvedValue({ data: { user: mockUser } })
      mockSingle.mockResolvedValue({ data: null, error: null })

      const req = new NextRequest('http://localhost:3000/feed')
      const response = await updateSession(req)

      expect(response.headers.get('location')).not.toBe('http://localhost:3000/')
      expect(response.headers.get('location')).toBe('http://localhost:3000/inactive')
    })
  })

  // Fix [AI-Review][Medium] Round 11: createCacheToken не кидает исключение при ошибке crypto
  describe('createCacheToken — защита от Edge Crypto ошибки', () => {
    it('возвращает null при ошибке crypto.subtle (не бросает исключение)', async () => {
      const signSpy = vi
        .spyOn(globalThis.crypto.subtle, 'sign')
        .mockRejectedValueOnce(new Error('crypto unavailable'))

      const result = await createCacheToken('user-123', 'active')

      expect(result).toBeNull()
      signSpy.mockRestore()
    })
  })

  // Fix [AI-Review][Medium] Round 10: DoS protection — parseCacheToken не падает при ошибке crypto
  describe('parseCacheToken — защита от DoS через crypto ошибку', () => {
    it('возвращает null при ошибке crypto.subtle (не бросает, не крашит Middleware)', async () => {
      // Мокаем crypto.subtle.sign чтобы бросить ошибку
      const signSpy = vi
        .spyOn(globalThis.crypto.subtle, 'sign')
        .mockRejectedValueOnce(new Error('crypto unavailable'))

      const result = await parseCacheToken('user-123:active:fakesignature')

      expect(result).toBeNull()
      signSpy.mockRestore()
    })

    it('возвращает null при корректном формате но неверной подписи (без исключения)', async () => {
      const result = await parseCacheToken('user-123:active:invalidsig')
      expect(result).toBeNull()
    })

    it('возвращает null при отсутствии COOKIE_SECRET', async () => {
      delete process.env.COOKIE_SECRET
      const result = await parseCacheToken('user-123:active:anysig')
      expect(result).toBeNull()
    })

    // Fix [AI-Review][Medium] Round 12: timing-safe HMAC через crypto.subtle.verify()
    it('корректно парсит валидный подписанный токен (timing-safe verify)', async () => {
      // createCacheToken использует hmacSign, parseCacheToken — crypto.subtle.verify()
      const token = await createCacheToken('user-abc', 'active')
      expect(token).not.toBeNull()

      const parsed = await parseCacheToken(token!)
      expect(parsed).toEqual({ userId: 'user-abc', status: 'active' })
    })

    it('отвергает токен с изменённым битом подписи (timing-safe, постоянное время)', async () => {
      const token = await createCacheToken('user-abc', 'active')
      expect(token).not.toBeNull()

      // Меняем последний символ base64url — бит подписи изменён
      const tampered = token!.slice(0, -1) + (token!.endsWith('A') ? 'B' : 'A')
      const result = await parseCacheToken(tampered)

      expect(result).toBeNull()
    })
  })

  // Fix [AI-Review][Medium] Round 16: redirectWithCookies не копирует __sub_status из supabaseResponse
  describe('redirectWithCookies — исключение кеш-куки (Round 16)', () => {
    const mockUser = { id: 'user-123', email: 'test@example.com' }

    it('при кеш-редиректе на /inactive не устанавливает __sub_status в ответе (Round 16 Medium)', async () => {
      // Пользователь с подписанным кешем none → редирект через кеш (без DB lookup)
      const noneToken = await makeSignedCookie('user-123', 'none')
      mockGetUser.mockResolvedValue({ data: { user: mockUser } })

      const req = new NextRequest('http://localhost:3000/feed', {
        headers: { Cookie: `__sub_status=${noneToken}` },
      })
      const response = await updateSession(req)

      // Редирект через кеш
      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toBe('http://localhost:3000/inactive')
      // Fix Round 16: redirectWithCookies не копирует __sub_status из supabaseResponse.
      // В кеш-ветке (нет DB lookup) новая кука не устанавливается — она не должна появиться в ответе.
      const cachedCookie = response.cookies.get('__sub_status')
      expect(cachedCookie).toBeUndefined()
      // DB не вызывался — это чистый кеш-редирект
      expect(mockFrom).not.toHaveBeenCalled()
    })
  })

  describe('setAll — сохранение ранее выставленных cookies (Round 17)', () => {
    it('не теряет уже выставленную __sub_status куку после setAll от Supabase', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' }
      mockGetUser.mockImplementation(async () => {
        return { data: { user: mockUser } }
      })
      mockSingle.mockResolvedValue({ data: { subscription_status: 'inactive' } })

      mockCreateServerClient.mockImplementation((_url, _key, options) => {
        return {
          auth: {
            getUser: async () => {
              options.cookies.setAll([
                {
                  name: 'sb-refresh-token',
                  value: 'new-refresh-token',
                  options: { httpOnly: true, path: '/' },
                },
              ])
              return { data: { user: mockUser } }
            },
          },
          from: mockFrom,
        }
      })

      const req = new NextRequest('http://localhost:3000/feed')
      const response = await updateSession(req)

      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toBe('http://localhost:3000/inactive')
      expect(response.cookies.get('__sub_status')?.value).toMatch(/^user-123:inactive:.+/)
      expect(response.cookies.get('sb-refresh-token')?.value).toBe('new-refresh-token')
    })

    it('сохраняет non-cookie headers из supabaseResponse при redirect (Round 19 Medium)', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' }
      mockSingle.mockResolvedValue({ data: { subscription_status: 'inactive' } })

      mockCreateServerClient.mockImplementation((_url, _key, options) => {
        return {
          auth: {
            getUser: async () => {
              options.cookies.setAll([
                {
                  name: 'sb-refresh-token',
                  value: 'new-refresh-token',
                  options: { httpOnly: true, path: '/' },
                },
              ])
              return { data: { user: mockUser } }
            },
          },
          from: mockFrom,
        }
      })

      const req = new NextRequest('http://localhost:3000/feed')
      const response = await updateSession(req)

      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toBe('http://localhost:3000/inactive')
      expect(response.headers.get('x-middleware-next')).toBe('1')
      expect(response.cookies.get('sb-refresh-token')?.value).toBe('new-refresh-token')
    })
  })
})
