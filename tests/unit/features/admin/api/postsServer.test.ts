import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.fn()

function makeChain(result: unknown) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue(result),
  }
  return chain
}

let supabaseChain: ReturnType<typeof makeChain>

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: (...args: unknown[]) => {
      mockFrom(...args)
      return supabaseChain
    },
  }),
}))

import { fetchScheduledPostsServer } from '@/features/admin/api/postsServer'

describe('fetchScheduledPostsServer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('запрашивает posts WHERE status=scheduled ORDER BY scheduled_at ASC', async () => {
    supabaseChain = makeChain({ data: [], error: null })
    await fetchScheduledPostsServer()
    expect(mockFrom).toHaveBeenCalledWith('posts')
    expect(supabaseChain.select).toHaveBeenCalledWith(
      'id, title, category, status, scheduled_at, created_at'
    )
    expect(supabaseChain.eq).toHaveBeenCalledWith('status', 'scheduled')
    expect(supabaseChain.order).toHaveBeenCalledWith('scheduled_at', { ascending: true })
  })

  it('возвращает пустой массив при data=null', async () => {
    supabaseChain = makeChain({ data: null, error: null })
    const result = await fetchScheduledPostsServer()
    expect(result).toEqual([])
  })

  it('возвращает массив постов при успешном запросе', async () => {
    const posts = [
      {
        id: 'p1',
        title: 'Test',
        category: 'insight',
        status: 'scheduled',
        scheduled_at: '2026-06-15T10:00:00Z',
        created_at: '2026-04-01T00:00:00Z',
      },
    ]
    supabaseChain = makeChain({ data: posts, error: null })
    const result = await fetchScheduledPostsServer()
    expect(result).toEqual(posts)
  })

  it('бросает ошибку при error от Supabase', async () => {
    const dbError = { message: 'DB error', code: '42P01' }
    supabaseChain = makeChain({ data: null, error: dbError })
    await expect(fetchScheduledPostsServer()).rejects.toMatchObject(dbError)
  })
})
