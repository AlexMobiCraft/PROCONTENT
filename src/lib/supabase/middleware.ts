import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/types/supabase'

// Fix [AI-Review][Medium]: кеш subscription_status в httpOnly cookie (30s TTL).
// Исключает запрос к БД на каждый переход, сохраняя NFR7 (инвалидация <60s).
const SUBSCRIPTION_CACHE_COOKIE = '__sub_status'
const SUBSCRIPTION_CACHE_TTL = 30 // seconds

export async function updateSession(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // If env vars are missing, pass through without crashing
  if (!supabaseUrl || !supabaseAnonKey) {
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
    pathname.startsWith('/auth/')

  // Redirect authenticated user away from /login
  if (user && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/feed'
    return NextResponse.redirect(url)
  }

  // Redirect unauthenticated users away from protected routes
  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Task 4.1 (NFR7): инвалидация доступа при subscription_status = 'inactive'
  // Проверяем только для аутентифицированных пользователей на защищённых маршрутах
  if (user && !isPublicPath) {
    // Fix [AI-Review][Critical]: кеш привязан к user.id (формат: "userId:status").
    // Предотвращает использование стейлого кеша при перелогине другого пользователя в том же браузере.
    const cachedValue = request.cookies.get(SUBSCRIPTION_CACHE_COOKIE)?.value

    if (cachedValue !== undefined) {
      const separatorIndex = cachedValue.indexOf(':')
      const cachedUserId = separatorIndex >= 0 ? cachedValue.slice(0, separatorIndex) : ''
      const cachedStatus = separatorIndex >= 0 ? cachedValue.slice(separatorIndex + 1) : ''

      if (cachedUserId === user.id) {
        // Кеш принадлежит текущему пользователю — используем без запроса к БД
        if (cachedStatus === 'inactive' || cachedStatus === 'canceled') {
          const url = request.nextUrl.clone()
          url.pathname = '/'
          return NextResponse.redirect(url)
        }
        // Кеш говорит active/none — пропускаем
        return supabaseResponse
      }
      // Кеш принадлежит другому пользователю — игнорируем, делаем запрос к БД
    }

    // Кеша нет — делаем запрос к БД
    // Fix [AI-Review][Medium]: тип выводится из Database generic createServerClient<Database>,
    // исключая ручной cast. При изменении схемы TypeScript сразу укажет на несоответствие.
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('subscription_status')
      .eq('id', user.id)
      .single()

    // [AI-Review][Medium] Fix: Fail-Secure — блокируем при ошибке БД (NFR7)
    // Fix [AI-Review][Low]: userId в логе для точной диагностики
    if (profileError) {
      console.error('[middleware] Ошибка получения профиля для userId:', user.id, profileError)
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }

    const status = profile?.subscription_status ?? 'none'

    // [AI-Review][Critical] Fix: блокируем и canceled статус (AC2/NFR7)
    if (status === 'inactive' || status === 'canceled') {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
    }

    // Кешируем статус в httpOnly cookie (TTL = 30s, формат: "userId:status")
    supabaseResponse.cookies.set(SUBSCRIPTION_CACHE_COOKIE, `${user.id}:${status}`, {
      maxAge: SUBSCRIPTION_CACHE_TTL,
      httpOnly: true,
      sameSite: 'strict',
      path: '/',
    })
  }

  return supabaseResponse
}
