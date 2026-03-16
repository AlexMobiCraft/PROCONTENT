type RateLimitState = {
  count: number
  resetAt: number
}

// 5 запросов на открытие портала в минуту на пользователя
const PORTAL_RATE_LIMIT_MAX = 5
const PORTAL_RATE_LIMIT_WINDOW_MS = 60 * 1000

const portalRateLimitStore = new Map<string, RateLimitState>()

export function consumePortalRateLimit(userId: string, now = Date.now()): { allowed: boolean } {
  // Ленивая очистка: удаляем только запись текущего пользователя если она устарела (O(1))
  const entry = portalRateLimitStore.get(userId)

  if (!entry || entry.resetAt <= now) {
    portalRateLimitStore.set(userId, { count: 1, resetAt: now + PORTAL_RATE_LIMIT_WINDOW_MS })
    return { allowed: true }
  }

  if (entry.count >= PORTAL_RATE_LIMIT_MAX) {
    return { allowed: false }
  }

  entry.count += 1
  return { allowed: true }
}

export function resetPortalRateLimitStore() {
  portalRateLimitStore.clear()
}
