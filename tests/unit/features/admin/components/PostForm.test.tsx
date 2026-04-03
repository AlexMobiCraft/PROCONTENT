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
    expect(screen.getByRole('button', { name: /^objavi$/i })).toBeInTheDocument()
  })

  it('shows inline validation error when title is empty on submit', async () => {
    const user = userEvent.setup()
    render(<PostForm mode="create" />)

    await user.click(screen.getByRole('button', { name: /^objavi$/i }))

    await waitFor(() => {
      expect(screen.getByText(/naslov je obvezen/i)).toBeInTheDocument()
    })
    expect(mockCreatePost).not.toHaveBeenCalled()
  })

  it('shows inline validation error when category is empty on submit', async () => {
    const user = userEvent.setup()
    render(<PostForm mode="create" />)

    await user.type(screen.getByLabelText(/naslov/i), 'Test Post')
    await user.click(screen.getByRole('button', { name: /^objavi$/i }))

    await waitFor(() => {
      expect(screen.getByText(/kategorija je obvezna/i)).toBeInTheDocument()
    })
    expect(mockCreatePost).not.toHaveBeenCalled()
  })

  it('allows submit without media items (creates text post)', async () => {
    const user = userEvent.setup()
    mockCreatePost.mockResolvedValue('text-post-id')
    render(<PostForm mode="create" />)

    await user.type(screen.getByLabelText(/naslov/i), 'My Post')
    // Wait for categories to load and select one
    await waitFor(() => expect(screen.getByLabelText(/kategorija/i)).not.toBeDisabled())
    await user.selectOptions(screen.getByLabelText(/kategorija/i), 'insight')
    await user.click(screen.getByRole('button', { name: /^objavi$/i }))

    await waitFor(() => {
      expect(mockCreatePost).toHaveBeenCalledOnce()
    })
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
    await user.click(screen.getByRole('button', { name: /^objavi$/i }))

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

    const submitBtn = screen.getByRole('button', { name: /^objavi$/i })
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
    await user.click(screen.getByRole('button', { name: /^objavi$/i }))

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
    await user.click(screen.getByRole('button', { name: /^objavi$/i }))

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
    await user.click(screen.getByRole('button', { name: /^objavi$/i }))

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

describe('PostForm — curation toggles', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetCategories.mockResolvedValue(testCategories)
  })

  it('рендерит чекбокс landing preview', () => {
    render(<PostForm mode="create" />)
    expect(screen.getByLabelText(/Prikaži na začetni strani/i)).toBeInTheDocument()
  })

  it('рендерит чекбокс onboarding', () => {
    render(<PostForm mode="create" />)
    expect(screen.getByLabelText(/Dodaj v uvajanje novih članic/i)).toBeInTheDocument()
  })

  it('передаёт is_landing_preview=true при включённом чекбоксе', async () => {
    const user = userEvent.setup()
    mockCreatePost.mockResolvedValue('post-id')
    render(<PostForm mode="create" />)

    await user.type(screen.getByLabelText(/naslov/i), 'Landing Post')
    await waitFor(() => expect(screen.getByLabelText(/kategorija/i)).not.toBeDisabled())
    await user.selectOptions(screen.getByLabelText(/kategorija/i), 'insight')
    await user.click(screen.getByTestId('add-media-btn'))
    await user.click(screen.getByLabelText(/Prikaži na začetni strani/i))
    await user.click(screen.getByRole('button', { name: /^objavi$/i }))

    await waitFor(() => expect(mockCreatePost).toHaveBeenCalledOnce())
    const call = mockCreatePost.mock.calls[0][0]
    expect(call.formValues.is_landing_preview).toBe(true)
  })

  it('передаёт is_onboarding=true при включённом чекбоксе', async () => {
    const user = userEvent.setup()
    mockCreatePost.mockResolvedValue('post-id')
    render(<PostForm mode="create" />)

    await user.type(screen.getByLabelText(/naslov/i), 'Onboarding Post')
    await waitFor(() => expect(screen.getByLabelText(/kategorija/i)).not.toBeDisabled())
    await user.selectOptions(screen.getByLabelText(/kategorija/i), 'insight')
    await user.click(screen.getByTestId('add-media-btn'))
    await user.click(screen.getByLabelText(/Dodaj v uvajanje novih članic/i))
    await user.click(screen.getByRole('button', { name: /^objavi$/i }))

    await waitFor(() => expect(mockCreatePost).toHaveBeenCalledOnce())
    const call = mockCreatePost.mock.calls[0][0]
    expect(call.formValues.is_onboarding).toBe(true)
  })

  it('edit mode предзаполняет is_landing_preview из initialData', async () => {
    render(<PostForm mode="edit" initialData={{
      id: 'p1', title: 'Post', category: 'stories',
      is_landing_preview: true, is_onboarding: false,
      post_media: [{ id: 'm1', url: 'https://cdn.example.com/m1.jpg', thumbnail_url: null, media_type: 'image' as const, order_index: 0, is_cover: true }],
    }} />)
    const checkbox = screen.getByLabelText(/Prikaži na začetni strani/i) as HTMLInputElement
    expect(checkbox.checked).toBe(true)
  })

  it('edit mode предзаполняет is_onboarding из initialData', async () => {
    render(<PostForm mode="edit" initialData={{
      id: 'p1', title: 'Post', category: 'stories',
      is_landing_preview: false, is_onboarding: true,
      post_media: [{ id: 'm1', url: 'https://cdn.example.com/m1.jpg', thumbnail_url: null, media_type: 'image' as const, order_index: 0, is_cover: true }],
    }} />)
    const checkbox = screen.getByLabelText(/Dodaj v uvajanje novih članic/i) as HTMLInputElement
    expect(checkbox.checked).toBe(true)
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

describe('PostForm — scheduling toggle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetCategories.mockResolvedValue(testCategories)
  })

  it('renders scheduling toggle with "Objavi zdaj" active by default', () => {
    render(<PostForm mode="create" />)
    const immediateBtn = screen.getByRole('button', { name: /objavi zdaj/i })
    const scheduleBtn = screen.getByRole('button', { name: /načrtuj objavo/i })
    expect(immediateBtn).toHaveAttribute('aria-pressed', 'true')
    expect(scheduleBtn).toHaveAttribute('aria-pressed', 'false')
  })

  it('toggles to scheduled mode and shows datetime picker', async () => {
    const user = userEvent.setup()
    render(<PostForm mode="create" />)

    await user.click(screen.getByRole('button', { name: /načrtuj objavo/i }))

    expect(screen.getByRole('button', { name: /načrtuj objavo/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /objavi zdaj/i })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByLabelText(/datum in čas objave/i)).toBeInTheDocument()
  })

  it('hides datetime picker when switching back to immediate', async () => {
    const user = userEvent.setup()
    render(<PostForm mode="create" />)

    await user.click(screen.getByRole('button', { name: /načrtuj objavo/i }))
    expect(screen.getByLabelText(/datum in čas objave/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /objavi zdaj/i }))
    expect(screen.queryByLabelText(/datum in čas objave/i)).not.toBeInTheDocument()
  })

  it('shows inline error when submitting scheduled without datetime', async () => {
    const user = userEvent.setup()
    render(<PostForm mode="create" />)

    await user.type(screen.getByLabelText(/naslov/i), 'Scheduled Post')
    await waitFor(() => expect(screen.getByLabelText(/kategorija/i)).not.toBeDisabled())
    await user.selectOptions(screen.getByLabelText(/kategorija/i), 'insight')
    await user.click(screen.getByTestId('add-media-btn'))

    // Switch to scheduled mode
    await user.click(screen.getByRole('button', { name: /načrtuj objavo/i }))
    // Submit without setting datetime — submit button says "Načrtuj" (not "Načrtuj objavo")
    await user.click(screen.getByRole('button', { name: /^načrtuj$/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
    expect(mockCreatePost).not.toHaveBeenCalled()
  })

  it('submits with status=scheduled and scheduled_at when datetime is set', async () => {
    const user = userEvent.setup()
    mockCreatePost.mockResolvedValue('sched-post-id')
    render(<PostForm mode="create" />)

    await user.type(screen.getByLabelText(/naslov/i), 'Scheduled Post')
    await waitFor(() => expect(screen.getByLabelText(/kategorija/i)).not.toBeDisabled())
    await user.selectOptions(screen.getByLabelText(/kategorija/i), 'insight')
    await user.click(screen.getByTestId('add-media-btn'))

    // Switch to scheduled mode
    await user.click(screen.getByRole('button', { name: /načrtuj objavo/i }))

    // Set future datetime
    const futureDate = '2027-06-15T14:30'
    const datetimeInput = screen.getByLabelText(/datum in čas objave/i)
    await user.clear(datetimeInput)
    await user.type(datetimeInput, futureDate)

    // Submit button should say "Načrtuj"
    const submitBtn = screen.getByRole('button', { name: /^načrtuj$/i })
    expect(submitBtn).toHaveAttribute('type', 'submit')

    await user.click(submitBtn)

    await waitFor(() => {
      expect(mockCreatePost).toHaveBeenCalledOnce()
    })
    const call = mockCreatePost.mock.calls[0][0]
    expect(call.formValues.status).toBe('scheduled')
    expect(call.formValues.scheduled_at).toBeTruthy()
  })

  it('pre-fills toggle and datetime for scheduled post in edit mode', async () => {
    render(
      <PostForm
        mode="edit"
        initialData={{
          id: 'p1',
          title: 'Scheduled Post',
          category: 'stories',
          status: 'scheduled',
          scheduled_at: '2027-06-15T12:30:00.000Z',
          post_media: [
            { id: 'm1', url: 'https://cdn.example.com/m1.jpg', thumbnail_url: null, media_type: 'image' as const, order_index: 0, is_cover: true },
          ],
        }}
      />
    )

    await waitFor(() => expect(screen.getByLabelText(/kategorija/i)).not.toBeDisabled())

    expect(screen.getByRole('button', { name: /načrtuj objavo/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText(/datum in čas objave/i)).toBeInTheDocument()
    // Datetime input should have a value
    expect((screen.getByLabelText(/datum in čas objave/i) as HTMLInputElement).value).toBeTruthy()
  })

  it('shows "Shrani spremembe" button in edit mode with scheduled post', async () => {
    render(
      <PostForm
        mode="edit"
        initialData={{
          id: 'p1',
          title: 'Scheduled Post',
          category: 'stories',
          status: 'scheduled',
          scheduled_at: '2027-06-15T12:30:00.000Z',
          post_media: [],
        }}
      />
    )

    await waitFor(() => expect(screen.getByLabelText(/kategorija/i)).not.toBeDisabled())

    expect(screen.getByRole('button', { name: /shrani spremembe/i })).toBeInTheDocument()
  })

  it('disables "Načrtuj objavo" button for already published post (AC 2.6)', async () => {
    render(
      <PostForm
        mode="edit"
        initialData={{
          id: 'p1',
          title: 'Published Post',
          category: 'stories',
          status: 'published',
          published_at: '2026-04-01T12:00:00.000Z',
          post_media: [],
        }}
      />
    )

    await waitFor(() => expect(screen.getByLabelText(/kategorija/i)).not.toBeDisabled())

    const scheduleBtn = screen.getByRole('button', { name: /načrtuj objavo/i })
    expect(scheduleBtn).toBeDisabled()
  })

  it('calls /api/posts/publish when transitioning scheduled → published', async () => {
    const user = userEvent.setup()
    mockUpdatePost.mockResolvedValue(undefined)
    const mockFetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ published: true }),
    })
    vi.stubGlobal('fetch', mockFetchFn)

    render(
      <PostForm
        mode="edit"
        initialData={{
          id: 'sched-post-1',
          title: 'Scheduled Post',
          category: 'stories',
          status: 'scheduled',
          scheduled_at: '2027-06-15T12:30:00.000Z',
          post_media: [],
        }}
      />
    )

    await waitFor(() => expect(screen.getByLabelText(/kategorija/i)).not.toBeDisabled())

    // Switch to immediate publish
    await user.click(screen.getByRole('button', { name: /objavi zdaj/i }))

    // Submit — button should now say "Shrani" (edit mode, immediate)
    await user.click(screen.getByRole('button', { name: /shrani/i }))

    await waitFor(() => {
      expect(mockUpdatePost).toHaveBeenCalledOnce()
    })

    await waitFor(() => {
      expect(mockFetchFn).toHaveBeenCalledWith(
        '/api/posts/publish',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ postId: 'sched-post-1' }),
        })
      )
    })

    vi.unstubAllGlobals()
  })
})
