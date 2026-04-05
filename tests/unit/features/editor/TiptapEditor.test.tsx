import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockUseEditor = vi.fn()

vi.mock('@tiptap/react', () => ({
  EditorContent: ({ className }: { className?: string }) => (
    <div data-testid="editor-content" className={className} />
  ),
  useEditor: (...args: unknown[]) => mockUseEditor(...args),
}))

vi.mock('@tiptap/starter-kit', () => ({
  default: {
    configure: () => ({ name: 'starter-kit' }),
  },
}))

vi.mock('@tiptap/extension-heading', () => ({
  default: {
    configure: () => ({ name: 'heading' }),
  },
}))

vi.mock('@tiptap/extension-placeholder', () => ({
  default: {
    configure: () => ({ name: 'placeholder' }),
  },
}))

vi.mock('@/features/editor/extensions/ImageUpload', () => ({
  ImageUpload: { name: 'image-upload' },
  createUploadPlaceholder: vi.fn(),
  removePlaceholderImage: vi.fn(),
  replacePlaceholderImage: vi.fn(),
}))

import { TiptapEditor } from '@/features/editor/components/TiptapEditor'

function createEditorMock(overrides?: {
  isImageSelected?: boolean
  activeImageAlign?: 'left' | 'center' | 'right'
}) {
  const run = vi.fn().mockReturnValue(true)
  const updateAttributes = vi.fn().mockReturnValue({ run })
  const deleteSelection = vi.fn().mockReturnValue({ run })
  const toggleHeading = vi.fn().mockReturnValue({ run })
  const toggleBulletList = vi.fn().mockReturnValue({ run })
  const toggleOrderedList = vi.fn().mockReturnValue({ run })
  const toggleBlockquote = vi.fn().mockReturnValue({ run })
  const toggleCodeBlock = vi.fn().mockReturnValue({ run })
  const setTextSelection = vi.fn().mockReturnValue({ run })
  const focus = vi.fn().mockReturnValue({
    updateAttributes,
    deleteSelection,
    toggleHeading,
    toggleBulletList,
    toggleOrderedList,
    toggleBlockquote,
    toggleCodeBlock,
    setTextSelection,
    run,
  })
  const chain = vi.fn().mockReturnValue({
    focus,
    updateAttributes,
    deleteSelection,
    toggleHeading,
    toggleBulletList,
    toggleOrderedList,
    toggleBlockquote,
    toggleCodeBlock,
    setTextSelection,
    run,
  })

  return {
    getHTML: vi.fn().mockReturnValue('<p>Body</p>'),
    getJSON: vi.fn().mockReturnValue({ type: 'doc', content: [] }),
    getAttributes: vi.fn().mockReturnValue({
      caption: '',
      align: overrides?.activeImageAlign ?? 'center',
    }),
    isActive: vi.fn((name: string) =>
      name === 'image' ? Boolean(overrides?.isImageSelected) : false
    ),
    chain,
    commands: {
      setContent: vi.fn(),
    },
    setEditable: vi.fn(),
    __mocks: {
      deleteSelection,
      updateAttributes,
      toggleHeading,
      run,
    },
  }
}

describe('TiptapEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders outer editor group with aria-label', () => {
    mockUseEditor.mockReturnValue(createEditorMock())

    render(
      <TiptapEditor
        value={{ html: '<p>Body</p>', json: { type: 'doc', content: [] }, inline_images_count: 0 }}
        onChange={vi.fn()}
        onInlineImageUpload={vi.fn()}
        onUploadError={vi.fn()}
      />
    )

    expect(
      screen.getByRole('group', { name: /vsebina objave/i })
    ).toBeInTheDocument()
  })

  it('prevents default on toolbar mouse down to preserve editor selection', () => {
    mockUseEditor.mockReturnValue(createEditorMock())

    render(
      <TiptapEditor
        value={{ html: '<p>Body</p>', json: { type: 'doc', content: [] }, inline_images_count: 0 }}
        onChange={vi.fn()}
        onInlineImageUpload={vi.fn()}
        onUploadError={vi.fn()}
      />
    )

    const headingButton = screen.getByRole('button', { name: 'H2' })
    const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true })
    fireEvent(headingButton, event)

    expect(event.defaultPrevented).toBe(true)
  })

  it('does not delete selection when no image block is selected', async () => {
    const user = userEvent.setup()
    const editor = createEditorMock({ isImageSelected: false })
    mockUseEditor.mockReturnValue(editor)

    render(
      <TiptapEditor
        value={{ html: '<p>Body</p>', json: { type: 'doc', content: [] }, inline_images_count: 0 }}
        onChange={vi.fn()}
        onInlineImageUpload={vi.fn()}
        onUploadError={vi.fn()}
      />
    )

    expect(
      screen.queryByRole('button', { name: /odstrani blok/i })
    ).not.toBeInTheDocument()
    expect(editor.__mocks.deleteSelection).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: /dodaj sliko/i }))

    expect(editor.__mocks.deleteSelection).not.toHaveBeenCalled()
  })
})
