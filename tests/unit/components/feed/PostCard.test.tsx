import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
  it('likeCount обновляется при изменении prop post.likes (derived state sync)', () => {
    const { rerender } = render(<PostCard post={makeCardData({ likes: 5 })} />)
    expect(screen.getByText('5')).toBeInTheDocument()

    rerender(<PostCard post={makeCardData({ likes: 10 })} />)

    expect(screen.getByText('10')).toBeInTheDocument()
    expect(screen.queryByText('5')).not.toBeInTheDocument()
  })

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

  it('вызывает onLikeToggle с postId и liked=true при первом клике', async () => {
    const onLikeToggle = vi.fn()
    const user = userEvent.setup()
    render(<PostCard post={makeCardData({ id: 'p1', likes: 3 })} onLikeToggle={onLikeToggle} />)

    await user.click(screen.getByRole('button', { name: 'Поставить лайк' }))

    expect(onLikeToggle).toHaveBeenCalledOnce()
    expect(onLikeToggle).toHaveBeenCalledWith('p1', true)
  })

  it('вызывает onLikeToggle с liked=false при повторном клике (unlike)', async () => {
    const onLikeToggle = vi.fn()
    const user = userEvent.setup()
    render(<PostCard post={makeCardData({ id: 'p1' })} onLikeToggle={onLikeToggle} />)

    await user.click(screen.getByRole('button', { name: 'Поставить лайк' }))
    await user.click(screen.getByRole('button', { name: 'Убрать лайк' }))

    expect(onLikeToggle).toHaveBeenCalledTimes(2)
    expect(onLikeToggle).toHaveBeenNthCalledWith(1, 'p1', true)
    expect(onLikeToggle).toHaveBeenNthCalledWith(2, 'p1', false)
  })

  it('не падает если onLikeToggle не передан (опциональный проп)', async () => {
    const user = userEvent.setup()
    render(<PostCard post={makeCardData()} />)

    // Клик без onLikeToggle — не должно быть ошибок
    await expect(
      user.click(screen.getByRole('button', { name: 'Поставить лайк' }))
    ).resolves.not.toThrow()
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
