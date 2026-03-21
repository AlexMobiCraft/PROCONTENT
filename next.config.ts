import type { NextConfig } from 'next'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

if (!supabaseUrl && process.env.NODE_ENV !== 'test') {
  throw new Error(
    '[next.config.ts] NEXT_PUBLIC_SUPABASE_URL обязателен для сборки (production и development)'
  )
}

let supabaseRemotePattern: {
  protocol: 'http' | 'https'
  hostname: string
  port?: string
  pathname: string
} | null = null

if (supabaseUrl) {
  try {
    const parsed = new URL(supabaseUrl)
    supabaseRemotePattern = {
      protocol: parsed.protocol.replace(':', '') as 'http' | 'https',
      hostname: parsed.hostname,
      // Добавляем port только если он явно указан в URL —
      // необходимо для локального Supabase (http://127.0.0.1:54321)
      ...(parsed.port ? { port: parsed.port } : {}),
      pathname: '/storage/v1/object/public/**',
    }
  } catch {
    throw new Error(
      `[next.config.ts] NEXT_PUBLIC_SUPABASE_URL не является валидным URL: "${supabaseUrl}"`
    )
  }
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      ...(supabaseRemotePattern ? [supabaseRemotePattern] : []),
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        pathname: '/**',
      },
    ],
  },
}

export default nextConfig
