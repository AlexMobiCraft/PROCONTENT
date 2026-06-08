export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface FallbackBody {
  videoUrl?: string
  postMediaId?: string
}

// Контракт готов (auth/валидация/SSRF); серверное извлечение кадра отложено → 501.
export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: FallbackBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const videoUrl = typeof body.videoUrl === 'string' ? body.videoUrl.trim() : ''
  const postMediaId = typeof body.postMediaId === 'string' ? body.postMediaId.trim() : ''

  if (!videoUrl || !postMediaId) {
    return NextResponse.json({ error: 'Missing videoUrl or postMediaId' }, { status: 400 })
  }

  // SSRF-защита: videoUrl обязан указывать на наш Supabase Storage
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl || !videoUrl.startsWith(`${supabaseUrl}/storage/`)) {
    return NextResponse.json({ error: 'Invalid videoUrl' }, { status: 400 })
  }

  return NextResponse.json(
    { error: 'Server-side thumbnail generation is not implemented yet' },
    { status: 501 }
  )
}
