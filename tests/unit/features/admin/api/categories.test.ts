import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.fn()

interface MockChain {
  select: ReturnType<typeof vi.fn>
  insert: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
  order: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
  single: ReturnType<typeof vi.fn>
}

function makeChain(result: unknown): MockChain {
  const chain: MockChain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
  }
  return chain
}

let supabaseChain: ReturnType<typeof makeChain>

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: (...args: unknown[]) => {
      mockFrom(...args)
      return supabaseChain
    },
  }),
}))

import { getCategories, createCategory, deleteCategory } from '@/features/admin/api/categories'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getCategories', () => {
  it('возвращает массив категорий', async () => {
    const mockData = [
      { id: '1', name: 'Drugo', slug: 'drugo', created_at: '2026-01-01' },
      { id: '2', name: 'Stories', slug: 'stories', created_at: '2026-01-01' },
    ]
    supabaseChain = makeChain({ data: mockData, error: null })
    ;(supabaseChain.order as ReturnType<typeof vi.fn>).mockResolvedValue({ data: mockData, error: null })

    const result = await getCategories()
    expect(result).toEqual(mockData)
    expect(mockFrom).toHaveBeenCalledWith('categories')
  })

  it('возвращает пустой массив если data null', async () => {
    supabaseChain = makeChain({ data: null, error: null })
    ;(supabaseChain.order as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null, error: null })

    const result = await getCategories()
    expect(result).toEqual([])
  })

  it('выбрасывает ошибку при сбое', async () => {
    supabaseChain = makeChain({ data: null, error: null })
    ;(supabaseChain.order as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null, error: new Error('DB error') })

    await expect(getCategories()).rejects.toThrow('DB error')
  })
})

describe('createCategory', () => {
  it('создаёт и возвращает категорию', async () => {
    const mockCat = { id: '3', name: 'Novost', slug: 'novost', created_at: '2026-01-01' }
    supabaseChain = makeChain({ data: mockCat, error: null })

    const result = await createCategory('Novost', 'novost')
    expect(result).toEqual(mockCat)
    expect(mockFrom).toHaveBeenCalledWith('categories')
  })

  it('выбрасывает понятное сообщение при дубликате (code 23505)', async () => {
    supabaseChain = makeChain({ data: null, error: { code: '23505', message: 'duplicate' } })

    await expect(createCategory('Stories', 'stories')).rejects.toThrow(
      'Kategorija s tem imenom že obstaja'
    )
  })

  it('выбрасывает ошибку БД для других кодов', async () => {
    supabaseChain = makeChain({ data: null, error: { code: '42000', message: 'syntax error' } })

    await expect(createCategory('X', 'x')).rejects.toMatchObject({ code: '42000' })
  })
})

describe('deleteCategory', () => {
  it('удаляет категорию по id', async () => {
    supabaseChain = makeChain({ error: null })
    ;(supabaseChain.eq as ReturnType<typeof vi.fn>).mockResolvedValue({ error: null })

    await expect(deleteCategory('cat-id-1')).resolves.toBeUndefined()
    expect(mockFrom).toHaveBeenCalledWith('categories')
  })

  it('выбрасывает понятное сообщение при FK-нарушении (code 23503)', async () => {
    supabaseChain = makeChain({ error: null })
    ;(supabaseChain.eq as ReturnType<typeof vi.fn>).mockResolvedValue({
      error: { code: '23503', message: 'fk violation' },
    })

    await expect(deleteCategory('cat-id-2')).rejects.toThrow(
      'Kategorije ni mogoče izbrisati, ker jo uporabljajo objave'
    )
  })

  it('выбрасывает DB-ошибку для других кодов', async () => {
    supabaseChain = makeChain({ error: null })
    ;(supabaseChain.eq as ReturnType<typeof vi.fn>).mockResolvedValue({
      error: { code: '42000', message: 'syntax error' },
    })

    await expect(deleteCategory('cat-id-3')).rejects.toMatchObject({ code: '42000' })
  })
})
