import { describe, expect, it, vi, beforeEach } from 'vitest'

// Отключаем React cache() — иначе результаты кэшируются между тестами
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  return {
    ...actual,
    cache: <T extends (...args: unknown[]) => unknown>(fn: T): T => fn,
  }
})

const mockSingle = vi.hoisted(() => vi.fn())
const mockEq = vi.hoisted(() => vi.fn())
const mockSelect = vi.hoisted(() => vi.fn())
const mockFrom = vi.hoisted(() => vi.fn())
const mockOrder = vi.hoisted(() => vi.fn())
const mockLimit = vi.hoisted(() => vi.fn())
const mockGetUser = vi.hoisted(() => vi.fn())

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
    auth: { getUser: mockGetUser },
  })),
}))

import { fetchPostById, fetchInitialPostsServer } from '@/features/feed/api/serverPosts'

function makeDbPost(overrides: Record<string, unknown> = {}) {
  return {
    id: 'post-abc',
    author_id: 'user-1',
    title: 'Testna objava',
    excerpt: 'Kratek opis',
    content: 'Celotno besedilo',
    category: 'Stories',
    type: 'text',
    image_url: null,
    likes_count: 5,
    comments_count: 3,
    is_published: true,
    is_liked: null,
    created_at: '2026-03-15T10:00:00Z',
    updated_at: '2026-03-15T10:00:00Z',
    profiles: { display_name: 'Ana Ivanova', avatar_url: null },
    post_media: [],
    ...overrides,
  }
}

function setupChain() {
  const chain = { select: mockSelect, eq: mockEq, single: mockSingle }
  mockFrom.mockReturnValue(chain)
  mockSelect.mockReturnValue(chain)
  mockEq.mockReturnValue(chain)
}

function setupInitialPostsChain() {
  const chain = { select: mockSelect, eq: mockEq, order: mockOrder, limit: mockLimit, single: mockSingle }
  mockFrom.mockReturnValue(chain)
  mockSelect.mockReturnValue(chain)
  mockEq.mockReturnValue(chain)
  mockOrder.mockReturnValue(chain)
}

describe('fetchInitialPostsServer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('бросает ошибку при сбое Supabase (позволяет Next.js error boundary обработать ошибку)', async () => {
    setupInitialPostsChain()
    const dbError = { code: '500', message: 'DB error' }
    mockLimit.mockResolvedValue({ data: null, error: dbError })
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(fetchInitialPostsServer()).rejects.toEqual(dbError)
    expect(consoleSpy).toHaveBeenCalledWith(
      '[fetchInitialPostsServer] Supabase query failed:',
      dbError,
    )
    consoleSpy.mockRestore()
  })
})

describe('fetchPostById', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('запрашивает посты с join profiles и is_liked:posts_is_liked', async () => {
    setupChain()
    mockSingle.mockResolvedValue({ data: makeDbPost(), error: null })

    await fetchPostById('post-abc')

    expect(mockFrom).toHaveBeenCalledWith('posts')
    expect(mockSelect).toHaveBeenCalledWith(
      '*, profiles!author_id(display_name, avatar_url), post_media(id, media_type, url, thumbnail_url, order_index, is_cover), is_liked:posts_is_liked'
    )
    expect(mockEq).toHaveBeenCalledWith('id', 'post-abc')
    expect(mockEq).toHaveBeenCalledWith('is_published', true)
  })

  it('маппит все поля поста в PostDetail', async () => {
    setupChain()
    mockSingle.mockResolvedValue({ data: makeDbPost(), error: null })

    const result = await fetchPostById('post-abc')

    expect(result).toMatchObject({
      id: 'post-abc',
      title: 'Testna objava',
      excerpt: 'Kratek opis',
      content: 'Celotno besedilo',
      category: 'Stories',
      type: 'text',
      imageUrl: null,
      likes: 5,
      comments: 3,
      is_liked: false,
      created_at: '2026-03-15T10:00:00Z',
    })
  })

  it('возвращает is_liked=true при is_liked=true', async () => {
    setupChain()
    mockSingle.mockResolvedValue({ data: makeDbPost({ is_liked: true }), error: null })

    const result = await fetchPostById('post-abc')

    expect(result?.is_liked).toBe(true)
  })

  it('возвращает is_liked=false при is_liked=null (анонимный пользователь)', async () => {
    setupChain()
    mockSingle.mockResolvedValue({ data: makeDbPost({ is_liked: null }), error: null })

    const result = await fetchPostById('post-abc')

    expect(result?.is_liked).toBe(false)
  })

  it('возвращает сырой created_at (форматирование на клиенте)', async () => {
    setupChain()
    mockSingle.mockResolvedValue({ data: makeDbPost(), error: null })

    const result = await fetchPostById('post-abc')

    expect(result?.created_at).toBe('2026-03-15T10:00:00Z')
  })

  it('маппит имя автора и инициалы из profiles', async () => {
    setupChain()
    mockSingle.mockResolvedValue({ data: makeDbPost(), error: null })

    const result = await fetchPostById('post-abc')

    expect(result?.author.name).toBe('Ana Ivanova')
    expect(result?.author.initials).toBe('AI')
  })

  it('маппит avatar_url автора из profiles', async () => {
    setupChain()
    mockSingle.mockResolvedValue({
      data: makeDbPost({ profiles: { display_name: 'Ana Ivanova', avatar_url: 'https://example.com/avatar.jpg' } }),
      error: null,
    })

    const result = await fetchPostById('post-abc')

    expect(result?.author.avatar_url).toBe('https://example.com/avatar.jpg')
  })

  it('возвращает avatar_url=null если profiles.avatar_url=null', async () => {
    setupChain()
    mockSingle.mockResolvedValue({
      data: makeDbPost({ profiles: { display_name: 'Ana Ivanova', avatar_url: null } }),
      error: null,
    })

    const result = await fetchPostById('post-abc')

    expect(result?.author.avatar_url).toBeNull()
  })

  it('использует fallback "Avtor" при null profiles', async () => {
    setupChain()
    mockSingle.mockResolvedValue({ data: makeDbPost({ profiles: null }), error: null })

    const result = await fetchPostById('post-abc')

    expect(result?.author.name).toBe('Avtor')
    expect(result?.author.initials).toBe('A')
  })

  it('инициалы: split(/\\s+/) корректно обрабатывает двойные пробелы', async () => {
    setupChain()
    mockSingle.mockResolvedValue({
      data: makeDbPost({ profiles: { display_name: 'Ana  Ivanova', avatar_url: null } }),
      error: null,
    })

    const result = await fetchPostById('post-abc')

    expect(result?.author.name).toBe('Ana  Ivanova')
    expect(result?.author.initials).toBe('AI')
  })

  it('использует fallback "Avtor" при null display_name', async () => {
    setupChain()
    mockSingle.mockResolvedValue({
      data: makeDbPost({ profiles: { display_name: null, avatar_url: null } }),
      error: null,
    })

    const result = await fetchPostById('post-abc')

    expect(result?.author.name).toBe('Avtor')
  })

  it('маппит URL обложки из post_media в imageUrl (не из устаревшего image_url)', async () => {
    setupChain()
    mockSingle.mockResolvedValue({
      data: makeDbPost({
        image_url: 'https://example.com/old-photo.jpg',
        post_media: [
          {
            id: 'm1',
            post_id: 'post-abc',
            media_type: 'image',
            url: 'https://example.com/media-cover.jpg',
            thumbnail_url: null,
            order_index: 0,
            is_cover: true,
          },
        ],
      }),
      error: null,
    })

    const result = await fetchPostById('post-abc')

    // imageUrl берётся из coverItem.url (новая схема), а не из posts.image_url
    expect(result?.imageUrl).toBe('https://example.com/media-cover.jpg')
  })

  it('imageUrl равен null когда post_media пуст', async () => {
    setupChain()
    mockSingle.mockResolvedValue({
      data: makeDbPost({ image_url: 'https://example.com/photo.jpg', post_media: [] }),
      error: null,
    })

    const result = await fetchPostById('post-abc')

    expect(result?.imageUrl).toBeNull()
  })

  it('маппит null content → null', async () => {
    setupChain()
    mockSingle.mockResolvedValue({ data: makeDbPost({ content: null }), error: null })

    const result = await fetchPostById('post-abc')

    expect(result?.content).toBeNull()
  })

  it('возвращает null при PGRST116 error (пост не найден — настоящий 404)', async () => {
    setupChain()
    mockSingle.mockResolvedValue({
      data: null,
      error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' },
    })

    const result = await fetchPostById('post-abc')

    expect(result).toBeNull()
  })

  it('бросает ошибку при серверной ошибке Supabase (не PGRST116) — предотвращает ложный 404', async () => {
    setupChain()
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const dbError = { code: '500', message: 'DB connection failed' }
    mockSingle.mockResolvedValue({ data: null, error: dbError })

    await expect(fetchPostById('post-abc')).rejects.toEqual(dbError)
    expect(consoleSpy).toHaveBeenCalledWith(
      '[fetchPostById] Supabase query failed:',
      'post-abc',
      dbError,
    )
    consoleSpy.mockRestore()
  })

  it('возвращает null при data=null без error', async () => {
    setupChain()
    mockSingle.mockResolvedValue({ data: null, error: null })

    const result = await fetchPostById('post-abc')

    expect(result).toBeNull()
  })

  it('бросает исключение в catch-блоке (re-throw → Next.js error.tsx)', async () => {
    setupChain()
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const networkError = new Error('Network error')
    mockSingle.mockRejectedValue(networkError)

    await expect(fetchPostById('post-abc')).rejects.toThrow('Network error')
    consoleSpy.mockRestore()
  })

  it('логирует ошибку в catch-блоке (observability)', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    setupChain()
    const error = new Error('Network error')
    mockSingle.mockRejectedValue(error)

    await expect(fetchPostById('post-abc')).rejects.toThrow('Network error')

    expect(consoleSpy).toHaveBeenCalledWith(
      '[fetchPostById] Failed to fetch post:',
      'post-abc',
      error,
    )
    consoleSpy.mockRestore()
  })

  it('возвращает mediaItem=null при пустом post_media', async () => {
    setupChain()
    mockSingle.mockResolvedValue({ data: makeDbPost({ post_media: [] }), error: null })

    const result = await fetchPostById('post-abc')

    expect(result?.mediaItem).toBeNull()
  })

  it('возвращает coverItem из post_media (is_cover=true)', async () => {
    setupChain()
    const coverMedia = {
      id: 'media-1',
      post_id: 'post-abc',
      url: 'https://example.com/cover.jpg',
      media_type: 'image',
      thumbnail_url: null,
      order_index: 1,
      is_cover: true,
      created_at: '2026-03-15T10:00:00Z',
    }
    const otherMedia = {
      id: 'media-2',
      post_id: 'post-abc',
      url: 'https://example.com/other.jpg',
      media_type: 'image',
      thumbnail_url: null,
      order_index: 0,
      is_cover: false,
      created_at: '2026-03-15T10:00:00Z',
    }
    mockSingle.mockResolvedValue({
      data: makeDbPost({ post_media: [otherMedia, coverMedia] }),
      error: null,
    })

    const result = await fetchPostById('post-abc')

    expect(result?.mediaItem?.url).toBe('https://example.com/cover.jpg')
  })

  it('fallback: первый по order_index при отсутствии is_cover', async () => {
    setupChain()
    const media1 = {
      id: 'media-1',
      post_id: 'post-abc',
      url: 'https://example.com/first.jpg',
      media_type: 'image',
      thumbnail_url: null,
      order_index: 0,
      is_cover: false,
      created_at: '2026-03-15T10:00:00Z',
    }
    const media2 = {
      id: 'media-2',
      post_id: 'post-abc',
      url: 'https://example.com/second.jpg',
      media_type: 'image',
      thumbnail_url: null,
      order_index: 1,
      is_cover: false,
      created_at: '2026-03-15T10:00:00Z',
    }
    mockSingle.mockResolvedValue({
      data: makeDbPost({ post_media: [media2, media1] }),
      error: null,
    })

    const result = await fetchPostById('post-abc')

    expect(result?.mediaItem?.url).toBe('https://example.com/first.jpg')
  })
})
