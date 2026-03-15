import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/types/supabase'
import { stripe } from '@/lib/stripe'
import {
  getAuthSuccessRedirectPath,
  INACTIVE_PATH,
  isPublicPath,
  LOGIN_PATH,
  ROOT_PATH,
} from '@/lib/app-routes'

const SUBSCRIPTION_CACHE_COOKIE = '__sub_status'
const DEFAULT_SUBSCRIPTION_CACHE_TTL = 30

async function importHmacKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  )
}

let _cachedHmacKey: { secret: string; key: Promise<CryptoKey> } | null = null

function getSubscriptionCacheTtl() {
  const rawValue = process.env.SUBSCRIPTION_CACHE_TTL_SECONDS
  if (!rawValue) return DEFAULT_SUBSCRIPTION_CACHE_TTL
  const parsedValue = Number.parseInt(rawValue, 10)
  return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : DEFAULT_SUBSCRIPTION_CACHE_TTL
}

function getSubscriptionCacheCookieOptions(maxAge: number) {
  return {
    maxAge,
    httpOnly: true,
    sameSite: 'strict' as const,
    path: '/',
    secure: process.env.NODE_ENV === 'production',
  }
}

function getHmacKey(secret: string): Promise<CryptoKey> {
  if (_cachedHmacKey && _cachedHmacKey.secret === secret) return _cachedHmacKey.key
  const keyPromise = importHmacKey(secret)
  _cachedHmacKey = { secret, key: keyPromise }
  return keyPromise
}

async function hmacSign(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await getHmacKey(secret)
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(data))
  const bytes = new Uint8Array(sig)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

export async function createCacheToken(userId: string, status: string): Promise<string | null> {
  const secret = process.env.COOKIE_SECRET
  if (!secret) return null
  const data = `${userId}:${status}`
  try {
    const sig = await hmacSign(data, secret)
    return `${data}:${sig}`
  } catch { return null }
}

export async function parseCacheToken(token: string): Promise<{ userId: string; status: string } | null> {
  const secret = process.env.COOKIE_SECRET
  if (!secret) return null
  const lastColon = token.lastIndexOf(':')
  if (lastColon < 0) return null
  const sigB64 = token.slice(lastColon + 1)
  const data = token.slice(0, lastColon)
  try {
    const encoder = new TextEncoder()
    const key = await getHmacKey(secret)
    const sigPad = sigB64.replace(/-/g, '+').replace(/_/g, '/').padEnd(sigB64.length + (4 - (sigB64.length % 4)) % 4, '=')
    const sigBytes = Uint8Array.from(atob(sigPad), (c) => c.charCodeAt(0))
    const isValid = await crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(data))
    if (!isValid) return null
  } catch { return null }
  const firstColon = data.indexOf(':')
  if (firstColon < 0) return null
  return { userId: data.slice(0, firstColon), status: data.slice(firstColon + 1) }
}

function redirectWithCookies(url: URL, supabaseResponse: NextResponse): NextResponse {
  const redirectResponse = NextResponse.redirect(url)
  supabaseResponse.headers.forEach((value, key) => {
    if (key === 'location' || key === 'set-cookie') return
    redirectResponse.headers.set(key, value)
  })
  supabaseResponse.cookies.getAll().forEach(({ name, value, ...options }) => {
    if (name === SUBSCRIPTION_CACHE_COOKIE) return
    redirectResponse.cookies.set(name, value, options)
  })
  return redirectResponse
}

export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    const { pathname } = request.nextUrl
    if (!isPublicPath(pathname)) {
      const url = request.nextUrl.clone()
      url.pathname = LOGIN_PATH
      return NextResponse.redirect(url)
    }
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() { return request.cookies.getAll() },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        const existingCookies = supabaseResponse.cookies.getAll()
        supabaseResponse = NextResponse.next({ request })
        existingCookies.forEach(({ name, value, ...options }) => supabaseResponse.cookies.set(name, value, options))
        cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
      },
    },
  })

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl
  const publicPath = isPublicPath(pathname)

  if (user && pathname === LOGIN_PATH) {
    const url = request.nextUrl.clone()
    url.pathname = getAuthSuccessRedirectPath()
    return redirectWithCookies(url, supabaseResponse)
  }

  if (!user && !publicPath) {
    const url = request.nextUrl.clone()
    url.pathname = LOGIN_PATH
    return redirectWithCookies(url, supabaseResponse)
  }

  // FALLBACK CHECK (Story 1.7): Если попали на /inactive, проверяем Stripe
  if (user && pathname === INACTIVE_PATH) {
    console.log('[middleware] Checking /inactive for user:', user.email)
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_status')
      .eq('id', user.id)
      .maybeSingle()
    
    let status = profile?.subscription_status

    if (status !== 'active' && status !== 'trialing' && user.email) {
      console.log('[middleware] Status is not active, checking Stripe for email:', user.email)
      try {
        const customers = await stripe.customers.list({
          email: user.email.toLowerCase(), // Robustness: use lowercase
          limit: 1
        })
        
        console.log('[middleware] Stripe customers found:', customers.data.length)

        if (customers.data.length > 0) {
          const customerId = customers.data[0].id
          let activeSubs = await stripe.subscriptions.list({
            customer: customerId,
            status: 'active',
            limit: 1
          })
          if (activeSubs.data.length === 0) {
            activeSubs = await stripe.subscriptions.list({
              customer: customerId,
              status: 'trialing',
              limit: 1
            })
          }

          console.log('[middleware] Stripe active/trialing subs found:', activeSubs.data.length)

          if (activeSubs.data.length > 0) {
            const sub = activeSubs.data[0]
            console.log('[middleware] Found active sub in Stripe, updating Supabase...')
            const rawPeriodEnd = (sub as unknown as { current_period_end?: number }).current_period_end
            const currentPeriodEnd = rawPeriodEnd ? new Date(rawPeriodEnd * 1000).toISOString() : null

            const { error: updateError } = await supabase
              .from('profiles')
              .update({
                subscription_status: sub.status as 'active' | 'trialing',
                stripe_customer_id: customerId,
                stripe_subscription_id: sub.id,
                current_period_end: currentPeriodEnd,
              })
              .eq('id', user.id)
            
            if (updateError) {
              console.error('[middleware] Update error:', updateError.message)
            } else {
              console.log('[middleware] Successfully updated profile to active!')
              status = 'active'
            }
          }
        }
      } catch (e: any) {
        console.error('[middleware] Fallback check FAILED:', e.message)
      }
    }

    if (status === 'active' || status === 'trialing') {
      console.log('[middleware] Status is now active, redirecting to feed')
      const url = request.nextUrl.clone()
      url.pathname = getAuthSuccessRedirectPath()
      const redirectResponse = redirectWithCookies(url, supabaseResponse)
      
      // Force clear the cache cookie to ensure it's re-evaluated with 'active'
      const token = await createCacheToken(user.id, status)
      if (token) {
        redirectResponse.cookies.set(
          SUBSCRIPTION_CACHE_COOKIE,
          token,
          getSubscriptionCacheCookieOptions(getSubscriptionCacheTtl())
        )
      }
      return redirectResponse
    }
  }

  // PROTECTED ROUTES CHECK
  if (user && !publicPath) {
    const cachedValue = request.cookies.get(SUBSCRIPTION_CACHE_COOKIE)?.value
    if (cachedValue !== undefined) {
      const cached = await parseCacheToken(cachedValue)
      if (cached && cached.userId === user.id) {
        if (cached.status !== 'active' && cached.status !== 'trialing') {
          const url = request.nextUrl.clone()
          url.pathname = INACTIVE_PATH
          return redirectWithCookies(url, supabaseResponse)
        }
        return supabaseResponse
      }
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('subscription_status')
      .eq('id', user.id)
      .maybeSingle()
    
    if (profileError) {
      const url = request.nextUrl.clone()
      url.pathname = ROOT_PATH
      return redirectWithCookies(url, supabaseResponse)
    }

    const status = profile?.subscription_status
    if (status !== 'active' && status !== 'trialing') {
      const url = request.nextUrl.clone()
      url.pathname = INACTIVE_PATH
      const redirectResponse = redirectWithCookies(url, supabaseResponse)
      const token = await createCacheToken(user.id, status ?? 'none')
      if (token) {
        redirectResponse.cookies.set(
          SUBSCRIPTION_CACHE_COOKIE,
          token,
          getSubscriptionCacheCookieOptions(getSubscriptionCacheTtl())
        )
      }
      return redirectResponse
    }

    const token = await createCacheToken(user.id, status ?? 'active')
    if (token) {
      supabaseResponse.cookies.set(
        SUBSCRIPTION_CACHE_COOKIE,
        token,
        getSubscriptionCacheCookieOptions(getSubscriptionCacheTtl())
      )
    }
  }

  return supabaseResponse
}
