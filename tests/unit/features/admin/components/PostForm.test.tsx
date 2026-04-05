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
    <div
      data-testid="media-uploader"
      data-count={items.length}
      data-submitting={String(isSubmitting ?? false)}
    >
      <button
        type="button"
        data-testid="add-media-btn"
        onClick={() =>
          onChange([
            ...items,
            {
              kind: 'new',
              key: 'k1',
              media_type: 'image',
              is_cover: true,
              order_index: 0,
            },
          ])
        }
      >
        Add
      </button>
    </div>
  ),
}))

vi.mock('@/features/editor/components/TiptapEditor', () => ({
  TiptapEditor: ({
    value,
    onChange,
    disabled,
  }: {
    value: { html: string }
    onChange: (value: {
      html: string
      json: { type: string; content: unknown[] }
      inline_images_count: number
    }) => void
    disabled?: boolean
  }) => (
    <div
      data-testid="tiptap-editor"
      data-disabled={String(disabled ?? false)}
    >
      <div data-testid="tiptap-html">{value.html}</div>
      <button
        type="button"
        data-testid="set-editor-content-btn"
        onClick={() =>
          onChange({
            html: '<p>Rich editor body</p>',
            json: { type: 'doc', content: [] },
            inline_images_count: 1,
          })
        }
      >
        Set editor content
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

async function renderPostFormAndWait(
  props: React.ComponentProps<typeof PostForm>
) {
  render(<PostForm {...props} />)
  await waitFor(() => {
    expect(screen.getByLabelText(/kategorija/i)).not.toBeDisabled()
  })
}

function getCurationCheckboxes() {
  return screen.getAllByRole('checkbox') as HTMLInputElement[]
}

function getPublishModeButtons() {
  const buttons = screen.getAllByRole('button') as HTMLButtonElement[]
  const immediateButton = buttons.find((button) =>
    button.textContent?.includes('Objavi zdaj')
  )
  const scheduleButton = buttons.find((button) =>
    button.textContent?.includes('Načrtuj objavo')
  )

  if (!immediateButton || !scheduleButton) {
    throw new Error('Publish mode buttons not found')
  }

  return { immediateButton, scheduleButton }
}

function getDatetimeInput() {
  const input = document.querySelector(
    'input[type="datetime-local"]'
  ) as HTMLInputElement | null

  if (!input) {
    throw new Error('Datetime input not found')
  }

  return input
}

function getSubmitButton() {
  const button = document.querySelector(
    'button[type="submit"]'
  ) as HTMLButtonElement | null

  if (!button) {
    throw new Error('Submit button not found')
  }

  return button
}

describe('PostForm (create mode)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetCategories.mockResolvedValue(testCategories)
  })

  it('renders form fields', async () => {
    await renderPostFormAndWait({ mode: 'create' })
    expect(screen.getByLabelText(/naslov/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/kategorija/i)).toBeInTheDocument()
    expect(screen.getByText(/galerija objave/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/vsebina objave/i)).toBeInTheDocument()
    expect(screen.getByTestId('tiptap-editor')).toBeInTheDocument()
    expect(screen.getByTestId('media-uploader')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /^objavi$/i })
    ).toBeInTheDocument()
  })

  it('renders gallery block before editor block', async () => {
    await renderPostFormAndWait({ mode: 'create' })

    const galleryHeading = screen.getByText(/galerija objave/i)
    const editorLabel = screen.getByText(/vsebina objave/i)

    const position = galleryHeading.compareDocumentPosition(editorLabel)
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
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
    await waitFor(() =>
      expect(screen.getByLabelText(/kategorija/i)).not.toBeDisabled()
    )
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
    await waitFor(() =>
      expect(screen.getByLabelText(/kategorija/i)).not.toBeDisabled()
    )
    await user.selectOptions(screen.getByLabelText(/kategorija/i), 'insight')
    await user.click(screen.getByTestId('add-media-btn'))
    await user.click(screen.getByTestId('set-editor-content-btn'))
    await user.click(screen.getByRole('button', { name: /^objavi$/i }))

    await waitFor(() => {
      expect(mockCreatePost).toHaveBeenCalledOnce()
    })
    const call = mockCreatePost.mock.calls[0][0]
    expect(call.formValues.title).toBe('My Post')
    expect(call.formValues.category).toBe('insight')
    expect(call.authorId).toBe('user-123')
    expect(call.editor.html).toBe('<p>Rich editor body</p>')
    expect(call.editor.inline_images_count).toBe(1)
    expect(call.meta.excerpt).toBe('')
    expect(call.gallery).toHaveLength(1)
  })

  it('disables submit button and shows spinner while submitting', async () => {
    const user = userEvent.setup()
    mockCreatePost.mockImplementation(() => new Promise(() => {}))
    render(<PostForm mode="create" />)

    await user.type(screen.getByLabelText(/naslov/i), 'My Post')
    await waitFor(() =>
      expect(screen.getByLabelText(/kategorija/i)).not.toBeDisabled()
    )
    await user.selectOptions(screen.getByLabelText(/kategorija/i), 'insight')
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
    await waitFor(() =>
      expect(screen.getByLabelText(/kategorija/i)).not.toBeDisabled()
    )
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
    await waitFor(() =>
      expect(screen.getByLabelText(/kategorija/i)).not.toBeDisabled()
    )
    await user.selectOptions(screen.getByLabelText(/kategorija/i), 'insight')
    await user.click(screen.getByTestId('add-media-btn'))
    await user.click(screen.getByRole('button', { name: /^objavi$/i }))

    await waitFor(() => {
      expect(mockRouterPush).toHaveBeenCalledWith('/feed')
    })
  })
})

describe('PostForm create mode race conditions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetCategories.mockResolvedValue(testCategories)
  })

  it('shows validation error when category is not selected', async () => {
    const user = userEvent.setup()
    render(<PostForm mode="create" />)

    await user.type(screen.getByLabelText(/naslov/i), 'My Post')
    await waitFor(() =>
      expect(screen.getByLabelText(/kategorija/i)).not.toBeDisabled()
    )
    await user.click(screen.getByTestId('add-media-btn'))
    await user.click(screen.getByRole('button', { name: /^objavi$/i }))

    await waitFor(() => {
      expect(screen.getByText(/kategorija je obvezna/i)).toBeInTheDocument()
    })
    expect(mockCreatePost).not.toHaveBeenCalled()
  })

  it('keeps submit blocked while categories are still loading', async () => {
    let resolveCategories: (cats: typeof testCategories) => void
    const categoriesPromise = new Promise<typeof testCategories>((resolve) => {
      resolveCategories = resolve
    })
    vi.clearAllMocks()
    mockGetCategories.mockReturnValueOnce(categoriesPromise)

    render(<PostForm mode="create" />)

    expect(screen.getByLabelText(/kategorija/i)).toBeDisabled()

    resolveCategories!(testCategories)

    await waitFor(() => {
      expect(screen.getByLabelText(/kategorija/i)).not.toBeDisabled()
    })
  })
})

describe('PostForm curation toggles', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetCategories.mockResolvedValue(testCategories)
  })

  it('renders landing preview checkbox', async () => {
    await renderPostFormAndWait({ mode: 'create' })
    const [landingPreviewCheckbox] = getCurationCheckboxes()
    expect(landingPreviewCheckbox).toBeInTheDocument()
  })

  it('renders onboarding checkbox', async () => {
    await renderPostFormAndWait({ mode: 'create' })
    const [, onboardingCheckbox] = getCurationCheckboxes()
    expect(onboardingCheckbox).toBeInTheDocument()
  })

  it('submits is_landing_preview=true when checkbox is enabled', async () => {
    const user = userEvent.setup()
    mockCreatePost.mockResolvedValue('post-id')
    render(<PostForm mode="create" />)

    await user.type(screen.getByLabelText(/naslov/i), 'Landing Post')
    await waitFor(() =>
      expect(screen.getByLabelText(/kategorija/i)).not.toBeDisabled()
    )
    await user.selectOptions(screen.getByLabelText(/kategorija/i), 'insight')
    await user.click(screen.getByTestId('add-media-btn'))
    const [landingPreviewCheckbox] = getCurationCheckboxes()
    await user.click(landingPreviewCheckbox)
    await user.click(screen.getByRole('button', { name: /^objavi$/i }))

    await waitFor(() => expect(mockCreatePost).toHaveBeenCalledOnce())
    const call = mockCreatePost.mock.calls[0][0]
    expect(call.formValues.is_landing_preview).toBe(true)
  })

  it('submits is_onboarding=true when checkbox is enabled', async () => {
    const user = userEvent.setup()
    mockCreatePost.mockResolvedValue('post-id')
    render(<PostForm mode="create" />)

    await user.type(screen.getByLabelText(/naslov/i), 'Onboarding Post')
    await waitFor(() =>
      expect(screen.getByLabelText(/kategorija/i)).not.toBeDisabled()
    )
    await user.selectOptions(screen.getByLabelText(/kategorija/i), 'insight')
    await user.click(screen.getByTestId('add-media-btn'))
    const [, onboardingCheckbox] = getCurationCheckboxes()
    await user.click(onboardingCheckbox)
    await user.click(screen.getByRole('button', { name: /^objavi$/i }))

    await waitFor(() => expect(mockCreatePost).toHaveBeenCalledOnce())
    const call = mockCreatePost.mock.calls[0][0]
    expect(call.formValues.is_onboarding).toBe(true)
  })

  it('hydrates is_landing_preview from initialData', async () => {
    await renderPostFormAndWait({
      mode: 'edit',
      initialData: {
        id: 'p1',
        title: 'Post',
        category: 'stories',
        is_landing_preview: true,
        is_onboarding: false,
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
      },
    })

    const [checkbox] = getCurationCheckboxes()
    expect(checkbox.checked).toBe(true)
  })

  it('hydrates is_onboarding from initialData', async () => {
    await renderPostFormAndWait({
      mode: 'edit',
      initialData: {
        id: 'p1',
        title: 'Post',
        category: 'stories',
        is_landing_preview: false,
        is_onboarding: true,
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
      },
    })

    const [, checkbox] = getCurationCheckboxes()
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
    expect(screen.getByTestId('tiptap-html')).toHaveTextContent('Some content')
    await waitFor(() => {
      expect(screen.getByLabelText(/kategorija/i)).toHaveValue('stories')
    })
    expect(screen.getByTestId('media-uploader')).toHaveAttribute(
      'data-count',
      '1'
    )
  })

  it('calls updatePost on valid submit in edit mode', async () => {
    const user = userEvent.setup()
    mockUpdatePost.mockResolvedValue(undefined)
    render(<PostForm mode="edit" initialData={initialData} />)

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

  it('hydrates category after delayed categories load', async () => {
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

describe('PostForm scheduling toggle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetCategories.mockResolvedValue(testCategories)
  })

  it('renders scheduling toggle with "Objavi zdaj" active by default', async () => {
    await renderPostFormAndWait({ mode: 'create' })
    const { immediateButton, scheduleButton } = getPublishModeButtons()
    expect(immediateButton).toHaveAttribute('aria-pressed', 'true')
    expect(scheduleButton).toHaveAttribute('aria-pressed', 'false')
  })

  it('toggles to scheduled mode and shows datetime picker', async () => {
    const user = userEvent.setup()
    await renderPostFormAndWait({ mode: 'create' })

    const { immediateButton, scheduleButton } = getPublishModeButtons()
    await user.click(scheduleButton)

    expect(scheduleButton).toHaveAttribute('aria-pressed', 'true')
    expect(immediateButton).toHaveAttribute('aria-pressed', 'false')
    expect(getDatetimeInput()).toBeInTheDocument()
  })

  it('hides datetime picker when switching back to immediate', async () => {
    const user = userEvent.setup()
    await renderPostFormAndWait({ mode: 'create' })

    const { immediateButton, scheduleButton } = getPublishModeButtons()
    await user.click(scheduleButton)
    expect(getDatetimeInput()).toBeInTheDocument()

    await user.click(immediateButton)
    expect(document.querySelector('input[type="datetime-local"]')).toBeNull()
  })

  it('shows inline error when submitting scheduled without datetime', async () => {
    const user = userEvent.setup()
    render(<PostForm mode="create" />)

    await user.type(screen.getByLabelText(/naslov/i), 'Scheduled Post')
    await waitFor(() =>
      expect(screen.getByLabelText(/kategorija/i)).not.toBeDisabled()
    )
    await user.selectOptions(screen.getByLabelText(/kategorija/i), 'insight')
    await user.click(screen.getByTestId('add-media-btn'))
    const { scheduleButton } = getPublishModeButtons()
    await user.click(scheduleButton)
    await user.click(getSubmitButton())

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
    await waitFor(() =>
      expect(screen.getByLabelText(/kategorija/i)).not.toBeDisabled()
    )
    await user.selectOptions(screen.getByLabelText(/kategorija/i), 'insight')
    await user.click(screen.getByTestId('add-media-btn'))
    const { scheduleButton } = getPublishModeButtons()
    await user.click(scheduleButton)

    const futureDate = '2027-06-15T14:30'
    const datetimeInput = getDatetimeInput()
    await user.clear(datetimeInput)
    await user.type(datetimeInput, futureDate)

    const submitBtn = getSubmitButton()
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
            {
              id: 'm1',
              url: 'https://cdn.example.com/m1.jpg',
              thumbnail_url: null,
              media_type: 'image' as const,
              order_index: 0,
              is_cover: true,
            },
          ],
        }}
      />
    )

    await waitFor(() =>
      expect(screen.getByLabelText(/kategorija/i)).not.toBeDisabled()
    )

    const { scheduleButton } = getPublishModeButtons()
    expect(scheduleButton).toHaveAttribute('aria-pressed', 'true')
    expect(getDatetimeInput()).toBeInTheDocument()
    expect(
      getDatetimeInput().value
    ).toBeTruthy()
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

    await waitFor(() =>
      expect(screen.getByLabelText(/kategorija/i)).not.toBeDisabled()
    )

    expect(
      screen.getByRole('button', { name: /shrani spremembe/i })
    ).toBeInTheDocument()
  })

  it('disables scheduling for an already published post', async () => {
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

    await waitFor(() =>
      expect(screen.getByLabelText(/kategorija/i)).not.toBeDisabled()
    )

    const { scheduleButton } = getPublishModeButtons()
    expect(scheduleButton).toBeDisabled()
  })

  it('calls /api/posts/publish when transitioning scheduled to published', async () => {
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

    await waitFor(() =>
      expect(screen.getByLabelText(/kategorija/i)).not.toBeDisabled()
    )

    await user.click(screen.getByRole('button', { name: /objavi zdaj/i }))
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
