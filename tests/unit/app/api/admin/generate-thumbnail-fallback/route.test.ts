import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockGetUser = vi.fn()
const mockSingle = vi.fn()
const mockEq = vi.fn(() => ({ single: mockSingle }))
const mockSelect = vi.fn(() => ({ eq: mockEq }))
const mockFrom = vi.fn(() => ({ select: mockSelect }))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}))

import { POST } from '@/app/api/admin/generate-thumbnail-fallback/route'

const VALID_VIDEO_URL =
  'https://test.supabase.co/storage/v1/object/public/post_media/posts/p1/u/clip.mp4'

function makeRequest(body?: unknown, raw?: string): NextRequest {
  return new NextRequest('http://localhost/api/admin/generate-thumbnail-fallback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: raw ?? (body ? JSON.stringify(body) : undefined),
  })
}

describe('POST /api/admin/generate-thumbnail-fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co')
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockSingle.mockResolvedValue({ data: { role: 'admin' } })
  })

  it('возвращает 401 без аутентифицированного пользователя', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const res = await POST(makeRequest({ videoUrl: VALID_VIDEO_URL, postMediaId: 'm1' }))
    expect(res.status).toBe(401)
  })

  it('возвращает 403 если пользователь не admin', async () => {
    mockSingle.mockResolvedValue({ data: { role: 'member' } })
    const res = await POST(makeRequest({ videoUrl: VALID_VIDEO_URL, postMediaId: 'm1' }))
    expect(res.status).toBe(403)
  })

  it('возвращает 400 при невалидном JSON', async () => {
    const res = await POST(makeRequest(undefined, 'not-json'))
    expect(res.status).toBe(400)
  })

  it('возвращает 400 при отсутствии полей', async () => {
    const res = await POST(makeRequest({ videoUrl: VALID_VIDEO_URL }))
    expect(res.status).toBe(400)
  })

  it('возвращает 400 если videoUrl не из нашего Storage (SSRF-защита)', async () => {
    const res = await POST(
      makeRequest({ videoUrl: 'https://evil.example.com/video.mp4', postMediaId: 'm1' })
    )
    expect(res.status).toBe(400)
  })

  it('возвращает 501 для валидного admin-запроса (извлечение пока не реализовано)', async () => {
    const res = await POST(makeRequest({ videoUrl: VALID_VIDEO_URL, postMediaId: 'm1' }))
    expect(res.status).toBe(501)
  })
})
