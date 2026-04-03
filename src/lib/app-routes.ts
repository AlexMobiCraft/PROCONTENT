export const ROOT_PATH = '/'
export const LOGIN_PATH = '/login'
export const INACTIVE_PATH = '/inactive'
export const DEFAULT_AUTH_REDIRECT_PATH = '/feed'
export const ONBOARDING_PATH = '/onboarding'
export const ADMIN_POSTS_CREATE_PATH = '/posts/create'
export const ADMIN_SCHEDULED_POSTS_PATH = '/posts/scheduled'
export const getAdminPostEditPath = (postId: string) => `/posts/${postId}/edit`
export const ADMIN_CATEGORIES_PATH = '/categories'
export const ADMIN_MEMBERS_PATH = '/members'
export const ADMIN_SETTINGS_PATH = '/settings'
// /update-password: в PUBLIC_PATHS чтобы middleware пропускал пользователей с неактивной подпиской
// (recovery-flow), дополнительная защита от неавторизованных — серверная проверка в самой странице
export const PUBLIC_PATHS = [ROOT_PATH, LOGIN_PATH, INACTIVE_PATH, '/update-password', '/register', '/forgot-password', '/email-preferences', '/api/email/unsubscribe'] as const

const PUBLIC_PATH_PREFIXES = ['/auth/', '/api/webhooks/', '/api/checkout'] as const

function normalizeInternalPath(path: string | undefined, fallback: string) {
  if (!path || !path.startsWith('/')) {
    return fallback
  }

  return path
}

export function getAuthSuccessRedirectPath() {
  return normalizeInternalPath(
    process.env.AUTH_SUCCESS_REDIRECT_PATH,
    DEFAULT_AUTH_REDIRECT_PATH
  )
}

export function isPublicPath(pathname: string) {
  return (
    PUBLIC_PATHS.includes(pathname as (typeof PUBLIC_PATHS)[number]) ||
    PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  )
}
