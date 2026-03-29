import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreatePost = vi.fn()
const mockUpdatePost = vi.fn()
const mockRouterPush = vi.fn()
const mockGetCategories = vi.fn()

vi.mock('@/features/admin/api/posts', () => ({
  createPost: (...args: unknown[]) => mockCreatePost(...args),
  updatePost: (...args: unknown[]) => mockUpdatePost(...args),
}))

vi.mock('@/features/admin/api/categories', () => ({
  getCategories: (...args: unknown[]) => mockGetCategories(...args),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockRouterPush }),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

// Mock MediaUploader to avoid @dnd-kit issues
vi.mock('@/features/admin/components/MediaUploader', () => ({
  MediaUploader: ({
    items,
    onChange,
    isSubmitting,
  }: {
    items: unknown[]
    onChange: (items: unknown[]) => void
    isSubmitting?: boolean
  }) => (
    <div data-testid="media-uploader" data-count={items.length} data-submitting={String(isSubmitting ?? false)}>
      <button
        type="button"
        data-testid="add-media-btn"
        onClick={() => onChange([...items, { kind: 'new', key: 'k1', media_type: 'image', is_cover: true, order_index: 0 }])}
      >
        Add
      </button>
    </div>
  ),
}))

vi.mock('@/features/auth/store', () => ({
  useAuthStore: vi.fn((selector: (s: { user: { id: string } | null }) => unknown) =>
    selector({ user: { id: 'user-123' } })
  ),
}))

import { PostForm } from '@/features/admin/components/PostForm'

const testCategories = [
  { id: '1', name: 'Stories', slug: 'stories', created_at: '2026-01-01' },
  { id: '2', name: 'Insight', slug: 'insight', created_at: '2026-01-01' },
]

describe('PostForm (create mode)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetCategories.mockResolvedValue(testCategories)
  })

  it('renders form fields', () => {
    render(<PostForm mode="create" />)
    expect(screen.getByLabelText(/naslov/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/kategorija/i)).toBeInTheDocument()
    expect(screen.getByTestId('media-uploader')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /objavi/i })).toBeInTheDocument()
  })

  it('shows inline validation error when title is empty on submit', async () => {
    const user = userEvent.setup()
    render(<PostForm mode="create" />)

    await user.click(screen.getByRole('button', { name: /objavi/i }))

    await waitFor(() => {
      expect(screen.getByText(/naslov je obvezen/i)).toBeInTheDocument()
    })
    expect(mockCreatePost).not.toHaveBeenCalled()
  })

  it('shows inline validation error when category is empty on submit', async () => {
    const user = userEvent.setup()
    render(<PostForm mode="create" />)

    await user.type(screen.getByLabelText(/naslov/i), 'Test Post')
    await user.click(screen.getByRole('button', { name: /objavi/i }))

    await waitFor(() => {
      expect(screen.getByText(/kategorija je obvezna/i)).toBeInTheDocument()
    })
    expect(mockCreatePost).not.toHaveBeenCalled()
  })

  it('shows media required error when no media items on submit', async () => {
    const user = userEvent.setup()
    render(<PostForm mode="create" />)

    await user.type(screen.getByLabelText(/naslov/i), 'My Post')
    // Wait for categories to load and select one
    await waitFor(() => expect(screen.getByLabelText(/kategorija/i)).not.toBeDisabled())
    await user.selectOptions(screen.getByLabelText(/kategorija/i), 'insight')
    await user.click(screen.getByRole('button', { name: /objavi/i }))

    await waitFor(() => {
      expect(screen.getByTestId('media-required-error')).toBeInTheDocument()
    })
    expect(mockCreatePost).not.toHaveBeenCalled()
  })

  it('calls createPost with form values on valid submit', async () => {
    const user = userEvent.setup()
    mockCreatePost.mockResolvedValue('new-post-id')
    render(<PostForm mode="create" />)

    await user.type(screen.getByLabelText(/naslov/i), 'My Post')
    // Wait for categories to load and select one
    await waitFor(() => expect(screen.getByLabelText(/kategorija/i)).not.toBeDisabled())
    await user.selectOptions(screen.getByLabelText(/kategorija/i), 'insight')
    // Add a media item via mock button
    await user.click(screen.getByTestId('add-media-btn'))
    await user.click(screen.getByRole('button', { name: /objavi/i }))

    await waitFor(() => {
      expect(mockCreatePost).toHaveBeenCalledOnce()
    })
    const call = mockCreatePost.mock.calls[0][0]
    expect(call.formValues.title).toBe('My Post')
    expect(call.formValues.category).toBe('insight')
    expect(call.authorId).toBe('user-123')
  })

  it('disables submit button and shows spinner while submitting', async () => {
    const user = userEvent.setup()
    // Delay to observe loading state
    mockCreatePost.mockImplementation(() => new Promise(() => {}))
    render(<PostForm mode="create" />)

    await user.type(screen.getByLabelText(/naslov/i), 'My Post')
    await waitFor(() => expect(screen.getByLabelText(/kategorija/i)).not.toBeDisabled())
    await user.selectOptions(screen.getByLabelText(/kategorija/i), 'insight')
    // Add a media item
    await user.click(screen.getByTestId('add-media-btn'))

    const submitBtn = screen.getByRole('button', { name: /objavi/i })
    await user.click(submitBtn)

    await waitFor(() => {
      expect(submitBtn).toBeDisabled()
    })
  })

  it('shows error toast on createPost failure', async () => {
    const { toast } = await import('sonner')
    const user = userEvent.setup()
    mockCreatePost.mockRejectedValue(new Error('Upload failed'))
    render(<PostForm mode="create" />)

    await user.type(screen.getByLabelText(/naslov/i), 'My Post')
    await waitFor(() => expect(screen.getByLabelText(/kategorija/i)).not.toBeDisabled())
    await user.selectOptions(screen.getByLabelText(/kategorija/i), 'insight')
    await user.click(screen.getByTestId('add-media-btn'))
    await user.click(screen.getByRole('button', { name: /objavi/i }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Upload failed')
    })
  })

  it('redirects to feed after successful create', async () => {
    const user = userEvent.setup()
    mockCreatePost.mockResolvedValue('post-abc')
    render(<PostForm mode="create" />)

    await user.type(screen.getByLabelText(/naslov/i), 'My Post')
    await waitFor(() => expect(screen.getByLabelText(/kategorija/i)).not.toBeDisabled())
    await user.selectOptions(screen.getByLabelText(/kategorija/i), 'insight')
    await user.click(screen.getByTestId('add-media-btn'))
    await user.click(screen.getByRole('button', { name: /objavi/i }))

    await waitFor(() => {
      expect(mockRouterPush).toHaveBeenCalledWith('/feed')
    })
  })
})

describe('PostForm (create mode) — race conditions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetCategories.mockResolvedValue(testCategories)
  })

  it('submit без выбранной категории показывает ошибку валидации', async () => {
    const user = userEvent.setup()
    render(<PostForm mode="create" />)

    await user.type(screen.getByLabelText(/naslov/i), 'My Post')
    await waitFor(() => expect(screen.getByLabelText(/kategorija/i)).not.toBeDisabled())
    await user.click(screen.getByTestId('add-media-btn'))
    // Намеренно НЕ выбираем категорию — значение остаётся ''
    await user.click(screen.getByRole('button', { name: /objavi/i }))

    await waitFor(() => {
      expect(screen.getByText(/kategorija je obvezna/i)).toBeInTheDocument()
    })
    expect(mockCreatePost).not.toHaveBeenCalled()
  })

  it('submit пока категории загружаются (select disabled) не отправляет форму', async () => {
    const user = userEvent.setup()
    let resolveCategories: (cats: typeof testCategories) => void
    const categoriesPromise = new Promise<typeof testCategories>((resolve) => {
      resolveCategories = resolve
    })
    vi.clearAllMocks()
    mockGetCategories.mockReturnValueOnce(categoriesPromise)

    render(<PostForm mode="create" />)

    // Пока категории грузятся — select disabled
    expect(screen.getByLabelText(/kategorija/i)).toBeDisabled()

    resolveCategories!(testCategories)

    // После загрузки — select enabled
    await waitFor(() => {
      expect(screen.getByLabelText(/kategorija/i)).not.toBeDisabled()
    })
  })
})

describe('PostForm (edit mode)', () => {
  const initialData = {
    id: 'post-1',
    title: 'Existing Post',
    content: 'Some content',
    excerpt: 'Excerpt',
    category: 'stories',
    post_media: [
      {
        id: 'm1',
        url: 'https://cdn.example.com/m1.jpg',
        thumbnail_url: null,
        media_type: 'image' as const,
        order_index: 0,
        is_cover: true,
      },
    ],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetCategories.mockResolvedValue(testCategories)
  })

  it('pre-fills form with existing data', async () => {
    render(<PostForm mode="edit" initialData={initialData} />)
    expect(screen.getByDisplayValue('Existing Post')).toBeInTheDocument()
    // Select should have the initial category value ('stories') pre-selected
    await waitFor(() => {
      expect(screen.getByLabelText(/kategorija/i)).toHaveValue('stories')
    })
    // MediaUploader receives 1 existing item
    expect(screen.getByTestId('media-uploader')).toHaveAttribute('data-count', '1')
  })

  it('calls updatePost on valid submit in edit mode', async () => {
    const user = userEvent.setup()
    mockUpdatePost.mockResolvedValue(undefined)
    render(<PostForm mode="edit" initialData={initialData} />)

    // Wait for categories to load so form validation passes
    await waitFor(() =>
      expect(screen.getByLabelText(/kategorija/i)).not.toBeDisabled()
    )
    await user.click(screen.getByRole('button', { name: /shrani/i }))

    await waitFor(() => {
      expect(mockUpdatePost).toHaveBeenCalledOnce()
    })
    const call = mockUpdatePost.mock.calls[0][0]
    expect(call.postId).toBe('post-1')
    expect(call.formValues.title).toBe('Existing Post')
  })

  it('устанавливает категорию из initialData после задержанной загрузки категорий', async () => {
    let resolveCategories: (cats: typeof testCategories) => void
    const categoriesPromise = new Promise<typeof testCategories>((resolve) => {
      resolveCategories = resolve
    })
    mockGetCategories.mockReturnValue(categoriesPromise)

    render(<PostForm mode="edit" initialData={initialData} />)

    expect(screen.getByLabelText(/kategorija/i)).toBeDisabled()

    resolveCategories!(testCategories)

    await waitFor(() => {
      expect(screen.getByLabelText(/kategorija/i)).toHaveValue('stories')
    })
  })
})
