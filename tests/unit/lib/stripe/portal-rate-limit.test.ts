import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  PORTAL_RATE_LIMIT_PRUNE_THRESHOLD,
  consumePortalRateLimit,
  getPortalRateLimitStoreSize,
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

describe('pruning устаревших записей', () => {
  beforeEach(() => {
    resetPortalRateLimitStore()
  })

  afterEach(() => {
    resetPortalRateLimitStore()
  })

  it('удаляет устаревшие записи при достижении порога (триггер на истёкшую запись существующего пользователя)', () => {
    const windowMs = 60 * 1000
    const now = Date.now()
    const past = now - windowMs - 1

    // Заполняем store устаревшими записями до порога через существующих (не новых) пользователей
    for (let i = 0; i < PORTAL_RATE_LIMIT_PRUNE_THRESHOLD; i++) {
      consumePortalRateLimit(`active-user-${i}`, past)
    }
    expect(getPortalRateLimitStoreSize()).toBe(PORTAL_RATE_LIMIT_PRUNE_THRESHOLD)

    // Существующий пользователь с истёкшей записью делает новый запрос — должен тригернуть pruning
    consumePortalRateLimit('active-user-0', now)

    // Устаревшие записи других пользователей удалены, остаётся только обновлённый active-user-0
    expect(getPortalRateLimitStoreSize()).toBe(1)
  })

  it('удаляет устаревшие записи при достижении порога', () => {
    const windowMs = 60 * 1000
    const past = Date.now() - windowMs - 1
    const now = Date.now()

    // Заполняем store устаревшими записями до порога
    for (let i = 0; i < PORTAL_RATE_LIMIT_PRUNE_THRESHOLD; i++) {
      consumePortalRateLimit(`stale-user-${i}`, past)
    }
    expect(getPortalRateLimitStoreSize()).toBe(PORTAL_RATE_LIMIT_PRUNE_THRESHOLD)

    // Новый пользователь превышает порог — триггерит прунинг устаревших записей
    consumePortalRateLimit('new-user', now)

    // Устаревшие записи удалены, остаётся только новый пользователь
    expect(getPortalRateLimitStoreSize()).toBe(1)
  })
})
