import type { NextConfig } from 'next'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

if (!supabaseUrl && process.env.NODE_ENV === 'production') {
  throw new Error(
    '[next.config.ts] NEXT_PUBLIC_SUPABASE_URL обязателен для production-сборки'
  )
}

let supabaseHostname = ''
if (supabaseUrl) {
  try {
    supabaseHostname = new URL(supabaseUrl).hostname
  } catch {
    throw new Error(
      `[next.config.ts] NEXT_PUBLIC_SUPABASE_URL не является валидным URL: "${supabaseUrl}"`
    )
  }
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns: supabaseHostname
      ? [
          {
            protocol: 'https',
            hostname: supabaseHostname,
            pathname: '/storage/v1/object/public/**',
          },
        ]
      : [],
  },
}

export default nextConfig
