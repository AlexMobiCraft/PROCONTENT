import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/components/media/LazyMediaWrapper', () => ({
  LazyMediaWrapper: () => <div data-testid="lazy-media" />,
}))

import { PostCardSkeleton } from '@/components/feed/PostCard'

describe('PostCardSkeleton', () => {
  it('по умолчанию не рендерит media placeholder для text-карточек', () => {
    render(<PostCardSkeleton />)

    expect(screen.queryByTestId('post-card-skeleton-media')).not.toBeInTheDocument()
  })

  it('рендерит media placeholder только при явном showMedia=true', () => {
    render(<PostCardSkeleton showMedia />)

    expect(screen.getByTestId('post-card-skeleton-media')).toBeInTheDocument()
  })
})
