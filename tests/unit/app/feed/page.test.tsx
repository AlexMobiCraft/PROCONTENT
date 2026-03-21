import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { useFeedStore } from '@/features/feed/store'

vi.mock('@/components/feed/CategoryScroll', () => ({
  CategoryScroll: ({
    activeCategory,
    onCategoryChange,
  }: {
    activeCategory: string
    onCategoryChange: (id: string) => void
  }) => (
    <div data-testid="category-scroll" data-active={activeCategory}>
      <button onClick={() => onCategoryChange('objavljanje')}>Objavljanje in reels</button>
      <button onClick={() => onCategoryChange('all')}>VSE</button>
    </div>
  ),
}))

vi.mock('@/features/feed/components/FeedContainer', () => ({
  FeedContainer: () => <div data-testid="feed-container" />,
}))

// Тестируем FeedPageClient — клиентский wrapper с логикой категорий.
// FeedPage теперь Server Component (async), все интерактивные тесты — здесь.
import { FeedPageClient } from '@/features/feed/components/FeedPageClient'

const emptyInitialData = { posts: [], nextCursor: null, hasMore: true }

describe('FeedPage (FeedPageClient)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useFeedStore.getState().reset()
  })

  it('рендерит CategoryScroll и FeedContainer', () => {
    render(<FeedPageClient initialData={emptyInitialData} />)

    expect(screen.getByTestId('category-scroll')).toBeInTheDocument()
    expect(screen.getByTestId('feed-container')).toBeInTheDocument()
  })

  it('передаёт activeCategory из store в CategoryScroll', () => {
    useFeedStore.getState().setActiveCategory('objavljanje')

    render(<FeedPageClient initialData={emptyInitialData} />)

    expect(screen.getByTestId('category-scroll')).toHaveAttribute(
      'data-active',
      'objavljanje'
    )
  })

  it('вызывает changeCategory при смене категории', async () => {
    const user = userEvent.setup()
    render(<FeedPageClient initialData={emptyInitialData} />)

    await user.click(screen.getByText('Objavljanje in reels'))

    expect(useFeedStore.getState().activeCategory).toBe('objavljanje')
  })

  it('changeCategory НЕ сбрасывает посты — клиентская фильтрация из кэша', async () => {
    const user = userEvent.setup()
    // Предзагружаем store
    useFeedStore.getState().setPosts(
      [
        {
          id: '1',
          author_id: 'u1',
          title: 'Test',
          excerpt: null,
          content: null,
          category: 'stories',
          type: 'text',
          image_url: null,
          likes_count: 0,
          comments_count: 0,
          is_published: true,
          is_landing_preview: false,
          is_onboarding: false,
          created_at: '2026-03-15T10:00:00Z',
          updated_at: '2026-03-15T10:00:00Z',
          profiles: { display_name: 'A', avatar_url: null },
        },
      ],
      'cursor',
      true
    )

    render(<FeedPageClient initialData={emptyInitialData} />)
    await user.click(screen.getByText('Objavljanje in reels'))

    // changeCategory только меняет активную категорию, не сбрасывает кэш постов
    expect(useFeedStore.getState().activeCategory).toBe('objavljanje')
    expect(useFeedStore.getState().posts).toHaveLength(1)
  })
})
