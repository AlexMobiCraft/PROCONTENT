import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/auth-middleware'

export async function proxy(request: NextRequest) {
  // Пропускаем подтверждение авторизации, чтобы не сжигать одноразовый токен в Middleware/Proxy
  if (request.nextUrl.pathname.startsWith('/auth/confirm')) {
    return
  }

  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - Public assets (svg, png, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
