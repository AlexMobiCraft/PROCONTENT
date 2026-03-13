type RateLimitState = {
  count: number
  resetAt: number
}

const DEFAULT_RATE_LIMIT_MAX = 60
const DEFAULT_RATE_LIMIT_WINDOW_SECONDS = 60
const rateLimitStore = new Map<string, RateLimitState>()

function getPositiveIntegerEnv(name: string, fallback: number) {
  const rawValue = process.env[name]
  if (!rawValue) {
    return fallback
  }

  const parsedValue = Number.parseInt(rawValue, 10)
  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return fallback
  }

  return parsedValue
}

function pruneExpiredEntries(now: number) {
  for (const [key, value] of rateLimitStore.entries()) {
    if (value.resetAt <= now) {
      rateLimitStore.delete(key)
    }
  }
}

// Fix [AI-Review][Critical] Round 20: Stripe использует малое количество source IP,
// поэтому IP-based лимитирование блокирует легитимные вебхуки.
// x-forwarded-for легко подделать — обходится злоумышленником.
// Решение: фиксированный глобальный ключ для всего Stripe-трафика.
// Защита от неаутентифицированных payload-ов — задача верификации подписи (constructEvent).
export function getStripeWebhookRateLimitKey() {
  return 'stripe-webhook-global'
}

export function consumeStripeWebhookRateLimit(key: string, now = Date.now()) {
  const maxRequests = getPositiveIntegerEnv(
    'STRIPE_WEBHOOK_RATE_LIMIT_MAX',
    DEFAULT_RATE_LIMIT_MAX
  )
  const windowMs =
    getPositiveIntegerEnv(
      'STRIPE_WEBHOOK_RATE_LIMIT_WINDOW_SECONDS',
      DEFAULT_RATE_LIMIT_WINDOW_SECONDS
    ) * 1000

  pruneExpiredEntries(now)

  const currentEntry = rateLimitStore.get(key)
  if (!currentEntry || currentEntry.resetAt <= now) {
    const nextEntry = { count: 1, resetAt: now + windowMs }
    rateLimitStore.set(key, nextEntry)
    return {
      allowed: true,
      remaining: Math.max(maxRequests - nextEntry.count, 0),
      resetAt: nextEntry.resetAt,
    }
  }

  if (currentEntry.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: currentEntry.resetAt,
    }
  }

  currentEntry.count += 1
  rateLimitStore.set(key, currentEntry)

  return {
    allowed: true,
    remaining: Math.max(maxRequests - currentEntry.count, 0),
    resetAt: currentEntry.resetAt,
  }
}

export function resetStripeWebhookRateLimitStore() {
  rateLimitStore.clear()
}
