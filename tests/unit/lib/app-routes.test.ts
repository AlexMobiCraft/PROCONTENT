import { describe, it, expect } from 'vitest'
import { isPublicPath, sanitizeRedirectPath } from '@/lib/app-routes'

describe('isPublicPath — публичность маршрутов', () => {
  // Инверсный страж: route /api/notifications/* остаётся НЕпубличным.
  // Внутренние публикации вызывают sendNewPostNotification напрямую (без HTTP self-fetch),
  // внешних потребителей у route нет → префикс не должен попадать в PUBLIC_PATH_PREFIXES.
  it('/api/notifications/new-post НЕ публичен', () => {
    expect(isPublicPath('/api/notifications/new-post')).toBe(false)
  })

  it('/api/notifications/ (любой подпуть) НЕ публичен', () => {
    expect(isPublicPath('/api/notifications/anything')).toBe(false)
  })

  // Контроль: cron остаётся публичным (вызывается pg_cron с Bearer CRON_SECRET).
  it('/api/cron/publish публичен', () => {
    expect(isPublicPath('/api/cron/publish')).toBe(true)
  })

  it('/api/email/unsubscribe публичен (one-click unsubscribe)', () => {
    expect(isPublicPath('/api/email/unsubscribe')).toBe(true)
  })

  it('/api/webhooks/stripe публичен', () => {
    expect(isPublicPath('/api/webhooks/stripe')).toBe(true)
  })
})

describe('sanitizeRedirectPath — валидация redirectTo', () => {
  // Happy path
  it('пропускает относительный путь', () => {
    expect(sanitizeRedirectPath('/feed/abc')).toBe('/feed/abc')
  })

  it('декодирует percent-encoded путь (как из ?redirectTo)', () => {
    expect(sanitizeRedirectPath('%2Ffeed%2Fabc')).toBe('/feed/abc')
  })

  it('сохраняет query-часть пути', () => {
    expect(sanitizeRedirectPath('%2Ffeed%2Fabc%3Ffrom%3Demail')).toBe('/feed/abc?from=email')
  })

  // Пустые значения → null
  it('возвращает null для null/undefined/пустой строки', () => {
    expect(sanitizeRedirectPath(null)).toBeNull()
    expect(sanitizeRedirectPath(undefined)).toBeNull()
    expect(sanitizeRedirectPath('')).toBeNull()
  })

  // Open-redirect защита
  it('отвергает protocol-relative //host', () => {
    expect(sanitizeRedirectPath('//evil.com')).toBeNull()
    expect(sanitizeRedirectPath('%2F%2Fevil.com')).toBeNull()
  })

  it('отвергает backslash-трюк /\\host', () => {
    expect(sanitizeRedirectPath('/\\evil.com')).toBeNull()
  })

  it('отвергает абсолютный URL (не начинается с /)', () => {
    expect(sanitizeRedirectPath('https://evil.com')).toBeNull()
    expect(sanitizeRedirectPath('javascript:alert(1)')).toBeNull()
  })

  // Анти-цикл
  it('отвергает /login (точное совпадение и с query)', () => {
    expect(sanitizeRedirectPath('/login')).toBeNull()
    expect(sanitizeRedirectPath('/login?redirectTo=%2Ffeed')).toBeNull()
  })

  it('отвергает /register', () => {
    expect(sanitizeRedirectPath('/register')).toBeNull()
  })

  // Битый encoding
  it('возвращает null при невалидном percent-encoding', () => {
    expect(sanitizeRedirectPath('%E0%A4%A')).toBeNull()
  })
})
