import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

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
    warning: vi.fn(),
    info: vi.fn(),
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
    onUploadError,
    disabled,
  }: {
    value: { html: string }
    onChange: (value: {
      html: string
      json: { type: string; content: unknown[] }
      inline_images_count: number
    }) => void
    onUploadError: (message: string) => void
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
      <button
        type="button"
        data-testid="set-inline-heavy-content-btn"
        onClick={() =>
          onChange({
            html: '<p>Rich editor body</p><img src="https://cdn.example.com/inline-1.jpg" alt="Inline 1" />',
            json: { type: 'doc', content: [] },
            inline_images_count: 1,
          })
        }
      >
        Set inline image
      </button>
      <button
        type="button"
        data-testid="remove-inline-image-btn"
        onClick={() =>
          onChange({
            html: '<p>Rich editor body</p>',
            json: { type: 'doc', content: [] },
            inline_images_count: 0,
          })
        }
      >
        Remove inline image
      </button>
      <button
        type="button"
        data-testid="trigger-upload-error-btn"
        onClick={() => onUploadError('Pri nalaganju slike je prišlo do napake')}
      >
        Trigger upload error
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

  it('allows submit without category (category is optional, sent as null)', async () => {
    const user = userEvent.setup()
    mockCreatePost.mockResolvedValue('no-category-post-id')
    render(<PostForm mode="create" />)

    await user.type(screen.getByLabelText(/naslov/i), 'Test Post')
    await waitFor(() =>
      expect(screen.getByLabelText(/kategorija/i)).not.toBeDisabled()
    )
    await user.click(screen.getByTestId('add-media-btn'))
    await user.click(screen.getByRole('button', { name: /^objavi$/i }))

    await waitFor(() => {
      expect(mockCreatePost).toHaveBeenCalledOnce()
    })
    const call = mockCreatePost.mock.calls[0][0]
    expect(call.formValues.category).toBeNull()
    expect(call.meta.category).toBeNull()
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

  it('keeps gallery state intact when inline image is removed before submit', async () => {
    const user = userEvent.setup()
    mockCreatePost.mockResolvedValue('post-inline-removed')
    render(<PostForm mode="create" />)

    await user.type(screen.getByLabelText(/naslov/i), 'My Post')
    await waitFor(() =>
      expect(screen.getByLabelText(/kategorija/i)).not.toBeDisabled()
    )
    await user.selectOptions(screen.getByLabelText(/kategorija/i), 'insight')
    await user.click(screen.getByTestId('add-media-btn'))
    await user.click(screen.getByTestId('set-inline-heavy-content-btn'))
    await user.click(screen.getByTestId('remove-inline-image-btn'))
    await user.click(screen.getByRole('button', { name: /^objavi$/i }))

    await waitFor(() => {
      expect(mockCreatePost).toHaveBeenCalledOnce()
    })

    const call = mockCreatePost.mock.calls[0][0]
    expect(call.gallery).toHaveLength(1)
    expect(call.editor.html).toBe('<p>Rich editor body</p>')
    expect(call.editor.inline_images_count).toBe(0)
  })

  it('shows upload error toast without resetting typed meta or gallery state', async () => {
    const { toast } = await import('sonner')
    const user = userEvent.setup()
    render(<PostForm mode="create" />)

    await user.type(screen.getByLabelText(/naslov/i), 'Stable title')
    await waitFor(() =>
      expect(screen.getByLabelText(/kategorija/i)).not.toBeDisabled()
    )
    await user.selectOptions(screen.getByLabelText(/kategorija/i), 'insight')
    await user.click(screen.getByTestId('add-media-btn'))
    await user.click(screen.getByTestId('set-editor-content-btn'))
    await user.click(screen.getByTestId('trigger-upload-error-btn'))

    expect(toast.error).toHaveBeenCalledWith(
      'Pri nalaganju slike je prišlo do napake'
    )
    expect(screen.getByLabelText(/naslov/i)).toHaveValue('Stable title')
    expect(screen.getByLabelText(/kategorija/i)).toHaveValue('insight')
    expect(screen.getByTestId('media-uploader')).toHaveAttribute(
      'data-count',
      '1'
    )
    expect(screen.getByTestId('tiptap-html')).toHaveTextContent(
      '<p>Rich editor body</p>'
    )
  })
})

describe('PostForm create mode race conditions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetCategories.mockResolvedValue(testCategories)
  })

  it('submits with null category when none is selected (optional)', async () => {
    const user = userEvent.setup()
    mockCreatePost.mockResolvedValue('optional-category-post-id')
    render(<PostForm mode="create" />)

    await user.type(screen.getByLabelText(/naslov/i), 'My Post')
    await waitFor(() =>
      expect(screen.getByLabelText(/kategorija/i)).not.toBeDisabled()
    )
    await user.click(screen.getByTestId('add-media-btn'))
    await user.click(screen.getByRole('button', { name: /^objavi$/i }))

    await waitFor(() => {
      expect(mockCreatePost).toHaveBeenCalledOnce()
    })
    expect(mockCreatePost.mock.calls[0][0].meta.category).toBeNull()
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
    mockUpdatePost.mockResolvedValue({ published: false })
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
    expect(screen.getByRole('status')).toHaveTextContent(/načrtovanje/i)
    expect(getDatetimeInput()).toHaveFocus()
  })

  it('hides datetime picker when switching back to immediate', async () => {
    const user = userEvent.setup()
    await renderPostFormAndWait({ mode: 'create' })

    const { immediateButton, scheduleButton } = getPublishModeButtons()
    await user.click(scheduleButton)
    expect(getDatetimeInput()).toBeInTheDocument()

    await user.click(immediateButton)
    expect(document.querySelector('input[type="datetime-local"]')).toBeNull()
    expect(screen.getByRole('status')).toHaveTextContent(/takojšnjo objavo/i)
    expect(immediateButton).toHaveFocus()
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
    mockUpdatePost.mockResolvedValue({ published: false })
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

describe('PostForm immediate-publish email notification surfacing', () => {
  const scheduledInitialData = {
    id: 'sched-post-1',
    title: 'Scheduled Post',
    category: 'stories',
    status: 'scheduled' as const,
    scheduled_at: '2027-06-15T12:30:00.000Z',
    post_media: [],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetCategories.mockResolvedValue(testCategories)
    mockUpdatePost.mockResolvedValue({ published: false })
  })

  async function publishScheduledNow(publishResponse: {
    ok: boolean
    body: Record<string, unknown>
  }) {
    const user = userEvent.setup()
    const mockFetchFn = vi.fn().mockResolvedValue({
      ok: publishResponse.ok,
      json: () => Promise.resolve(publishResponse.body),
    })
    vi.stubGlobal('fetch', mockFetchFn)

    render(<PostForm mode="edit" initialData={scheduledInitialData} />)

    await waitFor(() =>
      expect(screen.getByLabelText(/kategorija/i)).not.toBeDisabled()
    )

    await user.click(screen.getByRole('button', { name: /objavi zdaj/i }))
    await user.click(screen.getByRole('button', { name: /shrani/i }))

    await waitFor(() => {
      expect(mockFetchFn).toHaveBeenCalledWith(
        '/api/posts/publish',
        expect.anything()
      )
    })
  }

  it('shows warning toast on hard email error (emailError set), still navigates', async () => {
    const { toast } = await import('sonner')

    await publishScheduledNow({
      ok: true,
      body: {
        published: true,
        emailError: '[notifications] NOTIFICATION_API_SECRET is not configured',
        emailFailed: 0,
      },
    })

    await waitFor(() => {
      expect(toast.warning).toHaveBeenCalledWith(
        'Objava je bila objavljena, vendar e-poštna obvestila niso bila poslana.'
      )
    })
    expect(toast.success).not.toHaveBeenCalled()
    expect(mockRouterPush).toHaveBeenCalledWith('/feed')

    vi.unstubAllGlobals()
  })

  it('shows warning toast on partial-fail (emailFailed > 0 without throw)', async () => {
    const { toast } = await import('sonner')

    await publishScheduledNow({
      ok: true,
      body: { published: true, emailError: null, emailFailed: 2 },
    })

    await waitFor(() => {
      expect(toast.warning).toHaveBeenCalledOnce()
    })
    expect(toast.success).not.toHaveBeenCalled()
    expect(mockRouterPush).toHaveBeenCalledWith('/feed')

    vi.unstubAllGlobals()
  })

  it('shows success toast (no warning) when delivery is clean', async () => {
    const { toast } = await import('sonner')

    await publishScheduledNow({
      ok: true,
      body: { published: true, emailError: null, emailFailed: 0 },
    })

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Objava je bila objavljena')
    })
    expect(toast.warning).not.toHaveBeenCalled()
    expect(mockRouterPush).toHaveBeenCalledWith('/feed')

    vi.unstubAllGlobals()
  })

  it('regression: shows error toast and does not navigate when publish itself fails', async () => {
    const { toast } = await import('sonner')

    await publishScheduledNow({
      ok: false,
      body: { error: 'Napaka pri objavi' },
    })

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Napaka pri objavi')
    })
    expect(toast.warning).not.toHaveBeenCalled()
    expect(toast.success).not.toHaveBeenCalled()
    expect(mockRouterPush).not.toHaveBeenCalled()

    vi.unstubAllGlobals()
  })
})

describe('PostForm new-post email notification (create + draft→published)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetCategories.mockResolvedValue(testCategories)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function stubFetch(response: { ok: boolean; body: Record<string, unknown> }) {
    const mockFetchFn = vi.fn().mockResolvedValue({
      ok: response.ok,
      json: () => Promise.resolve(response.body),
    })
    vi.stubGlobal('fetch', mockFetchFn)
    return mockFetchFn
  }

  async function createPublishedPost() {
    const user = userEvent.setup()
    render(<PostForm mode="create" />)
    await user.type(screen.getByLabelText(/naslov/i), 'Fresh Post')
    await waitFor(() =>
      expect(screen.getByLabelText(/kategorija/i)).not.toBeDisabled()
    )
    await user.selectOptions(screen.getByLabelText(/kategorija/i), 'insight')
    await user.click(screen.getByTestId('add-media-btn'))
    await user.click(screen.getByRole('button', { name: /^objavi$/i }))
  }

  it('calls /api/notifications/new-post and shows success on clean delivery', async () => {
    const { toast } = await import('sonner')
    mockCreatePost.mockResolvedValue('new-post-id')
    const mockFetchFn = stubFetch({ ok: true, body: { sent: 3, failed: 0 } })

    await createPublishedPost()

    await waitFor(() => {
      expect(mockFetchFn).toHaveBeenCalledWith(
        '/api/notifications/new-post',
        expect.anything()
      )
    })
    const body = JSON.parse(mockFetchFn.mock.calls[0][1].body)
    expect(body.id).toBe('new-post-id')
    expect(body.title).toBe('Fresh Post')
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Objava je bila objavljena')
    })
    expect(toast.warning).not.toHaveBeenCalled()
    expect(mockRouterPush).toHaveBeenCalledWith('/feed')
  })

  it('shows warning toast on hard email error (route 500), still navigates', async () => {
    const { toast } = await import('sonner')
    mockCreatePost.mockResolvedValue('new-post-id')
    stubFetch({ ok: false, body: { error: 'Failed to send notification' } })

    await createPublishedPost()

    await waitFor(() => {
      expect(toast.warning).toHaveBeenCalledWith(
        'Objava je bila objavljena, vendar e-poštna obvestila niso bila poslana.'
      )
    })
    expect(toast.success).not.toHaveBeenCalled()
    expect(mockRouterPush).toHaveBeenCalledWith('/feed')
  })

  it('shows warning toast on partial-fail (failed > 0)', async () => {
    const { toast } = await import('sonner')
    mockCreatePost.mockResolvedValue('new-post-id')
    stubFetch({ ok: true, body: { sent: 1, failed: 2 } })

    await createPublishedPost()

    await waitFor(() => {
      expect(toast.warning).toHaveBeenCalledOnce()
    })
    expect(toast.success).not.toHaveBeenCalled()
    expect(mockRouterPush).toHaveBeenCalledWith('/feed')
  })

  it('does NOT send notification for a scheduled new post', async () => {
    const { toast } = await import('sonner')
    const user = userEvent.setup()
    mockCreatePost.mockResolvedValue('sched-post-id')
    const mockFetchFn = stubFetch({ ok: true, body: { sent: 0, failed: 0 } })

    render(<PostForm mode="create" />)
    await user.type(screen.getByLabelText(/naslov/i), 'Scheduled Post')
    await waitFor(() =>
      expect(screen.getByLabelText(/kategorija/i)).not.toBeDisabled()
    )
    await user.selectOptions(screen.getByLabelText(/kategorija/i), 'insight')
    await user.click(screen.getByTestId('add-media-btn'))
    const { scheduleButton } = getPublishModeButtons()
    await user.click(scheduleButton)
    const datetimeInput = getDatetimeInput()
    await user.clear(datetimeInput)
    await user.type(datetimeInput, '2027-06-15T14:30')
    await user.click(getSubmitButton())

    await waitFor(() => {
      expect(mockCreatePost).toHaveBeenCalledOnce()
    })
    expect(mockFetchFn).not.toHaveBeenCalled()
    expect(toast.success).toHaveBeenCalledWith('Objava je bila objavljena')
  })

  it('sends notification on draft → published edit', async () => {
    const { toast } = await import('sonner')
    const user = userEvent.setup()
    mockUpdatePost.mockResolvedValue({ published: true })
    const mockFetchFn = stubFetch({ ok: true, body: { sent: 2, failed: 0 } })

    render(
      <PostForm
        mode="edit"
        initialData={{
          id: 'draft-post-1',
          title: 'Draft Post',
          category: 'stories',
          status: 'draft',
          post_media: [],
        }}
      />
    )
    await waitFor(() =>
      expect(screen.getByLabelText(/kategorija/i)).not.toBeDisabled()
    )
    await user.click(getSubmitButton())

    await waitFor(() => {
      expect(mockUpdatePost).toHaveBeenCalledOnce()
    })
    await waitFor(() => {
      expect(mockFetchFn).toHaveBeenCalledWith(
        '/api/notifications/new-post',
        expect.anything()
      )
    })
    expect(toast.success).toHaveBeenCalledWith('Objava je bila objavljena')
    expect(mockRouterPush).toHaveBeenCalledWith('/feed')
  })

  it('does NOT notify when updatePost reports no publish (stale draft / race)', async () => {
    const { toast } = await import('sonner')
    const user = userEvent.setup()
    // Форма открыта как draft, но сервер уже опубликовал пост → updatePost
    // возвращает { published: false }. Рассылка должна опираться на этот факт,
    // а не на initialData.status, иначе будет повторное письмо.
    mockUpdatePost.mockResolvedValue({ published: false })
    const mockFetchFn = stubFetch({ ok: true, body: { sent: 1, failed: 0 } })

    render(
      <PostForm
        mode="edit"
        initialData={{
          id: 'draft-post-stale',
          title: 'Draft Post',
          category: 'stories',
          status: 'draft',
          post_media: [],
        }}
      />
    )
    await waitFor(() =>
      expect(screen.getByLabelText(/kategorija/i)).not.toBeDisabled()
    )
    await user.click(getSubmitButton())

    await waitFor(() => {
      expect(mockUpdatePost).toHaveBeenCalledOnce()
    })
    expect(mockFetchFn).not.toHaveBeenCalled()
    expect(toast.success).toHaveBeenCalledWith('Objava je bila posodobljena')
  })

  it('regression: scheduled → published goes through /api/posts/publish, not notifications', async () => {
    const user = userEvent.setup()
    mockUpdatePost.mockResolvedValue({ published: false })
    const mockFetchFn = stubFetch({
      ok: true,
      body: { published: true, emailError: null, emailFailed: 0 },
    })

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
      expect(mockFetchFn).toHaveBeenCalledWith(
        '/api/posts/publish',
        expect.anything()
      )
    })
    const calledUrls = mockFetchFn.mock.calls.map((call) => call[0])
    expect(calledUrls).not.toContain('/api/notifications/new-post')
  })

  it('regression: published → published edit does not send notification', async () => {
    const { toast } = await import('sonner')
    const user = userEvent.setup()
    mockUpdatePost.mockResolvedValue({ published: false })
    const mockFetchFn = stubFetch({ ok: true, body: {} })

    render(
      <PostForm
        mode="edit"
        initialData={{
          id: 'pub-post-1',
          title: 'Published Post',
          category: 'stories',
          status: 'published',
          published_at: '2026-06-01T10:00:00.000Z',
          post_media: [],
        }}
      />
    )
    await waitFor(() =>
      expect(screen.getByLabelText(/kategorija/i)).not.toBeDisabled()
    )
    await user.click(getSubmitButton())

    await waitFor(() => {
      expect(mockUpdatePost).toHaveBeenCalledOnce()
    })
    expect(mockFetchFn).not.toHaveBeenCalled()
    expect(toast.success).toHaveBeenCalledWith('Objava je bila posodobljena')
  })
})
