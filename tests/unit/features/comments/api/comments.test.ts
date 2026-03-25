import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchPostComments } from '@/features/comments/api/comments'
import type { CommentWithProfile } from '@/features/comments/types'

// Мок серверного Supabase клиента
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

function makeRow(id: string, parentId: string | null = null): CommentWithProfile {
  return {
    id,
    post_id: 'p-1',
    user_id: `u-${id}`,
    parent_id: parentId,
    content: `Komentar ${id}`,
    created_at: '2026-03-25T10:00:00Z',
    updated_at: '2026-03-25T10:00:00Z',
    profiles: {
      id: `u-${id}`,
      display_name: `Avtor ${id}`,
      avatar_url: null,
      role: 'member',
    },
  }
}

describe('fetchPostComments', () => {
  let mockSelect: ReturnType<typeof vi.fn>
  let mockEq: ReturnType<typeof vi.fn>
  let mockOrder: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    vi.clearAllMocks()

    const { createClient } = await import('@/lib/supabase/server')
    mockOrder = vi.fn()
    mockEq = vi.fn().mockReturnValue({ order: mockOrder })
    mockSelect = vi.fn().mockReturnValue({ eq: mockEq })

    ;(createClient as ReturnType<typeof vi.fn>).mockResolvedValue({
      from: vi.fn().mockReturnValue({ select: mockSelect }),
    })
  })

  it('возвращает пустой массив если нет комментариев', async () => {
    mockOrder.mockResolvedValue({ data: [], error: null })
    const result = await fetchPostComments('p-1')
    expect(result).toEqual([])
  })

  it('группирует ответы под родительским комментарием', async () => {
    const root = makeRow('c1')
    const reply = makeRow('c2', 'c1')
    mockOrder.mockResolvedValue({ data: [root, reply], error: null })

    const result = await fetchPostComments('p-1')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('c1')
    expect(result[0].replies).toHaveLength(1)
    expect(result[0].replies[0].id).toBe('c2')
  })

  it('корневые комментарии имеют пустой массив replies если нет ответов', async () => {
    mockOrder.mockResolvedValue({ data: [makeRow('c1')], error: null })
    const result = await fetchPostComments('p-1')
    expect(result[0].replies).toEqual([])
  })

  it('бросает ошибку если Supabase возвращает error', async () => {
    mockOrder.mockResolvedValue({ data: null, error: { message: 'DB error' } })
    await expect(fetchPostComments('p-1')).rejects.toMatchObject({ message: 'DB error' })
  })

  it('запрашивает комментарии по post_id', async () => {
    mockOrder.mockResolvedValue({ data: [], error: null })
    await fetchPostComments('my-post-id')
    expect(mockEq).toHaveBeenCalledWith('post_id', 'my-post-id')
  })
})
