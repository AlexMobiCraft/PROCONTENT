import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { useAuthStore } from '@/features/auth/store'
import { useFeedStore } from '@/features/feed/store'
import type { Post } from '@/features/feed/types'

const mockFetchPosts = vi.fn()

vi.mock('@/features/feed/api/posts', () => ({
  fetchPosts: (...args: unknown[]) => mockFetchPosts(...args),
}))

vi.mock('@/components/feed/PostCard', () => ({
  PostCard: ({
    post,
  }: {
    post: { id: string; title: string; author?: { isAuthor?: boolean } }
  }) => (
    <div
      data-testid={`post-${post.id}`}
      data-is-author={String(post.author?.isAuthor ?? false)}
    >
      {post.title}
    </div>
  ),
  PostCardSkeleton: () => <div data-testid="skeleton" />,
}))

import { FeedContainer } from '@/features/feed/components/FeedContainer'

function makePost(id: string, category = 'insight'): Post {
  return {
    id,
    author_id: 'user-1',
    title: `Пост ${id}`,
    excerpt: 'Описание',
    content: null,
    category,
    type: 'text',
    image_url: null,
    likes_count: 0,
    comments_count: 0,
    is_published: true,
    is_landing_preview: false,
    is_onboarding: false,
    created_at: '2026-03-15T10:00:00Z',
    updated_at: '2026-03-15T10:00:00Z',
    profiles: { display_name: 'Автор', avatar_url: null },
  }
}

// Mock IntersectionObserver
const mockObserve = vi.fn()
const mockDisconnect = vi.fn()
let latestObserverCallback: IntersectionObserverCallback | null = null

class MockIntersectionObserver {
  constructor(public callback: IntersectionObserverCallback) {
    latestObserverCallback = callback
  }
  observe = mockObserve
  disconnect = mockDisconnect
  unobserve = vi.fn()
  root = null
  rootMargin = ''
  thresholds = [0]
  takeRecords = vi.fn().mockReturnValue([])
}

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)
})

describe('FeedContainer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useFeedStore.getState().reset()
    useAuthStore.getState().clearAuth()
    latestObserverCallback = null
  })

  it('показывает скелетоны при isLoading (AC #3)', () => {
    // isLoading = true по умолчанию в initialState
    mockFetchPosts.mockResolvedValue({ posts: [], nextCursor: null, hasMore: false })

    render(<FeedContainer />)

    const skeletons = screen.getAllByTestId('skeleton')
    expect(skeletons).toHaveLength(5)
    expect(screen.getByRole('status')).toHaveAttribute(
      'aria-label',
      'Загрузка ленты'
    )
  })

  it('показывает empty state когда постов нет (AC #5)', async () => {
    mockFetchPosts.mockResolvedValue({ posts: [], nextCursor: null, hasMore: false })

    render(<FeedContainer />)

    await waitFor(() => {
      expect(
        screen.getByText('Скоро здесь появится контент')
      ).toBeInTheDocument()
    })
  })

  it('рендерит список постов после загрузки (AC #1)', async () => {
    const posts = [makePost('1'), makePost('2')]
    mockFetchPosts.mockResolvedValue({
      posts,
      nextCursor: '2026-03-15T10:00:00Z|2',
      hasMore: true,
    })

    render(<FeedContainer />)

    await waitFor(() => {
      expect(screen.getByTestId('post-1')).toBeInTheDocument()
      expect(screen.getByTestId('post-2')).toBeInTheDocument()
    })
  })

  it('передаёт currentUserId в mapper и показывает isAuthor только для автора', () => {
    useAuthStore.getState().setUser({ id: 'user-1' } as never)
    useFeedStore.getState().setPosts([makePost('1')], null, false)
    useFeedStore.getState().setLoading(false)

    render(<FeedContainer />)

    expect(screen.getByTestId('post-1')).toHaveAttribute('data-is-author', 'true')
  })

  it('показывает "Вы просмотрели все публикации" когда hasMore false (AC #4)', async () => {
    const posts = [makePost('1')]
    mockFetchPosts.mockResolvedValue({
      posts,
      nextCursor: null,
      hasMore: false,
    })

    render(<FeedContainer />)

    await waitFor(() => {
      expect(
        screen.getByText('Вы просмотрели все публикации')
      ).toBeInTheDocument()
    })
  })

  it('восстанавливает из кэша без повторного запроса (AC #6)', async () => {
    // Предзагружаем store
    const posts = [makePost('1')]
    useFeedStore.getState().setPosts(posts, 'cursor', true)
    useFeedStore.getState().setLoading(false)

    render(<FeedContainer />)

    // Посты видны сразу, fetchPosts не вызван
    expect(screen.getByTestId('post-1')).toBeInTheDocument()
    expect(mockFetchPosts).not.toHaveBeenCalled()
  })

  it('фильтрует посты по activeCategory на клиенте', async () => {
    const posts = [makePost('1', 'insight'), makePost('2', 'reels')]
    useFeedStore.getState().setPosts(posts, null, false)
    useFeedStore.getState().setLoading(false)
    useFeedStore.getState().setActiveCategory('reels')

    render(<FeedContainer />)

    expect(screen.queryByTestId('post-1')).not.toBeInTheDocument()
    expect(screen.getByTestId('post-2')).toBeInTheDocument()
  })

  it('не показывает sentinel при пустой отфильтрованной категории (fix infinite loop)', async () => {
    const posts = [makePost('1', 'insight')]
    useFeedStore.getState().setPosts(posts, null, false)
    useFeedStore.getState().setLoading(false)
    useFeedStore.getState().setActiveCategory('reels') // нет постов в этой категории

    render(<FeedContainer />)

    // Должен показать empty state, observer не вызван
    expect(
      screen.getByText('Скоро здесь появится контент')
    ).toBeInTheDocument()
    expect(mockObserve).not.toHaveBeenCalled()
  })

  it('показывает кнопку "Загрузить ещё" для редкой пустой категории, если страницы ещё остались', () => {
    const posts = [makePost('1', 'insight')]
    useFeedStore.getState().setPosts(posts, 'cursor', true)
    useFeedStore.getState().setLoading(false)
    useFeedStore.getState().setActiveCategory('reels')

    render(<FeedContainer />)

    expect(screen.getByRole('button', { name: 'Загрузить ещё' })).toBeInTheDocument()
  })

  it('подключает IntersectionObserver когда есть посты и hasMore', async () => {
    const posts = [makePost('1')]
    useFeedStore.getState().setPosts(posts, 'cursor', true)
    useFeedStore.getState().setLoading(false)

    render(<FeedContainer />)

    expect(mockObserve).toHaveBeenCalled()
  })

  it('показывает error state initial load и позволяет повторить загрузку', async () => {
    const user = userEvent.setup()
    mockFetchPosts
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({ posts: [makePost('1')], nextCursor: null, hasMore: false })

    render(<FeedContainer />)

    await waitFor(() => {
      expect(screen.getByText('Не удалось загрузить ленту')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Повторить' }))

    await waitFor(() => {
      expect(screen.getByTestId('post-1')).toBeInTheDocument()
    })
    expect(mockFetchPosts).toHaveBeenCalledTimes(2)
  })

  it('при ошибке loadMore скрывает sentinel и даёт retry-кнопку', async () => {
    const user = userEvent.setup()
    useFeedStore
      .getState()
      .setPosts([makePost('1')], '2026-03-15T10:00:00Z|123e4567-e89b-42d3-a456-426614174000', true)
    useFeedStore.getState().setLoading(false)
    mockFetchPosts
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({ posts: [makePost('2')], nextCursor: null, hasMore: false })

    const { queryByTestId } = render(<FeedContainer />)

    expect(screen.getByTestId('feed-sentinel')).toBeInTheDocument()

    await act(async () => {
      latestObserverCallback?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver
      )
    })

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })

    expect(queryByTestId('feed-sentinel')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Повторить' }))

    await waitFor(() => {
      expect(screen.getByTestId('post-2')).toBeInTheDocument()
    })
  })

  it('loadMore передаёт AbortSignal в fetchPosts', async () => {
    useFeedStore
      .getState()
      .setPosts([makePost('1')], '2026-03-15T10:00:00Z|123e4567-e89b-42d3-a456-426614174000', true)
    useFeedStore.getState().setLoading(false)
    mockFetchPosts.mockResolvedValue({ posts: [makePost('2')], nextCursor: null, hasMore: false })

    render(<FeedContainer />)

    await act(async () => {
      latestObserverCallback?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver
      )
    })

    await waitFor(() => {
      expect(mockFetchPosts).toHaveBeenCalledWith(
        '2026-03-15T10:00:00Z|123e4567-e89b-42d3-a456-426614174000',
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      )
    })
  })

  it('loadMore не добавляет stale данные при смене категории во время запроса', async () => {
    useFeedStore
      .getState()
      .setPosts([makePost('1')], '2026-03-15T10:00:00Z|123e4567-e89b-42d3-a456-426614174000', true)
    useFeedStore.getState().setLoading(false)

    const loadMoreCalls: {
      resolve: (v: { posts: Post[]; nextCursor: string | null; hasMore: boolean }) => void
      signal?: AbortSignal
    }[] = []
    mockFetchPosts.mockImplementation((_cursor: string | undefined, opts?: { signal?: AbortSignal }) => {
      return new Promise((resolve) => {
        loadMoreCalls.push({ resolve, signal: opts?.signal })
      })
    })

    render(<FeedContainer />)

    // Trigger loadMore через observer
    await act(async () => {
      latestObserverCallback?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver
      )
    })

    // loadMore вызвал fetchPosts — ждёт ответа
    await waitFor(() => {
      expect(loadMoreCalls.length).toBeGreaterThanOrEqual(1)
    })
    const loadMoreCall = loadMoreCalls.find((c) => c.signal)!

    // Меняем категорию — useEffect cleanup должен abort-нуть контроллер
    await act(async () => {
      useFeedStore.getState().changeCategory('reels')
    })

    // Контроллер должен быть aborted
    expect(loadMoreCall.signal?.aborted).toBe(true)

    // Резолвим loadMore — ответ должен быть проигнорирован (aborted)
    await act(async () => {
      loadMoreCall.resolve({ posts: [makePost('stale')], nextCursor: null, hasMore: false })
    })

    // stale пост не должен быть в store
    expect(useFeedStore.getState().posts.find((p) => p.id === 'stale')).toBeUndefined()
  })

  it('отменяет предыдущую initial load при быстрой смене категории и не даёт stale-ответу перезаписать state', async () => {
    type Deferred = {
      resolve: (value: { posts: Post[]; nextCursor: string | null; hasMore: boolean }) => void
      signal?: AbortSignal
    }

    const deferredCalls: Deferred[] = []
    mockFetchPosts.mockImplementation((_: string | undefined, options?: { signal?: AbortSignal }) => {
      return new Promise<{ posts: Post[]; nextCursor: string | null; hasMore: boolean }>((resolve) => {
        deferredCalls.push({ resolve, signal: options?.signal })
      })
    })

    render(<FeedContainer />)

    await waitFor(() => {
      expect(deferredCalls).toHaveLength(1)
    })

    act(() => {
      useFeedStore.getState().changeCategory('reels')
    })

    await waitFor(() => {
      expect(deferredCalls).toHaveLength(2)
    })

    expect(deferredCalls[0].signal?.aborted).toBe(true)

    await act(async () => {
      deferredCalls[0].resolve({
        posts: [makePost('1', 'insight')],
        nextCursor: null,
        hasMore: false,
      })
      deferredCalls[1].resolve({
        posts: [makePost('2', 'reels')],
        nextCursor: null,
        hasMore: false,
      })
    })

    await waitFor(() => {
      expect(screen.getByTestId('post-2')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('post-1')).not.toBeInTheDocument()
  })
})
