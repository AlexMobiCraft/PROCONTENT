import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { PreviewPostsSection } from '@/features/landing/components/PreviewPostsSection'
import type { LandingPreviewPost } from '@/features/landing/api/publicPreview'

const makePosts = (count: number): LandingPreviewPost[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `post-${i + 1}`,
    title: `Test Post ${i + 1}`,
    excerpt: `Excerpt for post ${i + 1}`,
    category: `#cat${i + 1}`,
    created_at: '2026-01-15T12:00:00Z',
    likes_count: i * 10,
    comments_count: i * 2,
  }))

describe('PreviewPostsSection', () => {
  it('рендерит секцию с заголовком при 3 постах', () => {
    render(<PreviewPostsSection posts={makePosts(3)} />)
    expect(screen.getByText('Poglej noter')).toBeInTheDocument()
    expect(screen.getByText('Predogled vsebine')).toBeInTheDocument()
  })

  it('рендерит 3 карточки когда передано 3 поста', () => {
    const posts = makePosts(3)
    render(<PreviewPostsSection posts={posts} />)
    for (const post of posts) {
      expect(screen.getByText(post.title)).toBeInTheDocument()
    }
  })

  it('рендерит 1 карточку (partial state)', () => {
    const posts = makePosts(1)
    render(<PreviewPostsSection posts={posts} />)
    expect(screen.getByText('Test Post 1')).toBeInTheDocument()
  })

  it('не показывает карточки при 0 постах (empty state)', () => {
    render(<PreviewPostsSection posts={[]} />)
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
    // Секция с заголовком должна оставаться
    expect(screen.getByText('Poglej noter')).toBeInTheDocument()
  })

  it('использует реальный created_at для форматирования даты', () => {
    const posts = makePosts(1)
    render(<PreviewPostsSection posts={posts} />)
    // Дата должна быть в словенском формате
    expect(screen.getByText(/jan\./i)).toBeInTheDocument()
  })

  it('карточки рендерятся как article элементы', () => {
    render(<PreviewPostsSection posts={makePosts(2)} />)
    expect(screen.getAllByRole('article')).toHaveLength(2)
  })
})
