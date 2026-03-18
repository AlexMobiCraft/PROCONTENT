import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { useFeedStore } from '@/features/feed/store'
import type { Post } from '@/features/feed/types'

const mockFetchPosts = vi.fn()

vi.mock('@/features/feed/api/posts', () => ({
  fetchPosts: (...args: unknown[]) => mockFetchPosts(...args),
}))

vi.mock('@/components/feed/PostCard', () => ({
  PostCard: ({ post }: { post: { id: string; title: string } }) => (
    <div data-testid={`post-${post.id}`}>{post.title}</div>
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

class MockIntersectionObserver {
  constructor(public callback: IntersectionObserverCallback) {}
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
    useFeedStore.getState().setPosts(posts, 'cursor', true)
    useFeedStore.getState().setLoading(false)
    useFeedStore.getState().setActiveCategory('reels') // нет постов в этой категории

    render(<FeedContainer />)

    // Должен показать empty state, observer не вызван
    expect(
      screen.getByText('Скоро здесь появится контент')
    ).toBeInTheDocument()
    expect(mockObserve).not.toHaveBeenCalled()
  })

  it('подключает IntersectionObserver когда есть посты и hasMore', async () => {
    const posts = [makePost('1')]
    useFeedStore.getState().setPosts(posts, 'cursor', true)
    useFeedStore.getState().setLoading(false)

    render(<FeedContainer />)

    expect(mockObserve).toHaveBeenCalled()
  })
})
