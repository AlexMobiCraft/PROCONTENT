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
      },
      align: {
        default: 'center',
      },
      uploadId: {
        default: null,
      },
      uploadStatus: {
        default: 'ready',
      },
      storageBucket: {
        default: null,
      },
    }
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
