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

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
  })),
}))

import { fetchPostById } from '@/features/feed/api/serverPosts'

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
      isLiked: false,
      created_at: '2026-03-15T10:00:00Z',
    })
  })

  it('возвращает isLiked=true при is_liked=true', async () => {
    setupChain()
    mockSingle.mockResolvedValue({ data: makeDbPost({ is_liked: true }), error: null })

    const result = await fetchPostById('post-abc')

    expect(result?.isLiked).toBe(true)
  })

  it('возвращает isLiked=false при is_liked=null (анонимный пользователь)', async () => {
    setupChain()
    mockSingle.mockResolvedValue({ data: makeDbPost({ is_liked: null }), error: null })

    const result = await fetchPostById('post-abc')

    expect(result?.isLiked).toBe(false)
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

  it('использует fallback "Avtor" при null profiles', async () => {
    setupChain()
    mockSingle.mockResolvedValue({ data: makeDbPost({ profiles: null }), error: null })

    const result = await fetchPostById('post-abc')

    expect(result?.author.name).toBe('Avtor')
    expect(result?.author.initials).toBe('A')
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

  it('возвращает null при Supabase error', async () => {
    setupChain()
    mockSingle.mockResolvedValue({ data: null, error: { message: 'DB error' } })

    const result = await fetchPostById('post-abc')

    expect(result).toBeNull()
  })

  it('возвращает null при data=null без error', async () => {
    setupChain()
    mockSingle.mockResolvedValue({ data: null, error: null })

    const result = await fetchPostById('post-abc')

    expect(result).toBeNull()
  })

  it('возвращает null при исключении в catch-блоке', async () => {
    setupChain()
    mockSingle.mockRejectedValue(new Error('Network error'))

    const result = await fetchPostById('post-abc')

    expect(result).toBeNull()
  })

  it('логирует ошибку в catch-блоке (observability)', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    setupChain()
    const error = new Error('Network error')
    mockSingle.mockRejectedValue(error)

    await fetchPostById('post-abc')

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
