import { describe, it, expect } from 'vitest'
import { isPublicPath } from '@/lib/app-routes'

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
