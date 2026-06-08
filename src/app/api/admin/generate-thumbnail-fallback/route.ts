export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface FallbackBody {
  videoUrl?: string
  postMediaId?: string
}

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

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const { videoUrl: rawVideoUrl, postMediaId: rawPostMediaId } = body as FallbackBody
  const videoUrl = typeof rawVideoUrl === 'string' ? rawVideoUrl.trim() : ''
  const postMediaId = typeof rawPostMediaId === 'string' ? rawPostMediaId.trim() : ''

  if (!videoUrl || !postMediaId) {
    return NextResponse.json({ error: 'Missing videoUrl or postMediaId' }, { status: 400 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl || !videoUrl.startsWith(`${supabaseUrl}/storage/`)) {
    return NextResponse.json({ error: 'Invalid videoUrl' }, { status: 400 })
  }

  return NextResponse.json(
    { error: 'Server-side thumbnail generation is not implemented yet' },
    { status: 501 }
  )
}
