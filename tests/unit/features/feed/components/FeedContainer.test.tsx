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
    priority,
  }: {
    post: { id: string; title: string; author?: { isAuthor?: boolean } }
    priority?: boolean
  }) => (
    <div
      data-testid={`post-${post.id}`}
      data-is-author={String(post.author?.isAuthor ?? false)}
      data-priority={String(priority ?? false)}
    >
      {post.title}
    </div>
  ),
  PostCardSkeleton: ({ showMedia }: { showMedia?: boolean }) => (
    <div data-testid="skeleton" data-show-media={String(showMedia ?? false)} />
  ),
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
    useAuthStore.getState().setReady(true) // Hydration завершена в тестах
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

  it('скелетоны при начальной загрузке чередуют showMedia для предотвращения CLS', () => {
    mockFetchPosts.mockResolvedValue({ posts: [], nextCursor: null, hasMore: false })

    render(<FeedContainer />)

    const skeletons = screen.getAllByTestId('skeleton')
    expect(skeletons).toHaveLength(5)

    const withMedia = skeletons.filter((s) => s.getAttribute('data-show-media') === 'true')
    const withoutMedia = skeletons.filter((s) => s.getAttribute('data-show-media') === 'false')
    // alternate: i%2===0 → индексы 0,2,4 = true; 1,3 = false
    expect(withMedia).toHaveLength(3)
    expect(withoutMedia).toHaveLength(2)
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

  it('передаёт priority=true первым двум постам, остальным false (LCP)', () => {
    const posts = [makePost('1'), makePost('2'), makePost('3')]
    act(() => {
      useFeedStore.getState().setPosts(posts, null, false)
      useFeedStore.getState().setLoading(false)
    })

    render(<FeedContainer />)

    expect(screen.getByTestId('post-1')).toHaveAttribute('data-priority', 'true')
    expect(screen.getByTestId('post-2')).toHaveAttribute('data-priority', 'true')
    expect(screen.getByTestId('post-3')).toHaveAttribute('data-priority', 'false')
  })

  it('передаёт currentUserId в mapper и показывает isAuthor только для автора', () => {
    act(() => {
      useAuthStore.getState().setUser({ id: 'user-1' } as never)
      useFeedStore.getState().setPosts([makePost('1')], null, false)
      useFeedStore.getState().setLoading(false)
    })

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
    act(() => {
      useFeedStore.getState().setPosts(posts, 'cursor', true)
      useFeedStore.getState().setLoading(false)
    })

    render(<FeedContainer />)

    // Посты видны сразу, fetchPosts не вызван
    expect(screen.getByTestId('post-1')).toBeInTheDocument()
    expect(mockFetchPosts).not.toHaveBeenCalled()
  })

  it('фильтрует посты по activeCategory на клиенте', async () => {
    const posts = [makePost('1', 'insight'), makePost('2', 'reels')]
    act(() => {
      useFeedStore.getState().setPosts(posts, null, false)
      useFeedStore.getState().setLoading(false)
      useFeedStore.getState().setActiveCategory('reels')
    })

    render(<FeedContainer />)

    expect(screen.queryByTestId('post-1')).not.toBeInTheDocument()
    expect(screen.getByTestId('post-2')).toBeInTheDocument()
  })

  it('не показывает sentinel при пустой отфильтрованной категории (fix infinite loop)', async () => {
    const posts = [makePost('1', 'insight')]
    act(() => {
      useFeedStore.getState().setPosts(posts, null, false)
      useFeedStore.getState().setLoading(false)
      useFeedStore.getState().setActiveCategory('reels') // нет постов в этой категории
    })

    render(<FeedContainer />)

    // Должен показать empty state, observer не вызван
    expect(
      screen.getByText('Скоро здесь появится контент')
    ).toBeInTheDocument()
    expect(mockObserve).not.toHaveBeenCalled()
  })

  it('показывает кнопку "Загрузить ещё" для редкой пустой категории, если страницы ещё остались', () => {
    const posts = [makePost('1', 'insight')]
    act(() => {
      useFeedStore.getState().setPosts(posts, 'cursor', true)
      useFeedStore.getState().setLoading(false)
      useFeedStore.getState().setActiveCategory('reels')
    })

    render(<FeedContainer />)

    expect(screen.getByRole('button', { name: 'Загрузить ещё' })).toBeInTheDocument()
  })

  it('подключает IntersectionObserver когда есть посты и hasMore', async () => {
    const posts = [makePost('1')]
    act(() => {
      useFeedStore.getState().setPosts(posts, 'cursor', true)
      useFeedStore.getState().setLoading(false)
    })

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
    act(() => {
      useFeedStore
        .getState()
        .setPosts([makePost('1')], '2026-03-15T10:00:00Z|123e4567-e89b-42d3-a456-426614174000', true)
      useFeedStore.getState().setLoading(false)
    })
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
    act(() => {
      useFeedStore
        .getState()
        .setPosts([makePost('1')], '2026-03-15T10:00:00Z|123e4567-e89b-42d3-a456-426614174000', true)
      useFeedStore.getState().setLoading(false)
    })
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
    act(() => {
      useFeedStore
        .getState()
        .setPosts([makePost('1')], '2026-03-15T10:00:00Z|123e4567-e89b-42d3-a456-426614174000', true)
      useFeedStore.getState().setLoading(false)
    })

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

  it('заменяет sentinel на CTA когда loadMore не добавил видимых постов для текущей категории', async () => {
    // Настройка: есть 1 пост категории 'razobory' (displayedPosts.length > 0)
    const razboroyPost = makePost('1', 'razobory')
    act(() => {
      useFeedStore
        .getState()
        .setPosts(
          [razboroyPost],
          '2026-03-15T10:00:00Z|123e4567-e89b-42d3-a456-426614174000',
          true
        )
      useFeedStore.getState().setLoading(false)
      useFeedStore.getState().setActiveCategory('razobory')
    })

    // loadMore вернёт только 'insight' посты — ни один не 'razobory'
    mockFetchPosts.mockResolvedValue({
      posts: [makePost('2', 'insight'), makePost('3', 'insight')],
      nextCursor: '2026-03-14T10:00:00Z|aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      hasMore: true,
    })

    render(<FeedContainer />)

    // sentinel видим — есть razobory пост, hasMore=true
    expect(screen.getByTestId('feed-sentinel')).toBeInTheDocument()

    // Триггерим loadMore через observer
    await act(async () => {
      latestObserverCallback?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver
      )
    })

    // После загрузки: видимые посты не добавились — sentinel заменяется на CTA
    await waitFor(() => {
      expect(screen.queryByTestId('feed-sentinel')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Загрузить ещё' })).toBeInTheDocument()
    })

    // Razobory пост остаётся видимым
    expect(screen.getByTestId('post-1')).toBeInTheDocument()
  })

  it('сбрасывает stall и возобновляет sentinel когда loadMore добавил видимые посты', async () => {
    const razboroyPost1 = makePost('1', 'razobory')
    act(() => {
      useFeedStore
        .getState()
        .setPosts(
          [razboroyPost1],
          '2026-03-15T10:00:00Z|123e4567-e89b-42d3-a456-426614174000',
          true
        )
      useFeedStore.getState().setLoading(false)
      useFeedStore.getState().setActiveCategory('razobory')
    })

    // Первый вызов: только insight (stall)
    // Второй вызов: добавляет razobory пост (stall сбрасывается)
    mockFetchPosts
      .mockResolvedValueOnce({
        posts: [makePost('2', 'insight')],
        nextCursor: '2026-03-14T10:00:00Z|aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        hasMore: true,
      })
      .mockResolvedValueOnce({
        posts: [makePost('3', 'razobory')],
        nextCursor: null,
        hasMore: false,
      })

    render(<FeedContainer />)

    // Первый observer trigger → stall
    await act(async () => {
      latestObserverCallback?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver
      )
    })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Загрузить ещё' })).toBeInTheDocument()
    })

    // Нажимаем CTA → loadMore снова → добавляет razobory пост → stall сброшен
    const user = (await import('@testing-library/user-event')).default.setup()
    await user.click(screen.getByRole('button', { name: 'Загрузить ещё' }))

    await waitFor(() => {
      expect(screen.getByTestId('post-3')).toBeInTheDocument()
    })
  })

  it('повторно подписывает observer на sentinel после завершения loadMore (fix для высоких экранов)', async () => {
    act(() => {
      useFeedStore
        .getState()
        .setPosts([makePost('1')], '2026-03-15T10:00:00Z|123e4567-e89b-42d3-a456-426614174000', true)
      useFeedStore.getState().setLoading(false)
    })

    let resolveLoadMore!: (v: { posts: Post[]; nextCursor: string | null; hasMore: boolean }) => void
    mockFetchPosts.mockImplementation(
      () => new Promise((r) => { resolveLoadMore = r })
    )

    render(<FeedContainer />)

    // Начальная подписка
    expect(mockObserve).toHaveBeenCalledTimes(1)
    mockObserve.mockClear()

    // Sentinel во viewport → loadMore запускается → isLoadingMore=true → observer отключается
    await act(async () => {
      latestObserverCallback?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver
      )
    })

    // Пока isLoadingMore=true новый observer не создаётся
    expect(mockObserve).not.toHaveBeenCalled()

    // loadMore завершается → isLoadingMore=false → observer пересоздаётся
    await act(async () => {
      resolveLoadMore({ posts: [makePost('2')], nextCursor: 'cursor-2', hasMore: true })
    })

    // Observer должен быть пересоздан и подписан на sentinel
    await waitFor(() => {
      expect(mockObserve).toHaveBeenCalled()
    })
  })

  it('сбрасывает isLoadingMore в false после abort loadMore при смене категории', async () => {
    // Настройка: посты загружены, есть cursor для loadMore
    act(() => {
      useFeedStore
        .getState()
        .setPosts([makePost('1')], '2026-03-15T10:00:00Z|123e4567-e89b-42d3-a456-426614174000', true)
      useFeedStore.getState().setLoading(false)
    })

    // loadMore виснет (pending promise)
    let resolveLoadMore!: (v: { posts: typeof makePost extends (id: string) => infer R ? R[] : never; nextCursor: string | null; hasMore: boolean }) => void
    mockFetchPosts.mockImplementation(() => new Promise((resolve) => { resolveLoadMore = resolve as typeof resolveLoadMore }))

    render(<FeedContainer />)

    // Триггерим loadMore
    await act(async () => {
      latestObserverCallback?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver
      )
    })

    // isLoadingMore должен быть true пока запрос не завершился
    expect(useFeedStore.getState().isLoadingMore).toBe(true)

    // Меняем категорию — cleanup должен abort-нуть loadMore и сбросить isLoadingMore
    await act(async () => {
      useFeedStore.getState().changeCategory('reels')
    })

    // После cleanup isLoadingMore должен быть false
    expect(useFeedStore.getState().isLoadingMore).toBe(false)

    // Резолвим зависший запрос — не должно влиять на состояние
    await act(async () => {
      resolveLoadMore({ posts: [], nextCursor: null, hasMore: false })
    })

    expect(useFeedStore.getState().isLoadingMore).toBe(false)
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
