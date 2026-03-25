import { describe, expect, it, vi, beforeEach } from 'vitest'

// --- Supabase chain mock ---
const mockTextSearch = vi.fn()
const mockEq = vi.fn()
const mockOrder = vi.fn()
const mockLimit = vi.fn()
const mockSelect = vi.fn()

function createChain(result: { data: unknown; error: unknown } = { data: [], error: null }) {
  const chain = {
    select: mockSelect,
    eq: mockEq,
    textSearch: mockTextSearch,
    order: mockOrder,
    limit: mockLimit,
  }
  mockSelect.mockReturnValue(chain)
  mockEq.mockReturnValue(chain)
  mockTextSearch.mockReturnValue(chain)
  mockOrder.mockReturnValue(chain)
  mockLimit.mockResolvedValue(result)
  return chain
}

const mockFrom = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ from: mockFrom }),
}))

import { searchPosts } from '@/features/search/api/search'

describe('searchPosts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('возвращает пустой массив для пустого запроса', async () => {
    const result = await searchPosts('')
    expect(result).toEqual([])
    expect(mockFrom).not.toHaveBeenCalled()

    const result2 = await searchPosts('   ')
    expect(result2).toEqual([])
  })

  it('вызывает textSearch с type=websearch и config=simple', async () => {
    const posts = [
      { id: '1', title: 'Test', is_published: true, profiles: null, post_media: [] },
    ]
    const chain = createChain({ data: posts, error: null })
    mockFrom.mockReturnValue(chain)

    const result = await searchPosts('content tips')

    expect(mockFrom).toHaveBeenCalledWith('posts')
    expect(mockTextSearch).toHaveBeenCalledWith('fts', 'content tips', {
      type: 'websearch',
      config: 'simple',
    })
    expect(result).toEqual(posts)
  })

  it('фильтрует только опубликованные посты (is_published=true)', async () => {
    const chain = createChain({ data: [], error: null })
    mockFrom.mockReturnValue(chain)

    await searchPosts('keyword')

    expect(mockEq).toHaveBeenCalledWith('is_published', true)
  })

  it('сортирует по created_at DESC', async () => {
    const chain = createChain({ data: [], error: null })
    mockFrom.mockReturnValue(chain)

    await searchPosts('keyword')

    expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: false })
  })

  it('ограничивает результаты лимитом 50', async () => {
    const chain = createChain({ data: [], error: null })
    mockFrom.mockReturnValue(chain)

    await searchPosts('keyword')

    expect(mockLimit).toHaveBeenCalledWith(50)
  })

  it('пробрасывает ошибку Supabase', async () => {
    const chain = createChain({ data: null, error: new Error('DB error') })
    mockFrom.mockReturnValue(chain)

    await expect(searchPosts('keyword')).rejects.toThrow('DB error')
  })

  it('возвращает пустой массив когда data=null без ошибки', async () => {
    const chain = createChain({ data: null, error: null })
    mockFrom.mockReturnValue(chain)

    const result = await searchPosts('keyword')
    expect(result).toEqual([])
  })
})
