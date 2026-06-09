import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreatePost = vi.fn()
const mockGetCategories = vi.fn()

vi.mock('@/features/admin/api/posts', () => ({
  createPost: (...args: unknown[]) => mockCreatePost(...args),
  updatePost: vi.fn(),
}))

vi.mock('@/features/admin/api/categories', () => ({
  getCategories: (...args: unknown[]) => mockGetCategories(...args),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}))

vi.mock('@/lib/waitForCondition', () => ({
  waitForCondition: vi.fn(() => Promise.resolve()),
}))

vi.mock('@/features/admin/components/MediaUploader', () => ({
  MediaUploader: ({
    items,
    onChange,
  }: {
    items: unknown[]
    onChange: (items: unknown[]) => void
  }) => (
    <div data-testid="media-uploader" data-count={items.length}>
      <button
        type="button"
        data-testid="add-generating-video-btn"
        onClick={() =>
          onChange([
            ...items,
            {
              kind: 'new',
              key: 'vgen',
              media_type: 'video',
              is_cover: true,
              order_index: 0,
              thumbnail_status: 'generating',
            },
          ])
        }
      >
        Add generating video
      </button>
      <button
        type="button"
        data-testid="add-error-video-btn"
        onClick={() =>
          onChange([
            ...items,
            {
              kind: 'new',
              key: 'verr',
              media_type: 'video',
              is_cover: true,
              order_index: 0,
              thumbnail_status: 'error',
            },
          ])
        }
      >
        Add error video
      </button>
    </div>
  ),
}))

vi.mock('@/features/editor/components/TiptapEditor', () => ({
  TiptapEditor: ({ value }: { value: { html: string } }) => (
    <div data-testid="tiptap-editor">{value.html}</div>
  ),
}))

vi.mock('@/features/auth/store', () => ({
  useAuthStore: vi.fn((selector: (s: { user: { id: string } | null }) => unknown) =>
    selector({ user: { id: 'user-123' } })
  ),
}))

import { PostForm } from '@/features/admin/components/PostForm'

describe('PostForm — таймаут ожидания poster (Finding 2, Раунд 6)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetCategories.mockResolvedValue([])
    mockCreatePost.mockResolvedValue('post-no-poster')
  })

  it('сохраняет видео без poster и уведомляет пользователя, если poster не создан после ожидания', async () => {
    const { toast } = await import('sonner')
    const user = userEvent.setup()
    render(<PostForm mode="create" />)

    await user.type(screen.getByLabelText(/naslov/i), 'Video Post')
    await user.click(screen.getByTestId('add-generating-video-btn'))
    await user.click(screen.getByRole('button', { name: /^objavi$/i }))

    await waitFor(() => {
      expect(mockCreatePost).toHaveBeenCalledOnce()
    })
    expect(toast.warning).toHaveBeenCalledWith(
      'Poster ni bil samodejno ustvarjen. Objava je shranjena brez njega — dodate ga lahko ročno pozneje.'
    )
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('сохраняет видео без poster и уведомляет пользователя при ошибке генерации', async () => {
    const { toast } = await import('sonner')
    const user = userEvent.setup()
    render(<PostForm mode="create" />)

    await user.type(screen.getByLabelText(/naslov/i), 'Video Post')
    await user.click(screen.getByTestId('add-error-video-btn'))
    await user.click(screen.getByRole('button', { name: /^objavi$/i }))

    await waitFor(() => {
      expect(mockCreatePost).toHaveBeenCalledOnce()
    })
    expect(toast.warning).toHaveBeenCalledWith(
      'Poster ni bil samodejno ustvarjen. Objava je shranjena brez njega — dodate ga lahko ročno pozneje.'
    )
    expect(toast.success).not.toHaveBeenCalled()
  })
})
