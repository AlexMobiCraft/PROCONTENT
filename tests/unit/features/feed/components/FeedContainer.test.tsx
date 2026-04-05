import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { useAuthStore } from '@/features/auth/store'
import { useFeedStore } from '@/features/feed/store'
import type { Post } from '@/features/feed/types'

const mockFetchPosts = vi.fn()
const mockRpc = vi.fn()
const mockRouterPush = vi.fn()

vi.mock('@/features/feed/api/posts', () => ({
  fetchPosts: (...args: unknown[]) => mockFetchPosts(...args),
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    rpc: (...args: unknown[]) => mockRpc(...args),
  }),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockRouterPush,
  }),
}))

vi.mock('@/components/feed/PostCard', () => ({
  PostCard: ({
    post,
    priority,
    isPending,
    onLikeToggle,
  }: {
    post: { id: string; title: string; likes: number; isLiked?: boolean; author?: { isAuthor?: boolean } }
    priority?: boolean
    isPending?: boolean
    onLikeToggle?: (postId: string) => void
  }) => (
    <div
      data-testid={`post-${post.id}`}
      data-is-author={String(post.author?.isAuthor ?? false)}
      data-priority={String(priority ?? false)}
      data-is-pending={String(isPending ?? false)}
      data-likes={post.likes}
      data-is-liked={String(post.isLiked ?? false)}
    >
      {post.title}
      <button
        data-testid={`like-btn-${post.id}`}
        onClick={() => {
          void onLikeToggle?.(post.id)
        }}
      >
        Like
      </button>
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
    title: `Objava ${id}`,
    excerpt: 'Opis',
    content: null,
    category,
    type: 'text',
    image_url: null,
    likes_count: 0,
    comments_count: 0,
    is_published: true,
    status: 'published',
    scheduled_at: null,
    published_at: '2026-03-15T10:00:00Z',
    is_landing_preview: false,
    is_onboarding: false,
    is_liked: false,
    created_at: '2026-03-15T10:00:00Z',
    updated_at: '2026-03-15T10:00:00Z',
    profiles: { display_name: 'Avtorica', avatar_url: null },
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

afterEach(() => {
  vi.useRealTimers()
})

describe('FeedContainer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useFeedStore.getState().reset()
    useAuthStore.getState().clearAuth()
    useAuthStore.getState().setReady(true) // Hydration завершена в тестах
    latestObserverCallback = null
    mockRouterPush.mockReset()
  })

  it('показывает скелетоны при isLoading (AC #3)', async () => {
    // isLoading = true по умолчанию в initialState
    mockFetchPosts.mockResolvedValue({ posts: [], nextCursor: 'cursor-2', hasMore: true })

    render(<FeedContainer />)

    const skeletons = screen.getAllByTestId('skeleton')
    expect(skeletons).toHaveLength(5)
    expect(screen.getByRole('status')).toHaveAttribute(
      'aria-label',
      'Nalaganje vsebine'
    )

    // Дожидаемся завершения загрузки чтобы не было act warning
    await waitFor(() => {
      expect(useFeedStore.getState().isLoading).toBe(false)
    })
  })

  it('скелетоны при начальной загрузке чередуют showMedia для предотвращения CLS', async () => {
    mockFetchPosts.mockResolvedValue({ posts: [], nextCursor: 'cursor-2', hasMore: true })

    render(<FeedContainer />)

    const skeletons = screen.getAllByTestId('skeleton')
    expect(skeletons).toHaveLength(5)

    const withMedia = skeletons.filter((s) => s.getAttribute('data-show-media') === 'true')
    const withoutMedia = skeletons.filter((s) => s.getAttribute('data-show-media') === 'false')
    // alternate: i%2===0 → индексы 0,2,4 = true; 1,3 = false
    expect(withMedia).toHaveLength(3)
    expect(withoutMedia).toHaveLength(2)

    // Дожидаемся завершения загрузки чтобы не было act warning
    await waitFor(() => {
      expect(useFeedStore.getState().isLoading).toBe(false)
    })
  })

  it('показывает empty state когда постов нет (AC #5)', async () => {
    mockFetchPosts.mockResolvedValue({ posts: [], nextCursor: 'cursor-2', hasMore: true })

    render(<FeedContainer />)

    await waitFor(() => {
      expect(
        screen.getByText('Kmalu bo tu vsebina')
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
        screen.getByText('Pregledali ste vse objave')
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

  it('??????????? ????? ????????? ????????? ? ???????', async () => {
    mockFetchPosts.mockResolvedValue({
      posts: [makePost('2', 'reels')],
      nextCursor: null,
      hasMore: false,
    })

    act(() => {
      useFeedStore.getState().setActiveCategory('reels')
    })

    render(<FeedContainer />)

    await waitFor(() => {
      expect(mockFetchPosts).toHaveBeenCalledWith(
        undefined,
        expect.objectContaining({ category: 'reels', signal: expect.any(AbortSignal) })
      )
      expect(screen.getByTestId('post-2')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('post-1')).not.toBeInTheDocument()
  })

  it('?? ?????????? sentinel ??? ?????? category ????? server ?????? hasMore=false', async () => {
    mockFetchPosts.mockResolvedValue({
      posts: [],
      nextCursor: null,
      hasMore: false,
    })

    act(() => {
      useFeedStore.getState().setActiveCategory('reels')
    })

    render(<FeedContainer />)

    await waitFor(() => {
      expect(screen.getByText('Kmalu bo tu vsebina')).toBeInTheDocument()
      expect(screen.queryByTestId('feed-sentinel')).not.toBeInTheDocument()
    })
  })

  it('?????????? sentinel ? empty state ??? category ???? server ???????? hasMore=true', async () => {
    mockFetchPosts.mockResolvedValue({
      posts: [],
      nextCursor: 'cursor-2',
      hasMore: true,
    })

    act(() => {
      useFeedStore.getState().setActiveCategory('reels')
    })

    render(<FeedContainer />)

    await waitFor(() => {
      expect(screen.getByText('Kmalu bo tu vsebina')).toBeInTheDocument()
      expect(screen.getByTestId('feed-sentinel')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /I.*naprej/i })).not.toBeInTheDocument()
    })
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
      expect(screen.getByText('Nalaganje vsebine ni uspelo')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Ponovi' }))

    await waitFor(() => {
      expect(screen.getByTestId('post-1')).toBeInTheDocument()
    })
    await waitFor(() => {
      expect(mockFetchPosts).toHaveBeenCalledTimes(2)
    })
    // Macrotask-checkpoint: дренирует microtask queue (Zustand→React subscription chain)
    await act(async () => { await new Promise<void>(r => setTimeout(r, 0)) })
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

    await user.click(screen.getByRole('button', { name: 'Ponovi' }))

    await waitFor(() => {
      expect(screen.getByTestId('post-2')).toBeInTheDocument()
    })
    // Macrotask-checkpoint: дренирует microtask queue (Zustand→React subscription chain)
    await act(async () => { await new Promise<void>(r => setTimeout(r, 0)) })
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
    // loadMore ?????? ?????? ???????? ??? ????? ??????? razobory-?????? ? stall
    mockFetchPosts
      .mockResolvedValueOnce({
        posts: [razboroyPost],
        nextCursor: '2026-03-14T10:00:00Z|aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        hasMore: true,
      })
      .mockResolvedValueOnce({
        posts: [],
        nextCursor: '2026-03-13T10:00:00Z|ffffffff-bbbb-cccc-dddd-eeeeeeeeeeee',
        hasMore: true,
      })

    render(<FeedContainer />)

    await waitFor(() => {
      expect(screen.getByTestId('post-1')).toBeInTheDocument()
      expect(screen.getByTestId('feed-sentinel')).toBeInTheDocument()
    })


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
    expect(screen.queryByRole('button', { name: 'Ponovi' })).not.toBeInTheDocument()

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

  it('скелетоны гидрации (isAuthReady=false, posts=[]) чередуют showMedia для предотвращения CLS', async () => {
    // Отменяем готовность auth — FeedContainer покажет hydration-скелетоны
    act(() => {
      useAuthStore.getState().setReady(false)
      // posts.length === 0 из reset() в beforeEach
    })
    mockFetchPosts.mockResolvedValue({ posts: [], nextCursor: 'cursor-2', hasMore: true })

    render(<FeedContainer />)

    // Гидрационные скелетоны (aria-label "Загрузка приложения")
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Nalaganje aplikacije')
    const skeletons = screen.getAllByTestId('skeleton')
    expect(skeletons).toHaveLength(5)

    // alternate: i%2===0 → индексы 0,2,4 = true; 1,3 = false (3 с медиа, 2 без)
    const withMedia = skeletons.filter((s) => s.getAttribute('data-show-media') === 'true')
    const withoutMedia = skeletons.filter((s) => s.getAttribute('data-show-media') === 'false')
    expect(withMedia).toHaveLength(3)
    expect(withoutMedia).toHaveLength(2)

    // Дожидаемся завершения loadInitial (запускается в useEffect даже при гидрационных скелетонах)
    await waitFor(() => {
      expect(useFeedStore.getState().isLoading).toBe(false)
    })
  })

  it('???????? sentinel ? empty state ????? ??? ?????? ??? ????????? ? hasMore=true (fix ???????????? scroll)', async () => {
    // ???? ????? ?????? ?????????, hasMore=true ? sentinel ?????? ???? ? empty state
    const posts = [makePost('1', 'insight')]
    mockFetchPosts.mockResolvedValue({ posts: [], nextCursor: 'cursor-2', hasMore: true })
    act(() => {
      useFeedStore.getState().setPosts(posts, 'cursor', true) // hasMore=true
      useFeedStore.getState().setLoading(false)
      useFeedStore.getState().setActiveCategory('reels') // ??? 'reels' ?????? ? empty state
    })

    render(<FeedContainer />)

    await waitFor(() => {
      expect(screen.getByText('Kmalu bo tu vsebina')).toBeInTheDocument()
      expect(screen.getByTestId('feed-sentinel')).toBeInTheDocument()
    })
    expect(mockObserve).toHaveBeenCalled()

    await waitFor(() => {
      expect(useFeedStore.getState().isLoadingMore).toBe(false)
    })
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
    expect(screen.queryByRole('status', { name: 'Nalaganje aplikacije' })).not.toBeInTheDocument()
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
        screen.getByText('V tej kategoriji ni več objav')
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

  it('обновляет store из свежей initialData даже если store уже содержит посты (stale SSR data fix)', async () => {
    // Имитируем возврат на страницу: store содержит старые кэшированные посты,
    // а initialData несёт свежие данные с сервера (новый SSR-рендер при навигации).
    const cachedPosts = [makePost('1'), makePost('2'), makePost('3')]
    act(() => {
      useFeedStore.getState().setPosts(cachedPosts, null, false)
      useFeedStore.getState().setLoading(false)
    })

    // initialData содержит свежие посты — должен заменить stale кэш
    render(<FeedContainer initialData={{ posts: [makePost('x')], nextCursor: null, hasMore: false }} />)

    await waitFor(() => {
      // Свежие данные из initialData применились
      expect(screen.getByTestId('post-x')).toBeInTheDocument()
      expect(screen.queryByTestId('post-1')).not.toBeInTheDocument()
    })
    // Store обновился: 1 пост из initialData
    expect(useFeedStore.getState().posts).toHaveLength(1)
  })

  it('использует initialData для первого render пока store пуст (нет flash скелетонов)', () => {
    const posts = [makePost('1'), makePost('2')]
    // Store пуст (isLoading=true), но initialData есть — показываем посты без скелетонов
    render(<FeedContainer initialData={{ posts, nextCursor: null, hasMore: false }} />)

    // Посты видны сразу при первом render — нет flash скелетонов
    expect(screen.getByTestId('post-1')).toBeInTheDocument()
    expect(screen.getByTestId('post-2')).toBeInTheDocument()
    expect(screen.queryByRole('status', { name: 'Nalaganje feedа' })).not.toBeInTheDocument()
  })

  // --- Iteration 10: Item 4 (auto-trigger loadMore при нулевом росте sentinel) ---

  // --- Iteration 11: Items 1+3 (UX Dead End + A11y) ---

  it('экран ошибки начальной загрузки (posts.length===0) имеет role="alert"', async () => {
    mockFetchPosts.mockRejectedValueOnce(new Error('network'))

    render(<FeedContainer />)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.getByText('Nalaganje vsebine ni uspelo')).toBeInTheDocument()
    })
    // Macrotask-checkpoint: дренирует microtask queue (Zustand→React subscription chain)
    await act(async () => { await new Promise<void>(r => setTimeout(r, 0)) })
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
      expect(screen.getByRole('button', { name: /I.*naprej/i })).toBeInTheDocument()
    })

    // Клик "Искать дальше" → сбрасывает stallCount → sentinel снова видим
    await user.click(screen.getByRole('button', { name: /I.*naprej/i }))

    await waitFor(() => {
      expect(screen.getByTestId('feed-sentinel')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /I.*naprej/i })).not.toBeInTheDocument()
    })
  })

  it('?????? "?????? ??????" ?????????? ? empty state ????? MAX_STALL_RETRIES ? ?????????? ?????', async () => {
    const user = userEvent.setup()
    const insightPost = makePost('1', 'insight')
    mockFetchPosts.mockResolvedValue({
      posts: [],
      nextCursor: '2026-03-14T10:00:00Z|aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      hasMore: true,
    })

    act(() => {
      useFeedStore
        .getState()
        .setPosts([insightPost], '2026-03-15T10:00:00Z|123e4567-e89b-42d3-a456-426614174000', true)
      useFeedStore.getState().setLoading(false)
      useFeedStore.getState().setActiveCategory('reels')
    })

    render(<FeedContainer />)

    await waitFor(() => {
      expect(screen.getByText('Kmalu bo tu vsebina')).toBeInTheDocument()
      expect(screen.getByTestId('feed-sentinel')).toBeInTheDocument()
    })

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

    await waitFor(() => {
      expect(screen.queryByTestId('feed-sentinel')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: /I.*naprej/i })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: /I.*naprej/i }))

    await waitFor(() => {
      expect(screen.getByTestId('feed-sentinel')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /I.*naprej/i })).not.toBeInTheDocument()
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
      const el = screen.getByText('Pregledali ste vse objave')
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

  // --- Iteration 16: Item 2 (API Spam debounce 500ms) ---

  it('auto-trigger ??? displayedPosts.length=0 ?????????? ???????? 500ms (debounce)', async () => {
    const posts = [makePost('1', 'insight')]
    act(() => {
      useFeedStore.getState().setPosts(posts, 'cursor', true)
      useFeedStore.getState().setLoading(false)
      useFeedStore.getState().setActiveCategory('reels')
    })

    mockFetchPosts.mockResolvedValue({ posts: [], nextCursor: 'cursor-2', hasMore: true })

    render(<FeedContainer />)

    await waitFor(() => {
      expect(mockFetchPosts).toHaveBeenCalledTimes(1)
    })

    await new Promise((resolve) => setTimeout(resolve, 450))
    expect(mockFetchPosts).toHaveBeenCalledTimes(1)

    await waitFor(() => {
      expect(mockFetchPosts).toHaveBeenCalledTimes(2)
    })
    await waitFor(() => {
      expect(useFeedStore.getState().isLoadingMore).toBe(false)
    })
  }, 10000)


  // --- Iteration 15: Item 3 (Слепая зона в тестах гидрации) ---

  it('обновляет store пустым массивом posts:[] из свежей initialData (пустой SSR ответ)', async () => {
    // Store содержит старые закэшированные посты
    const cachedPosts = [makePost('1'), makePost('2')]
    act(() => {
      useFeedStore.getState().setPosts(cachedPosts, 'cursor', true)
      useFeedStore.getState().setLoading(false)
    })

    // loadInitial может быть вызван после hydration (store очищается) — моком возвращаем пустоту
    mockFetchPosts.mockResolvedValue({ posts: [], nextCursor: null, hasMore: false })

    // initialData несёт пустой ответ сервера — store должен очиститься
    render(<FeedContainer initialData={{ posts: [], nextCursor: null, hasMore: false }} />)

    // После useEffect: stale посты заменены пустым массивом из initialData
    await waitFor(() => {
      expect(screen.queryByTestId('post-1')).not.toBeInTheDocument()
      expect(screen.queryByTestId('post-2')).not.toBeInTheDocument()
    })
    expect(useFeedStore.getState().posts).toHaveLength(0)
    expect(useFeedStore.getState().hasMore).toBe(false)
  })

  // --- Iteration 17: Item 2 (Flash при SPA-навигации: isHydrated sync с initialData) ---

  it('не показывает stale посты при смене initialData при SPA-навигации (flash fix)', async () => {
    // Первый рендер с initialData1 — post 'x'
    const { rerender } = render(
      <FeedContainer initialData={{ posts: [makePost('x')], nextCursor: null, hasMore: false }} />
    )

    // Ждём первой гидрации — isHydrated=true, store содержит post 'x'
    await waitFor(() => {
      expect(screen.getByTestId('post-x')).toBeInTheDocument()
    })

    // Имитируем stale cache в store (например, посты предыдущего сеанса)
    act(() => {
      useFeedStore.getState().setPosts([makePost('stale-1'), makePost('stale-2')], null, false)
      useFeedStore.getState().setLoading(false)
    })

    // SPA-навигация: сервер прислал новую initialData2 — post 'y'
    rerender(
      <FeedContainer initialData={{ posts: [makePost('y')], nextCursor: null, hasMore: false }} />
    )

    // Должен показать новые данные initialData2, а не stale store
    await waitFor(() => {
      expect(screen.getByTestId('post-y')).toBeInTheDocument()
      expect(screen.queryByTestId('post-stale-1')).not.toBeInTheDocument()
      expect(screen.queryByTestId('post-stale-2')).not.toBeInTheDocument()
    })
  })

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

  // --- Post Likes Feature: Оптимистичные лайки, RPC sync, rollback, spam block, auth guard ---

  it('успешный лайк: оптимистичное обновление и синхронизация с JSON ответом RPC (AC #1)', async () => {
    const user = userEvent.setup()
    const post = { ...makePost('1'), likes_count: 5, is_liked: false }
    act(() => {
      useAuthStore.getState().setUser({ id: 'user-1' } as never)
      useFeedStore.getState().setPosts([post], null, false)
      useFeedStore.getState().setLoading(false)
    })

    // RPC висит — deferred для проверки оптимистичного стейта
    let resolveRpc!: (v: { data: unknown; error: null }) => void
    mockRpc.mockImplementation(() => new Promise((r) => { resolveRpc = r }))

    render(<FeedContainer />)

    // Клик по кнопке лайка
    await user.click(screen.getByTestId('like-btn-1'))

    // Оптимистично (RPC ещё pending): likes_count=6, is_liked=true, postId в pendingLikes
    expect(useFeedStore.getState().posts[0].likes_count).toBe(6)
    expect(useFeedStore.getState().posts[0].is_liked).toBe(true)
    expect(useFeedStore.getState().pendingLikes).toContain('1')

    // Резолвим RPC: сервер говорит likes_count=7 (другой клиент тоже лайкнул)
    await act(async () => {
      resolveRpc({ data: { is_liked: true, likes_count: 7 }, error: null })
    })

    // После RPC: синхронизируется с ответом сервера (likes_count=7, не 6!)
    await waitFor(() => {
      expect(useFeedStore.getState().posts[0].likes_count).toBe(7)
      expect(useFeedStore.getState().posts[0].is_liked).toBe(true)
      expect(useFeedStore.getState().pendingLikes).not.toContain('1')
    })
  })

  it('точечный откат при ошибке сети (RPC error) не повреждает данные других постов (AC #2)', async () => {
    const user = userEvent.setup()
    const post1 = { ...makePost('1'), likes_count: 5, is_liked: false }
    const post2 = { ...makePost('2'), likes_count: 10, is_liked: true }
    act(() => {
      useAuthStore.getState().setUser({ id: 'user-1' } as never)
      useFeedStore.getState().setPosts([post1, post2], null, false)
      useFeedStore.getState().setLoading(false)
    })

    // RPC упадёт с ошибкой
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'Network error' },
    })

    render(<FeedContainer />)

    await user.click(screen.getByTestId('like-btn-1'))

    // После rollback: пост 1 вернулся к старому состоянию, пост 2 не тронут
    await waitFor(() => {
      expect(useFeedStore.getState().pendingLikes).not.toContain('1')
    })
    const posts = useFeedStore.getState().posts
    expect(posts[0].likes_count).toBe(5)
    expect(posts[0].is_liked).toBe(false)
    // Пост 2 не повреждён:
    expect(posts[1].likes_count).toBe(10)
    expect(posts[1].is_liked).toBe(true)
  })

  it('блокирует повторные клики через pendingLikes — серверу летит строго 1 запрос (AC #3)', async () => {
    const user = userEvent.setup()
    const post = { ...makePost('1'), likes_count: 5, is_liked: false }
    act(() => {
      useAuthStore.getState().setUser({ id: 'user-1' } as never)
      useFeedStore.getState().setPosts([post], null, false)
      useFeedStore.getState().setLoading(false)
    })

    // RPC висит (pending promise), чтобы pendingLikes не очистился
    let resolveRpc!: (v: { data: unknown; error: null }) => void
    mockRpc.mockImplementation(() => new Promise((r) => { resolveRpc = r }))

    render(<FeedContainer />)

    // 5 быстрых кликов
    const likeBtn = screen.getByTestId('like-btn-1')
    await user.click(likeBtn)
    await user.click(likeBtn)
    await user.click(likeBtn)
    await user.click(likeBtn)
    await user.click(likeBtn)

    // RPC вызван строго 1 раз, остальные клики заблокированы pendingLikes
    expect(mockRpc).toHaveBeenCalledTimes(1)
    expect(mockRpc).toHaveBeenCalledWith('toggle_like', { p_post_id: '1' })

    // Завершаем RPC для cleanup
    await act(async () => {
      resolveRpc({ data: { is_liked: true, likes_count: 6 }, error: null })
    })

    await waitFor(() => {
      expect(useFeedStore.getState().pendingLikes).not.toContain('1')
    })
  })

  it('неавторизованный юзер перенаправляется на /login вместо отправки RPC (AC #5)', async () => {
    const user = userEvent.setup()
    const post = makePost('1')
    act(() => {
      // Гость: user = null
      useFeedStore.getState().setPosts([post], null, false)
      useFeedStore.getState().setLoading(false)
    })

    render(<FeedContainer />)

    await user.click(screen.getByTestId('like-btn-1'))

    // RPC не вызван
    expect(mockRpc).not.toHaveBeenCalled()
    // Перенаправление на /login
    expect(mockRouterPush).toHaveBeenCalledWith('/login')
    // Стейт не изменился
    expect(useFeedStore.getState().posts[0].likes_count).toBe(0)
    expect(useFeedStore.getState().posts[0].is_liked).toBe(false)
  })
})
