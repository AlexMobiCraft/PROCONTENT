import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { mockFrom, mockCreateAdminClient } = vi.hoisted(() => {
  const mockSingle = vi.fn()
  const mockFrom = vi.fn()
  const mockCreateAdminClient = vi.fn(() => ({ from: mockFrom }))
  return { mockSingle, mockFrom, mockCreateAdminClient }
})

vi.mock('@supabase/supabase-js', () => ({
  createClient: mockCreateAdminClient,
}))

// Mock Supabase server client for user session auth
const mockGetUser = vi.fn()
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: mockGetUser,
    },
  })),
}))

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { POST } from '@/app/api/posts/publish/route'

function makeRequest(body?: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/posts/publish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

const SCHEDULED_POST = {
  id: 'post-sched-1',
  title: 'Scheduled Post',
  excerpt: 'An excerpt',
  status: 'scheduled',
  published_at: null,
}

describe('POST /api/posts/publish', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key')
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://procontent.si')
    vi.stubEnv('NOTIFICATION_API_SECRET', 'test-notification-secret')

    // Default: authenticated user
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } } })

    // Default: fetch post returns scheduled post
    const selectEq = vi.fn(() => ({ single: vi.fn().mockResolvedValue({ data: SCHEDULED_POST, error: null }) }))
    const selectFn = vi.fn(() => ({ eq: selectEq }))
    const updateEq = vi.fn().mockResolvedValue({ error: null })
    const updateFn = vi.fn(() => ({ eq: updateEq }))

    mockFrom.mockImplementation((table: string) => {
      if (table === 'posts') {
        return { select: selectFn, update: updateFn }
      }
      return {}
    })

    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      body: { cancel: vi.fn().mockResolvedValue(undefined) },
    })
  })

  it('возвращает 401 без аутентифицированного пользователя', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const req = makeRequest({ postId: 'post-1' })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('возвращает 400 при отсутствии postId', async () => {
    const req = makeRequest({})
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('возвращает 400 при невалидном JSON', async () => {
    const req = new NextRequest('http://localhost/api/posts/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('возвращает 404 если пост не найден', async () => {
    const selectEq = vi.fn(() => ({ single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }) }))
    mockFrom.mockReturnValue({ select: vi.fn(() => ({ eq: selectEq })) })

    const req = makeRequest({ postId: 'nonexistent' })
    const res = await POST(req)
    expect(res.status).toBe(404)
  })

  it('возвращает 409 если пост не scheduled', async () => {
    const publishedPost = { ...SCHEDULED_POST, status: 'published', published_at: '2026-04-01T00:00:00Z' }
    const selectEq = vi.fn(() => ({ single: vi.fn().mockResolvedValue({ data: publishedPost, error: null }) }))
    mockFrom.mockReturnValue({ select: vi.fn(() => ({ eq: selectEq })) })

    const req = makeRequest({ postId: 'post-1' })
    const res = await POST(req)
    expect(res.status).toBe(409)
  })

  it('публикует scheduled пост и возвращает 200', async () => {
    const req = makeRequest({ postId: 'post-sched-1' })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.published).toBe(true)
  })

  it('вызывает email notification после публикации', async () => {
    const req = makeRequest({ postId: 'post-sched-1' })
    await POST(req)

    expect(mockFetch).toHaveBeenCalledWith(
      'https://procontent.si/api/notifications/new-post',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ id: 'post-sched-1', title: 'Scheduled Post', excerpt: 'An excerpt' }),
      })
    )
  })

  it('возвращает emailError при сбое notification', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    const req = makeRequest({ postId: 'post-sched-1' })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.published).toBe(true)
    expect(body.emailError).toContain('Network error')
  })

  it('возвращает 500 при отсутствии Supabase env vars', async () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '')

    const req = makeRequest({ postId: 'post-1' })
    const res = await POST(req)
    expect(res.status).toBe(500)
  })
})
