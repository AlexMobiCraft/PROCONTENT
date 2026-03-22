import { describe, expect, it, vi, beforeEach } from 'vitest'

const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockOrder = vi.fn()
const mockLimit = vi.fn()
const mockOr = vi.fn()
const mockLt = vi.fn()
const mockAbortSignal = vi.fn()

function createChain() {
  const chain = {
    select: mockSelect,
    eq: mockEq,
    order: mockOrder,
    limit: mockLimit,
    or: mockOr,
    lt: mockLt,
    abortSignal: mockAbortSignal,
  }
  mockSelect.mockReturnValue(chain)
  mockEq.mockReturnValue(chain)
  mockOrder.mockReturnValue(chain)
  mockLimit.mockReturnValue(chain)
  mockOr.mockReturnValue(chain)
  mockLt.mockReturnValue(chain)
  mockAbortSignal.mockReturnValue(chain)
  return chain
}

const mockFrom = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: mockFrom,
  }),
}))

import { fetchPosts } from '@/features/feed/api/posts'

describe('fetchPosts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('запрашивает published посты с join profiles, сортировка DESC', async () => {
    const chain = createChain()
    mockFrom.mockReturnValue(chain)
    // Возвращаем ровно 10 постов → hasMore = false
    const posts = Array.from({ length: 10 }, (_, i) => ({
      id: `p${i}`,
      created_at: `2026-03-${String(15 - i).padStart(2, '0')}T10:00:00Z`,
    }))
    mockLimit.mockResolvedValue({ data: posts, error: null })

    const result = await fetchPosts()

    expect(mockFrom).toHaveBeenCalledWith('posts')
    expect(mockSelect).toHaveBeenCalledWith(
      '*, profiles!author_id(display_name, avatar_url), post_media(id, media_type, url, thumbnail_url, order_index, is_cover), is_liked:posts_is_liked'
    )
    expect(mockEq).toHaveBeenCalledWith('is_published', true)
    expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(mockOrder).toHaveBeenCalledWith('id', { ascending: false })
    expect(mockLimit).toHaveBeenCalledWith(11) // PAGE_SIZE + 1

    expect(result.posts).toHaveLength(10)
    expect(result.hasMore).toBe(false)
  })

  it('определяет hasMore когда данных больше PAGE_SIZE', async () => {
    const chain = createChain()
    mockFrom.mockReturnValue(chain)
    const posts = Array.from({ length: 11 }, (_, i) => ({
      id: `p${i}`,
      created_at: `2026-03-${String(15 - i).padStart(2, '0')}T10:00:00Z`,
    }))
    mockLimit.mockResolvedValue({ data: posts, error: null })

    const result = await fetchPosts()

    expect(result.posts).toHaveLength(10) // обрезает до PAGE_SIZE
    expect(result.hasMore).toBe(true)
    expect(result.nextCursor).toContain('|') // составной курсор
  })

  it('формирует составной курсор "created_at|id"', async () => {
    const chain = createChain()
    mockFrom.mockReturnValue(chain)
    const posts = [
      { id: '123e4567-e89b-42d3-a456-426614174000', created_at: '2026-03-10T10:00:00Z' },
    ]
    mockLimit.mockResolvedValue({ data: posts, error: null })

    const result = await fetchPosts()

    expect(result.nextCursor).toBe('2026-03-10T10:00:00Z|123e4567-e89b-42d3-a456-426614174000')
  })

  it('использует составной курсор для пагинации через .or()', async () => {
    const chain = createChain()
    mockFrom.mockReturnValue(chain)
    mockLimit.mockResolvedValue({ data: [], error: null })

    await fetchPosts('2026-03-10T10:00:00Z|123e4567-e89b-42d3-a456-426614174000')

    expect(mockOr).toHaveBeenCalledWith(
      'created_at.lt.2026-03-10T10:00:00Z,and(created_at.eq.2026-03-10T10:00:00Z,id.lt.123e4567-e89b-42d3-a456-426614174000)'
    )
  })

  it('fallback: простой курсор без | использует .lt()', async () => {
    const chain = createChain()
    mockFrom.mockReturnValue(chain)
    mockLimit.mockResolvedValue({ data: [], error: null })

    await fetchPosts('2026-03-10T10:00:00Z')

    expect(mockLt).toHaveBeenCalledWith('created_at', '2026-03-10T10:00:00Z')
  })

  it('передаёт AbortSignal в Supabase query when provided', async () => {
    const chain = createChain()
    const controller = new AbortController()
    mockFrom.mockReturnValue(chain)
    mockLimit.mockResolvedValue({ data: [], error: null })

    await fetchPosts(undefined, { signal: controller.signal })

    expect(mockAbortSignal).toHaveBeenCalledWith(controller.signal)
  })

  it('бросает ошибку при некорректном составном cursor', async () => {
    const chain = createChain()
    mockFrom.mockReturnValue(chain)

    await expect(fetchPosts('not-a-date|not-a-uuid')).rejects.toThrow('Invalid cursor format')
    expect(mockOr).not.toHaveBeenCalled()
  })

  it('бросает ошибку при некорректном timestamp cursor legacy-формата', async () => {
    const chain = createChain()
    mockFrom.mockReturnValue(chain)

    await expect(fetchPosts('not-a-date')).rejects.toThrow('Invalid cursor format')
    expect(mockLt).not.toHaveBeenCalled()
  })

  it('бросает ошибку при Supabase error', async () => {
    const chain = createChain()
    mockFrom.mockReturnValue(chain)
    mockLimit.mockResolvedValue({ data: null, error: { message: 'DB error' } })

    await expect(fetchPosts()).rejects.toEqual({ message: 'DB error' })
  })

  it('возвращает nextCursor null при пустом результате', async () => {
    const chain = createChain()
    mockFrom.mockReturnValue(chain)
    mockLimit.mockResolvedValue({ data: [], error: null })

    const result = await fetchPosts()

    expect(result.nextCursor).toBeNull()
    expect(result.hasMore).toBe(false)
    expect(result.posts).toEqual([])
  })
})
