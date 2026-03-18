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
      <button onClick={() => onCategoryChange('reels')}>Reels</button>
      <button onClick={() => onCategoryChange('all')}>Все</button>
    </div>
  ),
}))

vi.mock('@/features/feed/components/FeedContainer', () => ({
  FeedContainer: () => <div data-testid="feed-container" />,
}))

import FeedPage from '@/app/(app)/feed/page'

describe('FeedPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useFeedStore.getState().reset()
  })

  it('рендерит CategoryScroll и FeedContainer', () => {
    render(<FeedPage />)

    expect(screen.getByTestId('category-scroll')).toBeInTheDocument()
    expect(screen.getByTestId('feed-container')).toBeInTheDocument()
  })

  it('передаёт activeCategory из store в CategoryScroll', () => {
    useFeedStore.getState().setActiveCategory('reels')

    render(<FeedPage />)

    expect(screen.getByTestId('category-scroll')).toHaveAttribute(
      'data-active',
      'reels'
    )
  })

  it('вызывает changeCategory при смене категории', async () => {
    const user = userEvent.setup()
    render(<FeedPage />)

    await user.click(screen.getByText('Reels'))

    expect(useFeedStore.getState().activeCategory).toBe('reels')
  })

  it('changeCategory сбрасывает посты при смене категории', async () => {
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
          category: 'insight',
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

    render(<FeedPage />)
    await user.click(screen.getByText('Reels'))

    // changeCategory сбрасывает посты
    expect(useFeedStore.getState().posts).toEqual([])
    expect(useFeedStore.getState().activeCategory).toBe('reels')
  })
})
