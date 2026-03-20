import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/components/media/LazyMediaWrapper', () => ({
  LazyMediaWrapper: ({ priority }: { priority?: boolean }) => (
    <div data-testid="lazy-media" data-priority={String(priority ?? false)} />
  ),
}))

import { PostCard, PostCardSkeleton } from '@/components/feed/PostCard'
import type { PostCardData } from '@/components/feed/PostCard'

function makeCardData(overrides?: Partial<PostCardData>): PostCardData {
  return {
    id: '1',
    category: 'insight',
    title: 'Test post',
    excerpt: 'Description',
    date: '01.01.2026',
    likes: 0,
    comments: 0,
    author: { name: 'Автор', initials: 'А' },
    imageUrl: 'https://example.com/img.jpg',
    type: 'photo',
    ...overrides,
  }
}

describe('PostCard', () => {
  it('передаёт priority=true в LazyMediaWrapper если задан (LCP)', () => {
    render(<PostCard post={makeCardData()} priority />)
    expect(screen.getByTestId('lazy-media')).toHaveAttribute('data-priority', 'true')
  })

  it('передаёт priority=false в LazyMediaWrapper по умолчанию', () => {
    render(<PostCard post={makeCardData()} />)
    expect(screen.getByTestId('lazy-media')).toHaveAttribute('data-priority', 'false')
  })

  it('не рендерит LazyMediaWrapper если imageUrl отсутствует', () => {
    render(<PostCard post={makeCardData({ imageUrl: undefined })} />)
    expect(screen.queryByTestId('lazy-media')).not.toBeInTheDocument()
  })

  it('кнопка лайка имеет aria-label без дублирования счётчика (a11y)', () => {
    render(<PostCard post={makeCardData({ likes: 7 })} />)
    // aria-label содержит только действие — счётчик рендерится в <span> и не дублируется AT
    expect(screen.getByRole('button', { name: 'Поставить лайк' })).toBeInTheDocument()
  })
})

describe('PostCardSkeleton', () => {
  it('по умолчанию не рендерит media placeholder для text-карточек', () => {
    render(<PostCardSkeleton />)

    expect(screen.queryByTestId('post-card-skeleton-media')).not.toBeInTheDocument()
  })

  it('рендерит media placeholder только при явном showMedia=true', () => {
    render(<PostCardSkeleton showMedia />)

    expect(screen.getByTestId('post-card-skeleton-media')).toBeInTheDocument()
  })

  it('media placeholder использует aspect-[4/5] для фото по умолчанию (CLS fix)', () => {
    render(<PostCardSkeleton showMedia />)
    const media = screen.getByTestId('post-card-skeleton-media')
    expect(media.className).toContain('aspect-[4/5]')
  })

  it('media placeholder использует aspect-video для типа video (CLS fix)', () => {
    render(<PostCardSkeleton showMedia mediaType="video" />)
    const media = screen.getByTestId('post-card-skeleton-media')
    expect(media.className).toContain('aspect-video')
  })
})
