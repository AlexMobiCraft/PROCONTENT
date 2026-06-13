import { createClient } from '@/lib/supabase/server'

/**
 * Результат проверки прав администратора.
 * - ok=true  → вызывающий аутентифицирован и имеет role='admin'.
 * - ok=false → status 401 (нет сессии) или 403 (не админ).
 */
export type RequireAdminResult =
  | { ok: true; userId: string }
  | { ok: false; status: 401 | 403 }

/**
 * Переиспользуемый guard для admin-only Route Handlers.
 *
 * Проверяет пользовательскую сессию (Supabase cookies) и role='admin' в profiles.
 * В отличие от дырявого паттерна `posts/publish` (где проверяется только наличие
 * сессии), здесь обязательна проверка роли — иначе любой авторизованный участник
 * мог бы дёргать admin-API.
 */
export async function requireAdmin(): Promise<RequireAdminResult> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, status: 401 }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return { ok: false, status: 403 }
  }

  return { ok: true, userId: user.id }
}
