import { describe, expect, it, vi } from 'vitest'

vi.mock('@tiptap/extension-image', () => ({
  default: {
    extend: (config: unknown) => config,
  },
}))

import {
  createUploadPlaceholder,
  removePlaceholderImage,
  replacePlaceholderImage,
} from '@/features/editor/extensions/ImageUpload'

function createEditorMock() {
  const run = vi.fn().mockReturnValue(true)
  const insertContent = vi.fn().mockReturnValue({ run })
  const deleteSelection = vi.fn().mockReturnValue({ run })
  const updateAttributes = vi.fn().mockReturnValue({ run })
  const setNodeSelection = vi.fn().mockReturnValue({
    updateAttributes,
    deleteSelection,
    run,
  })
  const focus = vi.fn().mockReturnValue({
    insertContent,
    setNodeSelection,
    updateAttributes,
    deleteSelection,
    run,
  })
  const chain = vi.fn().mockReturnValue({
    focus,
    insertContent,
    setNodeSelection,
    updateAttributes,
    deleteSelection,
    run,
  })

  return {
    chain,
    state: {
      doc: {
        descendants: vi.fn(),
      },
    },
    __mocks: {
      run,
      insertContent,
      deleteSelection,
      updateAttributes,
      setNodeSelection,
      focus,
    },
  }
}

describe('ImageUpload helpers', () => {
  it('creates upload placeholder image block', () => {
    const editor = createEditorMock()

    createUploadPlaceholder(editor as never, 'upload-1', 'blob:preview')

    expect(editor.__mocks.insertContent).toHaveBeenCalledWith({
      type: 'image',
      attrs: expect.objectContaining({
        src: 'blob:preview',
        uploadId: 'upload-1',
        uploadStatus: 'uploading',
        storageBucket: 'inline-images',
      }),
    })
  })

  it('replaces placeholder image attrs when node is found', () => {
    const editor = createEditorMock()
    editor.state.doc.descendants.mockImplementation(
      (callback: (node: { type: { name: string }; attrs: { uploadId: string } }, pos: number) => boolean) => {
        callback(
          {
            type: { name: 'image' },
            attrs: { uploadId: 'upload-1' },
          },
          7
        )
      }
    )

    const result = replacePlaceholderImage(editor as never, 'upload-1', {
      src: 'https://cdn.example.com/image.jpg',
      caption: 'Opis',
      align: 'left',
      storageBucket: 'inline-images',
    })

    expect(result).toBe(true)
    expect(editor.__mocks.setNodeSelection).toHaveBeenCalledWith(7)
    expect(editor.__mocks.updateAttributes).toHaveBeenCalledWith(
      'image',
      expect.objectContaining({
        src: 'https://cdn.example.com/image.jpg',
        caption: 'Opis',
        align: 'left',
        uploadId: null,
        uploadStatus: 'ready',
      })
    )
  })

  it('returns false when placeholder image is missing during replace', () => {
    const editor = createEditorMock()
    editor.state.doc.descendants.mockImplementation(() => {})

    expect(
      replacePlaceholderImage(editor as never, 'missing-upload', {
        src: 'https://cdn.example.com/image.jpg',
      })
    ).toBe(false)
  })

  it('removes placeholder image when node is found', () => {
    const editor = createEditorMock()
    editor.state.doc.descendants.mockImplementation(
      (callback: (node: { type: { name: string }; attrs: { uploadId: string } }, pos: number) => boolean) => {
        callback(
          {
            type: { name: 'image' },
            attrs: { uploadId: 'upload-2' },
          },
          9
        )
      }
    )

    const result = removePlaceholderImage(editor as never, 'upload-2')

    expect(result).toBe(true)
    expect(editor.__mocks.setNodeSelection).toHaveBeenCalledWith(9)
    expect(editor.__mocks.deleteSelection).toHaveBeenCalled()
  })

  it('returns false when placeholder image is missing during remove', () => {
    const editor = createEditorMock()
    editor.state.doc.descendants.mockImplementation(() => {})

    expect(removePlaceholderImage(editor as never, 'missing-upload')).toBe(false)
  })
})
