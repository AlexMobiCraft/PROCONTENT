import type { NextConfig } from 'next'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
let supabaseHostname = ''
try {
  supabaseHostname = supabaseUrl ? new URL(supabaseUrl).hostname : ''
} catch {
  // невалидный URL — hostname остаётся пустым
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
