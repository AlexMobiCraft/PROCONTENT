import { act, fireEvent, render, screen } from '@testing-library/react'
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
  activeLineHeight?: string | null
  activeMarks?: string[]
}) {
  const listeners = new Map<string, Set<() => void>>()
  const run = vi.fn().mockReturnValue(true)
  const updateAttributes = vi.fn().mockReturnValue({ run })
  const deleteSelection = vi.fn().mockReturnValue({ run })
  const toggleHeading = vi.fn().mockReturnValue({ run })
  const toggleBold = vi.fn().mockReturnValue({ run })
  const toggleItalic = vi.fn().mockReturnValue({ run })
  const toggleUnderline = vi.fn().mockReturnValue({ run })
  const toggleStrike = vi.fn().mockReturnValue({ run })
  const toggleBulletList = vi.fn().mockReturnValue({ run })
  const toggleOrderedList = vi.fn().mockReturnValue({ run })
  const toggleBlockquote = vi.fn().mockReturnValue({ run })
  const toggleCodeBlock = vi.fn().mockReturnValue({ run })
  const setTextSelection = vi.fn().mockReturnValue({ run })
  const setLineHeight = vi.fn().mockReturnValue({ run })
  const unsetLineHeight = vi.fn().mockReturnValue({ run })
  const focus = vi.fn().mockReturnValue({
    updateAttributes,
    deleteSelection,
    toggleHeading,
    toggleBold,
    toggleItalic,
    toggleUnderline,
    toggleStrike,
    toggleBulletList,
    toggleOrderedList,
    toggleBlockquote,
    toggleCodeBlock,
    setTextSelection,
    setLineHeight,
    unsetLineHeight,
    run,
  })
  const chain = vi.fn().mockReturnValue({
    focus,
    updateAttributes,
    deleteSelection,
    toggleHeading,
    toggleBold,
    toggleItalic,
    toggleUnderline,
    toggleStrike,
    toggleBulletList,
    toggleOrderedList,
    toggleBlockquote,
    toggleCodeBlock,
    setTextSelection,
    setLineHeight,
    unsetLineHeight,
    run,
  })

  return {
    getHTML: vi.fn().mockReturnValue('<p>Body</p>'),
    getJSON: vi.fn().mockReturnValue({ type: 'doc', content: [] }),
    getAttributes: vi.fn((name: string) => {
      if (name === 'image') {
        return {
          caption: '',
          align: overrides?.activeImageAlign ?? 'center',
        }
      }

      if (name === 'paragraph' || name === 'heading') {
        return {
          lineHeight: overrides?.activeLineHeight ?? null,
        }
      }

      return {}
    }),
    isActive: vi.fn((name: string) => {
      if (name === 'image') {
        return Boolean(overrides?.isImageSelected)
      }

      return overrides?.activeMarks?.includes(name) ?? false
    }),
    chain,
    on: vi.fn((event: string, callback: () => void) => {
      const callbacks = listeners.get(event) ?? new Set<() => void>()
      callbacks.add(callback)
      listeners.set(event, callbacks)
    }),
    off: vi.fn((event: string, callback: () => void) => {
      listeners.get(event)?.delete(callback)
    }),
    commands: {
      setContent: vi.fn(),
    },
    setEditable: vi.fn(),
    __mocks: {
      deleteSelection,
      updateAttributes,
      toggleHeading,
      toggleBold,
      toggleItalic,
      toggleUnderline,
      toggleStrike,
      setLineHeight,
      unsetLineHeight,
      run,
      emit: (event: string) => {
        listeners.get(event)?.forEach((callback) => callback())
      },
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

  it('applies rich-content class to editor surface', () => {
    mockUseEditor.mockReturnValue(createEditorMock())

    render(
      <TiptapEditor
        value={{ html: '<p>Body</p>', json: { type: 'doc', content: [] }, inline_images_count: 0 }}
        onChange={vi.fn()}
        onInlineImageUpload={vi.fn()}
        onUploadError={vi.fn()}
      />
    )

    expect(screen.getByTestId('editor-content')).toHaveClass('rich-content')
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

  it('applies inline formatting actions from the toolbar', async () => {
    const user = userEvent.setup()
    const editor = createEditorMock()
    mockUseEditor.mockReturnValue(editor)

    render(
      <TiptapEditor
        value={{ html: '<p>Body</p>', json: { type: 'doc', content: [] }, inline_images_count: 0 }}
        onChange={vi.fn()}
        onInlineImageUpload={vi.fn()}
        onUploadError={vi.fn()}
      />
    )

    await user.click(screen.getByRole('button', { name: /krepko besedilo/i }))
    await user.click(screen.getByRole('button', { name: /ležeče besedilo/i }))
    await user.click(screen.getByRole('button', { name: /podčrtano besedilo/i }))
    await user.click(screen.getByRole('button', { name: /prečrtano besedilo/i }))

    expect(editor.__mocks.toggleBold).toHaveBeenCalled()
    expect(editor.__mocks.toggleItalic).toHaveBeenCalled()
    expect(editor.__mocks.toggleUnderline).toHaveBeenCalled()
    expect(editor.__mocks.toggleStrike).toHaveBeenCalled()
  })

  it('toggles relaxed line spacing from the toolbar', async () => {
    const user = userEvent.setup()
    const editor = createEditorMock()
    mockUseEditor.mockReturnValue(editor)

    render(
      <TiptapEditor
        value={{ html: '<p>Body</p>', json: { type: 'doc', content: [] }, inline_images_count: 0 }}
        onChange={vi.fn()}
        onInlineImageUpload={vi.fn()}
        onUploadError={vi.fn()}
      />
    )

    await user.click(
      screen.getByRole('button', { name: /večji razmik med vrsticami/i })
    )

    expect(editor.__mocks.setLineHeight).toHaveBeenCalledWith('2.35')
    expect(editor.__mocks.unsetLineHeight).not.toHaveBeenCalled()
  })

  it('removes relaxed line spacing when it is already active', async () => {
    const user = userEvent.setup()
    const editor = createEditorMock({ activeLineHeight: '2.35' })
    mockUseEditor.mockReturnValue(editor)

    render(
      <TiptapEditor
        value={{ html: '<p>Body</p>', json: { type: 'doc', content: [] }, inline_images_count: 0 }}
        onChange={vi.fn()}
        onInlineImageUpload={vi.fn()}
        onUploadError={vi.fn()}
      />
    )

    await user.click(
      screen.getByRole('button', { name: /večji razmik med vrsticami/i })
    )

    expect(editor.__mocks.unsetLineHeight).toHaveBeenCalled()
    expect(editor.__mocks.setLineHeight).not.toHaveBeenCalled()
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

  it('shows image settings when image selection changes without content update', () => {
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
      screen.queryByText(/nastavitve slike/i)
    ).not.toBeInTheDocument()

    editor.isActive.mockImplementation((name: string) => name === 'image')
    editor.getAttributes.mockImplementation((name: string) => {
      if (name === 'image') {
        return {
          src: 'https://cdn.example.com/image.jpg',
          alt: 'Opis',
          caption: 'Podnapis',
          align: 'center',
        }
      }

      return {}
    })

    act(() => {
      editor.__mocks.emit('selectionUpdate')
    })

    expect(screen.getByText(/nastavitve slike/i)).toBeInTheDocument()
    expect(
      screen.queryByDisplayValue('Podnapis')
    ).not.toBeInTheDocument()
  })
})
