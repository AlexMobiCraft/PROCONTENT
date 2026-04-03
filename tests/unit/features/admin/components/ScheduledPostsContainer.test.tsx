import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ScheduledPost } from '@/features/admin/types'

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

const mockCancelScheduledPost = vi.fn()
vi.mock('@/features/admin/api/posts', () => ({
  cancelScheduledPost: (...args: unknown[]) => mockCancelScheduledPost(...args),
}))

const mockToastError = vi.fn()
vi.mock('sonner', () => ({
  toast: { error: (...args: unknown[]) => mockToastError(...args) },
}))

global.fetch = vi.fn()

import { ScheduledPostsContainer } from '@/features/admin/components/ScheduledPostsContainer'

const post1: ScheduledPost = {
  id: 'p1',
  title: 'Prva objava',
  category: 'insight',
  status: 'scheduled',
  scheduled_at: '2026-06-15T10:00:00Z',
  created_at: '2026-04-01T00:00:00Z',
}

const post2: ScheduledPost = {
  id: 'p2',
  title: 'Druga objava',
  category: 'story',
  status: 'scheduled',
  scheduled_at: '2026-07-01T08:00:00Z',
  created_at: '2026-04-02T00:00:00Z',
}

describe('ScheduledPostsContainer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('рендерит таблицу с начальными постами', () => {
    render(<ScheduledPostsContainer initialPosts={[post1, post2]} />)
    expect(screen.getByText('Prva objava')).toBeInTheDocument()
    expect(screen.getByText('Druga objava')).toBeInTheDocument()
  })

  it('показывает empty state при пустом начальном списке', () => {
    render(<ScheduledPostsContainer initialPosts={[]} />)
    expect(screen.getByText('Ni načrtovanih objav.')).toBeInTheDocument()
  })

  it('handleCancel: оптимистично удаляет строку и вызывает cancelScheduledPost', async () => {
    mockCancelScheduledPost.mockResolvedValueOnce(undefined)
    render(<ScheduledPostsContainer initialPosts={[post1, post2]} />)

    const cancelBtns = screen.getAllByRole('button', { name: /Prekliči objavo/i })
    await userEvent.click(cancelBtns[0])

    expect(screen.queryByText('Prva objava')).not.toBeInTheDocument()
    await waitFor(() => expect(mockCancelScheduledPost).toHaveBeenCalledWith('p1'))
  })

  it('handleCancel: rollback при ошибке — строка возвращается, toast.error вызван', async () => {
    mockCancelScheduledPost.mockRejectedValueOnce(new Error('Server error'))
    render(<ScheduledPostsContainer initialPosts={[post1]} />)

    await userEvent.click(screen.getByRole('button', { name: /Prekliči objavo/i }))

    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith('Server error'))
    expect(screen.getByText('Prva objava')).toBeInTheDocument()
  })

  it('handlePublishNow: оптимистично удаляет строку и вызывает fetch', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    })
    render(<ScheduledPostsContainer initialPosts={[post1, post2]} />)

    const publishBtns = screen.getAllByRole('button', { name: /Objavi zdaj/i })
    await userEvent.click(publishBtns[0])

    expect(screen.queryByText('Prva objava')).not.toBeInTheDocument()
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/posts/publish',
        expect.objectContaining({ method: 'POST' })
      )
    )
  })

  it('handlePublishNow: rollback при ошибке fetch — строка возвращается, toast.error вызван', async () => {
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Publish failed' }),
    })
    render(<ScheduledPostsContainer initialPosts={[post1]} />)

    await userEvent.click(screen.getByRole('button', { name: /Objavi zdaj/i }))

    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith('Publish failed'))
    expect(screen.getByText('Prva objava')).toBeInTheDocument()
  })

  it('handleEdit: вызывает router.push с корректным путём', async () => {
    render(<ScheduledPostsContainer initialPosts={[post1]} />)
    await userEvent.click(screen.getByRole('button', { name: /Uredi objavo/i }))
    expect(mockPush).toHaveBeenCalledWith('/posts/p1/edit')
  })
})
