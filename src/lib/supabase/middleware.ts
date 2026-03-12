import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/types/supabase'

// Fix [AI-Review][Medium]: кеш subscription_status в httpOnly cookie (30s TTL).
// Исключает запрос к БД на каждый переход, сохраняя NFR7 (инвалидация <60s).
const SUBSCRIPTION_CACHE_COOKIE = '__sub_status'
const SUBSCRIPTION_CACHE_TTL = 30 // seconds

// [AI-Review][Critical] Fix Round 9: HMAC-подписание cookie против спуфинга кеша.
// Без подписи злоумышленник мог изменить cookie в DevTools (e.g. userId:active),
// обходя проверку подписки. С подписью изменение cookie → неверная подпись → DB lookup.
async function hmacSign(data: string, secret: string): Promise<string> {
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
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

// Создаёт подписанный токен кеша: "userId:status:hmac".
// Если COOKIE_SECRET не задан — кеш отключён (всегда запрашиваем БД).
// Fix [AI-Review][Medium] Round 11: оборачиваем crypto.subtle в try/catch.
// Без try/catch ошибка hmacSign (напр. crypto недоступен в Edge) вызвала бы неотловленное
// исключение и сломала Middleware глобально. При ошибке возвращаем null → кеш не устанавливается,
// следующий запрос сделает DB lookup (fail-secure).
export async function createCacheToken(userId: string, status: string): Promise<string | null> {
  const secret = process.env.COOKIE_SECRET
  if (!secret) return null
  const data = `${userId}:${status}`
  try {
    const sig = await hmacSign(data, secret)
    return `${data}:${sig}`
  } catch {
    return null
  }
}

// Верифицирует подписанный токен. Возвращает {userId, status} при успехе, null при ошибке.
// Null означает: либо секрет не задан, либо подпись неверна, либо crypto ошибка → DB lookup обязателен.
export async function parseCacheToken(
  token: string
): Promise<{ userId: string; status: string } | null> {
  const secret = process.env.COOKIE_SECRET
  if (!secret) return null

  // format: "userId:status:signature"
  const lastColon = token.lastIndexOf(':')
  if (lastColon < 0) return null

  const sig = token.slice(lastColon + 1)
  const data = token.slice(0, lastColon)

  // Fix [AI-Review][Medium] Round 10: оборачиваем crypto.subtle в try/catch.
  // Ошибка в hmacSign (напр. невалидный ключ или crypto недоступен) без try/catch
  // вызвала бы падение Middleware для ВСЕХ пользователей (глобальный DoS).
  // При ошибке возвращаем null → принудительный DB lookup (fail-secure).
  let expectedSig: string
  try {
    expectedSig = await hmacSign(data, secret)
  } catch {
    return null
  }
  if (sig !== expectedSig) return null

  const firstColon = data.indexOf(':')
  if (firstColon < 0) return null

  return { userId: data.slice(0, firstColon), status: data.slice(firstColon + 1) }
}

// [AI-Review][Critical] Fix Round 6: копируем куки из supabaseResponse в редирект,
// чтобы не терять обновляемые auth токены (Supabase может обновить refresh token в getUser).
function redirectWithCookies(url: URL, supabaseResponse: NextResponse): NextResponse {
  const redirectResponse = NextResponse.redirect(url)
  supabaseResponse.cookies.getAll().forEach(({ name, value, ...options }) => {
    redirectResponse.cookies.set(name, value, options)
  })
  return redirectResponse
}

export async function updateSession(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // [AI-Review][High] Fix Round 9: fail-secure при отсутствии env переменных.
  // Вместо прозрачного pass-through — блокируем защищённые маршруты редиректом на /login.
  if (!supabaseUrl || !supabaseAnonKey) {
    const { pathname } = request.nextUrl
    const isPublicPath =
      pathname === '/' ||
      pathname === '/login' ||
      pathname === '/inactive' ||
      pathname.startsWith('/auth/')
    if (!isPublicPath) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        )
        supabaseResponse = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        )
      },
    },
  })

  // IMPORTANT: Do not add any logic between createServerClient and getUser()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  const isPublicPath =
    pathname === '/' ||
    pathname === '/login' ||
    pathname === '/inactive' || // Fix [AI-Review][Medium] Round 7: fallback маршрут для неактивных
    pathname.startsWith('/auth/')

  // Redirect authenticated user away from /login
  if (user && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/feed'
    return redirectWithCookies(url, supabaseResponse)
  }

  // Redirect unauthenticated users away from protected routes
  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return redirectWithCookies(url, supabaseResponse)
  }

  // [AI-Review][Medium] Fix Round 9: UX Dead-End на /inactive.
  // Если активный пользователь на /inactive (оплата прошла пока он там был) —
  // делаем свежий DB-запрос и редиректим в /feed. Кеш не используем: нам нужна актуальная информация.
  if (user && pathname === '/inactive') {
    // Fix [AI-Review][High] Round 11: maybeSingle() вместо single().
    // single() бросает PGRST116 если профиль не существует (свежий пользователь, триггер ещё не отработал).
    // PGRST116 → profileError → редирект на / → если layout редиректит auth-юзеров на /feed → бесконечный цикл.
    // maybeSingle() возвращает { data: null, error: null } при 0 строках → status = null → /inactive (безопасно).
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('subscription_status')
      .eq('id', user.id)
      .maybeSingle()

    if (!error) {
      const status = profile?.subscription_status
      if (status === 'active' || status === 'trialing') {
        const url = request.nextUrl.clone()
        url.pathname = '/feed'
        const redirectResponse = redirectWithCookies(url, supabaseResponse)
        // Инвалидируем стейлый кеш, чтобы /feed не перебросил обратно на /inactive
        redirectResponse.cookies.delete(SUBSCRIPTION_CACHE_COOKIE)
        return redirectResponse
      }
    }
    // При ошибке БД или неактивном статусе — остаёмся на /inactive
    return supabaseResponse
  }

  // Task 4.1 (NFR7): инвалидация доступа при subscription_status != active/trialing
  // Проверяем только для аутентифицированных пользователей на защищённых маршрутах
  if (user && !isPublicPath) {
    // [AI-Review][Critical] Fix Round 9: читаем подписанный токен кеша.
    // Неверная подпись или отсутствие COOKIE_SECRET → null → DB lookup.
    // Предотвращает спуфинг через DevTools: изменённый userId:status не пройдёт HMAC-проверку.
    const cachedValue = request.cookies.get(SUBSCRIPTION_CACHE_COOKIE)?.value

    if (cachedValue !== undefined) {
      const cached = await parseCacheToken(cachedValue)

      if (cached && cached.userId === user.id) {
        // [AI-Review][Medium] Fix Round 9: whitelist подход.
        // Разрешаем только active/trialing; 'none' (null в БД) тоже блокируется.
        if (cached.status !== 'active' && cached.status !== 'trialing') {
          const url = request.nextUrl.clone()
          url.pathname = '/inactive'
          return redirectWithCookies(url, supabaseResponse)
        }
        // Кеш говорит active/trialing — пропускаем без DB
        return supabaseResponse
      }
      // Кеш невалиден или принадлежит другому пользователю — игнорируем, делаем DB запрос
    }

    // Кеша нет — делаем запрос к БД
    // Fix [AI-Review][Medium]: тип выводится из Database generic createServerClient<Database>,
    // исключая ручной cast. При изменении схемы TypeScript сразу укажет на несоответствие.
    // Fix [AI-Review][High] Round 11: maybeSingle() вместо single() — см. комментарий выше.
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('subscription_status')
      .eq('id', user.id)
      .maybeSingle()

    // [AI-Review][Medium] Fix: Fail-Secure — блокируем при ошибке БД (NFR7)
    // Fix [AI-Review][Low]: userId в логе для точной диагностики
    // Fix [AI-Review][Critical] Round 5: редиректим на / (не /login), чтобы избежать бесконечного цикла.
    if (profileError) {
      console.error('[middleware] Ошибка получения профиля для userId:', user.id, profileError)
      const url = request.nextUrl.clone()
      url.pathname = '/'
      return redirectWithCookies(url, supabaseResponse)
    }

    // Fix [AI-Review][Low] Round 11: убираем хардкод 'none'.
    // null/undefined проходят whitelist-проверку корректно: null !== 'active' → true → блокируем.
    const status = profile?.subscription_status

    // [AI-Review][Medium] Fix Round 9: whitelist подход.
    // Блокируем всё кроме active/trialing: включая 'none' (новый, не оплативший).
    if (status !== 'active' && status !== 'trialing') {
      const url = request.nextUrl.clone()
      url.pathname = '/inactive'
      // Fix [AI-Review][High] Round 6: кешируем статус перед редиректом,
      // чтобы не делать запрос к БД на каждый последующий переход.
      const redirectResponse = redirectWithCookies(url, supabaseResponse)
      const token = await createCacheToken(user.id, status ?? 'none')
      if (token) {
        redirectResponse.cookies.set(SUBSCRIPTION_CACHE_COOKIE, token, {
          maxAge: SUBSCRIPTION_CACHE_TTL,
          httpOnly: true,
          sameSite: 'strict',
          path: '/',
        })
      }
      return redirectResponse
    }

    // Кешируем активный статус в подписанном httpOnly cookie (TTL = 30s)
    const token = await createCacheToken(user.id, status ?? 'active')
    if (token) {
      supabaseResponse.cookies.set(SUBSCRIPTION_CACHE_COOKIE, token, {
        maxAge: SUBSCRIPTION_CACHE_TTL,
        httpOnly: true,
        sameSite: 'strict',
        path: '/',
      })
    }
  }

  return supabaseResponse
}
