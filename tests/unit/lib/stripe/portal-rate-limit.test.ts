import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  consumePortalRateLimit,
  resetPortalRateLimitStore,
} from '@/lib/stripe/portal-rate-limit'

describe('consumePortalRateLimit', () => {
  beforeEach(() => {
    resetPortalRateLimitStore()
  })

  afterEach(() => {
    resetPortalRateLimitStore()
  })

  it('разрешает первый запрос пользователя', () => {
    const result = consumePortalRateLimit('user-1')
    expect(result.allowed).toBe(true)
  })

  it('разрешает запросы в пределах лимита (5 запросов)', () => {
    for (let i = 0; i < 5; i++) {
      expect(consumePortalRateLimit('user-1').allowed).toBe(true)
    }
  })

  it('блокирует 6-й запрос (превышение лимита 5 req/min)', () => {
    for (let i = 0; i < 5; i++) {
      consumePortalRateLimit('user-1')
    }
    expect(consumePortalRateLimit('user-1').allowed).toBe(false)
  })

  it('счётчики разных пользователей независимы', () => {
    for (let i = 0; i < 5; i++) {
      consumePortalRateLimit('user-1')
    }
    // user-2 не должен быть заблокирован
    expect(consumePortalRateLimit('user-2').allowed).toBe(true)
  })

  it('сбрасывает счётчик после окончания окна (ленивая очистка)', () => {
    const now = Date.now()
    // Исчерпываем лимит
    for (let i = 0; i < 5; i++) {
      consumePortalRateLimit('user-1', now)
    }
    expect(consumePortalRateLimit('user-1', now).allowed).toBe(false)

    // Симулируем истечение окна (61 секунда вперёд)
    const future = now + 61 * 1000
    expect(consumePortalRateLimit('user-1', future).allowed).toBe(true)
  })

  it('первый запрос после истечения окна начинает новый счётчик', () => {
    const now = Date.now()
    for (let i = 0; i < 5; i++) {
      consumePortalRateLimit('user-1', now)
    }

    const future = now + 61 * 1000
    // Новое окно: должны быть доступны все 5 запросов снова
    for (let i = 0; i < 5; i++) {
      expect(consumePortalRateLimit('user-1', future + i).allowed).toBe(true)
    }
    expect(consumePortalRateLimit('user-1', future + 5).allowed).toBe(false)
  })
})

describe('resetPortalRateLimitStore', () => {
  it('очищает все записи и разрешает запросы заново', () => {
    for (let i = 0; i < 5; i++) {
      consumePortalRateLimit('user-1')
    }
    expect(consumePortalRateLimit('user-1').allowed).toBe(false)

    resetPortalRateLimitStore()

    expect(consumePortalRateLimit('user-1').allowed).toBe(true)
  })
})
