import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import React from 'react'

// Mock PostForm — we're only testing the page shell here
vi.mock('@/features/admin/components/PostForm', () => ({
  PostForm: ({
    mode,
    initialData,
  }: {
    mode: string
    initialData?: { id: string; title: string }
  }) => (
    <div
      data-testid="post-form"
      data-mode={mode}
      data-title={initialData?.title ?? ''}
    />
  ),
}))

const mockSingle = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: mockSingle,
        }),
      }),
    }),
  })),
}))

vi.mock('next/navigation', () => ({
  notFound: vi.fn(),
}))

const postData = {
  id: 'post-1',
  title: 'Test Post',
  content: 'Content',
  excerpt: 'Excerpt',
  category: 'insight',
  type: 'photo',
  post_media: [
    {
      id: 'm1',
      url: 'https://cdn.example.com/m1.jpg',
      thumbnail_url: null,
      media_type: 'image',
      order_index: 0,
      is_cover: true,
    },
  ],
}

// Expose EditPostContent so we can await its resolution
// EditPostPage is a shell; EditPostContent is an inner async component.
// We test by awaiting both the page and its async child.
import EditPostPage from '@/app/(admin)/posts/[id]/edit/page'

describe('EditPostPage', () => {
  it('renders page heading and static shell', async () => {
    mockSingle.mockResolvedValue({ data: postData, error: null })

    // EditPostPage is async — await it to get the JSX
    const pageJsx = await EditPostPage({ params: Promise.resolve({ id: 'post-1' }) })

    await act(async () => {
      render(pageJsx as React.ReactElement)
    })

    // The heading is in the static shell — should render regardless of inner async content
    expect(screen.getByRole('heading', { name: /uredi objavo/i })).toBeInTheDocument()
  })

  it('page renders without throwing', async () => {
    mockSingle.mockResolvedValue({ data: postData, error: null })

    const pageJsx = await EditPostPage({ params: Promise.resolve({ id: 'post-1' }) })

    await expect(
      act(async () => {
        render(pageJsx as React.ReactElement)
      })
    ).resolves.not.toThrow()
  })
})
