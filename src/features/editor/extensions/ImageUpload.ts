import { mergeAttributes } from '@tiptap/core'
import Image from '@tiptap/extension-image'
import type { Editor } from '@tiptap/react'
import type { EditorImageAlignment } from '@/features/admin/types'

export type UploadImageAttrs = {
  src: string
  alt?: string
  caption?: string
  align?: EditorImageAlignment
  uploadId?: string | null
  uploadStatus?: 'uploading' | 'ready'
  storageBucket?: 'inline-images' | null
}

export const ImageUpload = Image.extend({
  name: 'image',

  addAttributes() {
    return {
      ...this.parent?.(),
      caption: {
        default: '',
        parseHTML: (element) => {
          const figcaption = element.querySelector('figcaption')
          return figcaption?.textContent ?? ''
        },
      },
      align: {
        default: 'center',
        parseHTML: (element) => element.getAttribute('data-align') ?? 'center',
      },
      uploadId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-upload-id'),
      },
      uploadStatus: {
        default: 'ready',
        parseHTML: (element) => element.getAttribute('data-upload-status') ?? 'ready',
      },
      storageBucket: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-storage-bucket'),
      },
    }
  },

  addParseRules() {
    return [
      {
        tag: 'figure[data-type="inline-image"]',
        getAttrs: (node: HTMLElement | string) => {
          if (!(node instanceof HTMLElement)) return false
          const img = node.querySelector('img')
          if (!img) return false
          return {
            src: img.getAttribute('src'),
            alt: img.getAttribute('alt') ?? '',
            title: img.getAttribute('title') ?? null,
            caption: node.querySelector('figcaption')?.textContent ?? '',
            align: node.getAttribute('data-align') ?? 'center',
            uploadId: node.getAttribute('data-upload-id'),
            uploadStatus: node.getAttribute('data-upload-status') ?? 'ready',
            storageBucket: node.getAttribute('data-storage-bucket'),
          }
        },
        node: 'image',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    const { caption, align, uploadId, uploadStatus, storageBucket, ...imageAttrs } = HTMLAttributes

    return [
      'figure',
      {
        'data-type': 'inline-image',
        'data-align': align,
        'data-upload-id': uploadId,
        'data-upload-status': uploadStatus,
        'data-storage-bucket': storageBucket,
        class: `editor-inline-image editor-inline-image--${align}`,
      },
      ['img', mergeAttributes(this.options.HTMLAttributes, imageAttrs)],
      ...(caption ? [['figcaption', {}, caption]] : []),
    ]
  },
})

export function createUploadPlaceholder(editor: Editor, uploadId: string, previewUrl: string) {
  return editor
    .chain()
    .focus()
    .insertContent({
      type: 'image',
      attrs: {
        src: previewUrl,
        alt: 'Nalaganje slike',
        uploadId,
        uploadStatus: 'uploading',
        storageBucket: 'inline-images',
      },
    })
    .run()
}

export function replacePlaceholderImage(
  editor: Editor,
  uploadId: string,
  attrs: UploadImageAttrs
) {
  const { state } = editor
  let targetPos: number | null = null

  state.doc.descendants((node, pos) => {
    if (node.type.name === 'image' && node.attrs.uploadId === uploadId) {
      targetPos = pos
      return false
    }

    return true
  })

  if (targetPos === null) {
    return false
  }

  return editor
    .chain()
    .focus()
    .setNodeSelection(targetPos)
    .updateAttributes('image', {
      ...attrs,
      uploadId: null,
      uploadStatus: 'ready',
    })
    .run()
}

export function removePlaceholderImage(editor: Editor, uploadId: string) {
  const { state } = editor
  let targetPos: number | null = null

  state.doc.descendants((node, pos) => {
    if (node.type.name === 'image' && node.attrs.uploadId === uploadId) {
      targetPos = pos
      return false
    }

    return true
  })

  if (targetPos === null) {
    return false
  }

  return editor.chain().focus().setNodeSelection(targetPos).deleteSelection().run()
}
