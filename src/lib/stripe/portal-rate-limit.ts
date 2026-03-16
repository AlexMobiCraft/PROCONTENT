type RateLimitState = {
  count: number
  resetAt: number
}

// 5 запросов на открытие портала в минуту на пользователя
const PORTAL_RATE_LIMIT_MAX = 5
const PORTAL_RATE_LIMIT_WINDOW_MS = 60 * 1000
// Прунинг устаревших записей при достижении порога (защита от утечки памяти)
export const PORTAL_RATE_LIMIT_PRUNE_THRESHOLD = 100

const portalRateLimitStore = new Map<string, RateLimitState>()

function pruneExpired(now: number): void {
  // Map итерируется в порядке добавления. Благодаря паттерну delete+set при сбросе окна
  // (consumePortalRateLimit ниже), записи с наиболее старым resetAt всегда находятся
  // в начале Map. Удаляем с начала пока не встретим первую живую запись — O(k),
  // где k = количество устаревших записей в начале Map.
  for (const [key, state] of portalRateLimitStore) {
    if (state.resetAt > now) break
    portalRateLimitStore.delete(key)
  }
}

export function consumePortalRateLimit(userId: string, now = Date.now()): { allowed: boolean } {
  // Ленивая очистка: удаляем только запись текущего пользователя если она устарела (O(1))
  const entry = portalRateLimitStore.get(userId)

  if (!entry || entry.resetAt <= now) {
    // Периодический прунинг при накоплении записей — триггерится как для новых пользователей,
    // так и для пользователей с истёкшим окном (иначе store рос бы неограниченно при 100+ активных)
    if (portalRateLimitStore.size >= PORTAL_RATE_LIMIT_PRUNE_THRESHOLD) {
      pruneExpired(now)
    }
    // delete + set перемещает ключ в КОНЕЦ Map (порядок вставки), чтобы pruneExpired
    // корректно сканировал старейшие записи с начала и не застревал на часто сбрасывающих пользователях
    portalRateLimitStore.delete(userId)
    portalRateLimitStore.set(userId, { count: 1, resetAt: now + PORTAL_RATE_LIMIT_WINDOW_MS })
    return { allowed: true }
  }

  if (entry.count >= PORTAL_RATE_LIMIT_MAX) {
    return { allowed: false }
  }

  entry.count += 1
  return { allowed: true }
}

// Только для тестирования — в production не выполняют действий
export function resetPortalRateLimitStore() {
  if (process.env.NODE_ENV !== 'test') return
  portalRateLimitStore.clear()
}

export function getPortalRateLimitStoreSize(): number {
  if (process.env.NODE_ENV !== 'test') return 0
  return portalRateLimitStore.size
}
