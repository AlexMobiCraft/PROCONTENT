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

  it('показывает sentinel (не CTA) в empty state для редкой категории пока есть страницы', () => {
    const posts = [makePost('1', 'insight')]
    act(() => {
      useFeedStore.getState().setPosts(posts, 'cursor', true)
      useFeedStore.getState().setLoading(false)
      useFeedStore.getState().setActiveCategory('reels')
    })

    mockFetchPosts.mockResolvedValue({
      posts: [],
      nextCursor: null,
      hasMore: false,
    })

    render(<FeedContainer />)

    // Sentinel активен — автопрокрутка без ручного CTA
    expect(screen.getByTestId('feed-sentinel')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Загрузить ещё' })).not.toBeInTheDocument()
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

  it('sentinel остаётся активным при stall — автопрокрутка без ручного CTA', async () => {
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

    // loadMore вернёт только 'insight' посты — ни один не 'razobory' → stall
    mockFetchPosts.mockResolvedValue({
      posts: [makePost('2', 'insight'), makePost('3', 'insight')],
      nextCursor: '2026-03-14T10:00:00Z|aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      hasMore: true,
    })

    render(<FeedContainer />)

    // sentinel видим — есть razobory пост, hasMore=true, stallCount=0
    expect(screen.getByTestId('feed-sentinel')).toBeInTheDocument()

    // Триггерим loadMore через observer
    await act(async () => {
      latestObserverCallback?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver
      )
    })

    // После стагнации: sentinel ОСТАЁТСЯ (stallCount=1 < 3), нет CTA "Загрузить ещё"
    await waitFor(() => {
      expect(useFeedStore.getState().isLoadingMore).toBe(false)
    })
    expect(screen.getByTestId('feed-sentinel')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Загрузить ещё' })).not.toBeInTheDocument()

    // Razobory пост остаётся видимым
    expect(screen.getByTestId('post-1')).toBeInTheDocument()
  })

  it('сбрасывает stallCount и sentinel остаётся когда loadMore добавил видимые посты', async () => {
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
    // Второй вызов: добавляет razobory пост (stallCount сбрасывается)
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

    // Первый observer trigger → stall (stallCount=1), sentinel остаётся
    await act(async () => {
      latestObserverCallback?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver
      )
    })

    await waitFor(() => {
      expect(useFeedStore.getState().isLoadingMore).toBe(false)
    })
    // sentinel должен оставаться (stallCount=1 < 3)
    expect(screen.getByTestId('feed-sentinel')).toBeInTheDocument()

    // Второй observer trigger → добавляет razobory пост → stallCount сброшен в 0
    await act(async () => {
      latestObserverCallback?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver
      )
    })

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

  it('скелетоны гидрации (isAuthReady=false, posts=[]) чередуют showMedia для предотвращения CLS', () => {
    // Отменяем готовность auth — FeedContainer покажет hydration-скелетоны
    act(() => {
      useAuthStore.getState().setReady(false)
      // posts.length === 0 из reset() в beforeEach
    })
    mockFetchPosts.mockResolvedValue({ posts: [], nextCursor: null, hasMore: false })

    render(<FeedContainer />)

    // Гидрационные скелетоны (aria-label "Загрузка приложения")
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Загрузка приложения')
    const skeletons = screen.getAllByTestId('skeleton')
    expect(skeletons).toHaveLength(5)

    // alternate: i%2===0 → индексы 0,2,4 = true; 1,3 = false (3 с медиа, 2 без)
    const withMedia = skeletons.filter((s) => s.getAttribute('data-show-media') === 'true')
    const withoutMedia = skeletons.filter((s) => s.getAttribute('data-show-media') === 'false')
    expect(withMedia).toHaveLength(3)
    expect(withoutMedia).toHaveLength(2)
  })

  it('рендерит sentinel в empty state когда нет постов для категории и hasMore=true (fix бесконечного scroll)', () => {
    // Есть посты другой категории, hasMore=true — sentinel должен быть в empty state
    const posts = [makePost('1', 'insight')]
    act(() => {
      useFeedStore.getState().setPosts(posts, 'cursor', true) // hasMore=true
      useFeedStore.getState().setLoading(false)
      useFeedStore.getState().setActiveCategory('reels') // нет 'reels' постов → empty state
    })

    render(<FeedContainer />)

    // Empty state виден
    expect(screen.getByText('Скоро здесь появится контент')).toBeInTheDocument()
    // Sentinel присутствует — auto-scroll может продолжать поиск постов
    expect(screen.getByTestId('feed-sentinel')).toBeInTheDocument()
    expect(mockObserve).toHaveBeenCalled()
  })

  it('рендерит посты из кэша даже при isAuthReady=false (LCP fix)', () => {
    const posts = [makePost('1'), makePost('2')]
    act(() => {
      useFeedStore.getState().setPosts(posts, null, false)
      useFeedStore.getState().setLoading(false)
      useAuthStore.getState().setReady(false)
    })

    render(<FeedContainer />)

    expect(screen.getByTestId('post-1')).toBeInTheDocument()
    expect(screen.getByTestId('post-2')).toBeInTheDocument()
    expect(screen.queryByRole('status', { name: 'Загрузка приложения' })).not.toBeInTheDocument()
  })

  it('после MAX_STALL_RETRIES=3 последовательных stall-ов убирает sentinel и показывает конечное сообщение', async () => {
    const razboroyPost = makePost('1', 'razobory')
    act(() => {
      useFeedStore
        .getState()
        .setPosts([razboroyPost], '2026-03-15T10:00:00Z|123e4567-e89b-42d3-a456-426614174000', true)
      useFeedStore.getState().setLoading(false)
      useFeedStore.getState().setActiveCategory('razobory')
    })

    // Всегда возвращает только insight (stall для razobory)
    mockFetchPosts.mockResolvedValue({
      posts: [makePost('x', 'insight')],
      nextCursor: '2026-03-14T10:00:00Z|aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      hasMore: true,
    })

    render(<FeedContainer />)

    // Stall #1 — через observer (sentinel есть → IO срабатывает)
    await act(async () => {
      latestObserverCallback?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver
      )
    })
    await waitFor(() => expect(useFeedStore.getState().isLoadingMore).toBe(false))

    // Stall #2 — через observer (sentinel пересоздан после isLoadingMore=false)
    await act(async () => {
      latestObserverCallback?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver
      )
    })
    await waitFor(() => expect(useFeedStore.getState().isLoadingMore).toBe(false))

    // Stall #3 — через observer → stallCount=3 → sentinel убирается, конечное сообщение
    await act(async () => {
      latestObserverCallback?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver
      )
    })
    await waitFor(() => {
      expect(screen.queryByTestId('feed-sentinel')).not.toBeInTheDocument()
      expect(
        screen.getByText('Больше публикаций в этой категории не найдено')
      ).toBeInTheDocument()
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

    // loadMore виснет (pending promise), запоминаем AbortSignal
    const loadMoreCalls: Array<{
      resolve: (v: { posts: Post[]; nextCursor: string | null; hasMore: boolean }) => void
      signal?: AbortSignal
    }> = []
    mockFetchPosts.mockImplementation((_cursor: string | undefined, opts?: { signal?: AbortSignal }) => {
      return new Promise<{ posts: Post[]; nextCursor: string | null; hasMore: boolean }>((resolve) => {
        loadMoreCalls.push({ resolve, signal: opts?.signal })
      })
    })

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

    // После cleanup isLoadingMore сброшен в false
    expect(useFeedStore.getState().isLoadingMore).toBe(false)

    // AbortSignal первого запроса должен быть aborted
    await waitFor(() => expect(loadMoreCalls.length).toBeGreaterThanOrEqual(1))
    expect(loadMoreCalls[0].signal?.aborted).toBe(true)

    // Резолвим зависший запрос со "stale" постом — stale данные должны быть проигнорированы
    await act(async () => {
      loadMoreCalls[0].resolve({ posts: [makePost('stale-aborted')], nextCursor: null, hasMore: false })
    })

    // Stale пост из отменённого запроса не должен попасть в store
    expect(useFeedStore.getState().posts.find((p) => p.id === 'stale-aborted')).toBeUndefined()
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

  // --- Iteration 10: Items 1+3 (SSR-safe гидрация через initialData проп) ---

  it('гидратирует store из initialData в useEffect (SSR-safe, не в render)', async () => {
    const posts = [makePost('1'), makePost('2')]
    // Store пуст до рендера
    expect(useFeedStore.getState().posts).toHaveLength(0)

    render(<FeedContainer initialData={{ posts, nextCursor: 'cursor', hasMore: true }} />)

    // После useEffect store гидратирован и посты видны
    await waitFor(() => {
      expect(screen.getByTestId('post-1')).toBeInTheDocument()
      expect(screen.getByTestId('post-2')).toBeInTheDocument()
    })
    expect(useFeedStore.getState().posts).toHaveLength(2)
    expect(useFeedStore.getState().isLoading).toBe(false)
    // fetchPosts не вызван — данные из initialData
    expect(mockFetchPosts).not.toHaveBeenCalled()
  })

  it('не перезаписывает store из initialData если store уже заполнен (защита кэша навигации)', async () => {
    const cachedPosts = [makePost('1'), makePost('2'), makePost('3')]
    act(() => {
      useFeedStore.getState().setPosts(cachedPosts, null, false)
      useFeedStore.getState().setLoading(false)
    })

    // initialData содержит только 1 пост — не должен перезаписать кэш
    render(<FeedContainer initialData={{ posts: [makePost('x')], nextCursor: null, hasMore: false }} />)

    await waitFor(() => {
      expect(screen.getByTestId('post-1')).toBeInTheDocument()
    })
    // Store остаётся с 3 кэшированными постами
    expect(useFeedStore.getState().posts).toHaveLength(3)
  })

  it('использует initialData для первого render пока store пуст (нет flash скелетонов)', () => {
    const posts = [makePost('1'), makePost('2')]
    // Store пуст (isLoading=true), но initialData есть — показываем посты без скелетонов
    render(<FeedContainer initialData={{ posts, nextCursor: null, hasMore: false }} />)

    // Посты видны сразу при первом render — нет flash скелетонов
    expect(screen.getByTestId('post-1')).toBeInTheDocument()
    expect(screen.getByTestId('post-2')).toBeInTheDocument()
    expect(screen.queryByRole('status', { name: 'Загрузка ленты' })).not.toBeInTheDocument()
  })

  // --- Iteration 10: Item 4 (auto-trigger loadMore при нулевом росте sentinel) ---

  // --- Iteration 11: Items 1+3 (UX Dead End + A11y) ---

  it('экран ошибки начальной загрузки (posts.length===0) имеет role="alert"', async () => {
    mockFetchPosts.mockRejectedValueOnce(new Error('network'))

    render(<FeedContainer />)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.getByText('Не удалось загрузить ленту')).toBeInTheDocument()
    })
  })

  it('кнопка "Искать дальше" появляется после MAX_STALL_RETRIES в главной ленте и сбрасывает поиск', async () => {
    const user = userEvent.setup()
    const razboroyPost = makePost('1', 'razobory')
    act(() => {
      useFeedStore
        .getState()
        .setPosts([razboroyPost], '2026-03-15T10:00:00Z|123e4567-e89b-42d3-a456-426614174000', true)
      useFeedStore.getState().setLoading(false)
      useFeedStore.getState().setActiveCategory('razobory')
    })

    // Всегда возвращает только insight (stall для razobory)
    mockFetchPosts.mockResolvedValue({
      posts: [makePost('x', 'insight')],
      nextCursor: '2026-03-14T10:00:00Z|aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      hasMore: true,
    })

    render(<FeedContainer />)

    // Симулируем 3 stall через observer
    for (let i = 0; i < 3; i++) {
      await act(async () => {
        latestObserverCallback?.(
          [{ isIntersecting: true } as IntersectionObserverEntry],
          {} as IntersectionObserver
        )
      })
      await waitFor(() => expect(useFeedStore.getState().isLoadingMore).toBe(false))
    }

    // После 3 stall: кнопка "Искать дальше" появилась, sentinel скрыт
    await waitFor(() => {
      expect(screen.queryByTestId('feed-sentinel')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Искать дальше' })).toBeInTheDocument()
    })

    // Клик "Искать дальше" → сбрасывает stallCount → sentinel снова видим
    await user.click(screen.getByRole('button', { name: 'Искать дальше' }))

    await waitFor(() => {
      expect(screen.getByTestId('feed-sentinel')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Искать дальше' })).not.toBeInTheDocument()
    })
  })

  it('кнопка "Искать дальше" появляется в empty state после MAX_STALL_RETRIES и сбрасывает поиск', async () => {
    const user = userEvent.setup()
    // Настройка: есть insight пост, активна категория reels (empty state)
    const insightPost = makePost('1', 'insight')
    act(() => {
      useFeedStore
        .getState()
        .setPosts([insightPost], '2026-03-15T10:00:00Z|123e4567-e89b-42d3-a456-426614174000', true)
      useFeedStore.getState().setLoading(false)
      useFeedStore.getState().setActiveCategory('reels')
    })

    // Всегда возвращает только insight (stall для reels)
    mockFetchPosts.mockResolvedValue({
      posts: [makePost('x', 'insight')],
      nextCursor: '2026-03-14T10:00:00Z|aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      hasMore: true,
    })

    render(<FeedContainer />)

    // Empty state виден, sentinel активен (stallCount=0 < 3)
    expect(screen.getByText('Скоро здесь появится контент')).toBeInTheDocument()
    expect(screen.getByTestId('feed-sentinel')).toBeInTheDocument()

    // Симулируем 3 stall (через auto-trigger + observer)
    for (let i = 0; i < 3; i++) {
      await waitFor(() => expect(useFeedStore.getState().isLoadingMore).toBe(false))
      await act(async () => {
        latestObserverCallback?.(
          [{ isIntersecting: true } as IntersectionObserverEntry],
          {} as IntersectionObserver
        )
      })
      await waitFor(() => expect(useFeedStore.getState().isLoadingMore).toBe(false))
    }

    // Кнопка "Искать дальше" появилась в empty state, sentinel скрыт
    await waitFor(() => {
      expect(screen.queryByTestId('feed-sentinel')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Искать дальше' })).toBeInTheDocument()
    })

    // Клик → stallCount сбрасывается → sentinel снова активен
    await user.click(screen.getByRole('button', { name: 'Искать дальше' }))

    await waitFor(() => {
      expect(screen.getByTestId('feed-sentinel')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Искать дальше' })).not.toBeInTheDocument()
    })
  })

  // --- Iteration 12: Items 2+3 (Race condition guard + A11y конец ленты) ---

  it('loadMoreWithStallDetection не запускает параллельный loadMore если isLoadingMore=true (race condition guard)', async () => {
    act(() => {
      useFeedStore.getState().setPosts([makePost('1')], 'cursor', true)
      useFeedStore.getState().setLoading(false)
      // Симулируем состояние: loadMore уже выполняется
      useFeedStore.getState().setLoadingMore(true)
    })

    let resolveLoadMore!: (v: { posts: Post[]; nextCursor: string | null; hasMore: boolean }) => void
    mockFetchPosts.mockImplementation(() => new Promise((r) => { resolveLoadMore = r }))

    render(<FeedContainer />)

    // При isLoadingMore=true IO useEffect не создаёт observer — latestObserverCallback=null
    // Имитируем завершение предыдущего loadMore → isLoadingMore=false → observer пересоздаётся
    await act(async () => {
      useFeedStore.getState().setLoadingMore(false)
    })

    // Observer создан и подписан
    expect(mockObserve).toHaveBeenCalled()

    // Триггерим loadMore
    await act(async () => {
      latestObserverCallback?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver
      )
    })

    // isLoadingMore=true теперь из нашего вызова
    expect(useFeedStore.getState().isLoadingMore).toBe(true)

    // Второй trigger — loadMoreWithStallDetection должен вернуть early (guard)
    await act(async () => {
      latestObserverCallback?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver
      )
    })

    // fetchPosts вызван ровно 1 раз, несмотря на 2 callback вызова
    expect(mockFetchPosts).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveLoadMore({ posts: [makePost('2')], nextCursor: null, hasMore: false })
    })
  })

  it('сообщение "Вы просмотрели все публикации" имеет role="status" для AT (a11y)', async () => {
    const posts = [makePost('1')]
    mockFetchPosts.mockResolvedValue({ posts, nextCursor: null, hasMore: false })

    render(<FeedContainer />)

    await waitFor(() => {
      const el = screen.getByText('Вы просмотрели все публикации')
      expect(el).toHaveAttribute('role', 'status')
      expect(el).toHaveAttribute('aria-live', 'polite')
    })
  })

  it('автоматически запускает loadMore через setTimeout когда displayedPosts.length === 0 (fix нулевой рост sentinel)', async () => {
    // Setup: insight посты загружены, переключились на reels → displayedPosts=[]
    // IO sentinel в DOM но не срабатывает (sentinel не уходил из viewport)
    const posts = [makePost('1', 'insight')]
    act(() => {
      useFeedStore.getState().setPosts(posts, 'cursor', true)
      useFeedStore.getState().setLoading(false)
      useFeedStore.getState().setActiveCategory('reels')
    })

    mockFetchPosts.mockResolvedValue({
      posts: [makePost('2', 'reels')],
      nextCursor: null,
      hasMore: false,
    })

    render(<FeedContainer />)

    // auto-trigger useEffect должен вызвать loadMore через setTimeout(0)
    // даже без явного срабатывания IO observer
    await waitFor(() => {
      expect(mockFetchPosts).toHaveBeenCalled()
    })
  })

  // --- Iteration 13: Item 3 (Author badge pop-in fix — initialUserId) ---

  it('initialUserId используется для isAuthor до инициализации auth store (предотвращение badge pop-in)', () => {
    // Auth store не готов (isAuthReady=false) — имитация SSR-to-CSR перехода до гидрации
    act(() => {
      useAuthStore.getState().clearAuth()
      // setReady(false) — auth ещё не инициализирован
    })

    const post = makePost('1') // author_id = 'user-1'
    act(() => {
      useFeedStore.getState().setPosts([post], null, false)
      useFeedStore.getState().setLoading(false)
    })

    // Передаём initialUserId с сервера — пользователь 'user-1' (автор поста)
    render(<FeedContainer initialUserId="user-1" />)

    // isAuthor=true, несмотря на isAuthReady=false — badge не мигает при гидрации
    expect(screen.getByTestId('post-1')).toHaveAttribute('data-is-author', 'true')
  })
})
