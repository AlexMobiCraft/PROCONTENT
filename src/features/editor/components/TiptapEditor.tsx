'use client'

import { useEffect, useRef } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Heading from '@tiptap/extension-heading'
import Placeholder from '@tiptap/extension-placeholder'
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Italic,
  ImagePlus,
  List,
  ListOrdered,
  Quote,
  Code2,
  Strikethrough,
  Trash2,
  Replace,
  Underline as UnderlineIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { EditorContentValue, EditorImageAlignment } from '@/features/admin/types'
import {
  createEmptyEditorContent,
  normalizeEditorContent,
} from '@/features/admin/types'
import {
  createUploadPlaceholder,
  ImageUpload,
  removePlaceholderImage,
  replacePlaceholderImage,
} from '@/features/editor/extensions/ImageUpload'
import {
  LineHeight,
  RELAXED_LINE_HEIGHT,
} from '@/features/editor/extensions/LineHeight'
import { Underline } from '@/features/editor/extensions/Underline'
import type { UploadedInlineImage } from '@/features/editor/lib/uploadInlineImage'

interface TiptapEditorProps {
  value: EditorContentValue
  onChange: (value: EditorContentValue) => void
  onInlineImageUpload: (file: File) => Promise<UploadedInlineImage>
  onUploadError: (message: string) => void
  disabled?: boolean
}

function createUploadId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `upload-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function countInlineImagesFromHtml(html: string) {
  return (html.match(/<img\b/gi) ?? []).length
}

function getUploadErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Pri nalaganju slike je prišlo do napake'
}

export function TiptapEditor({
  value,
  onChange,
  onInlineImageUpload,
  onUploadError,
  disabled = false,
}: TiptapEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const replaceInputRef = useRef<HTMLInputElement>(null)
  const replaceTargetUploadIdRef = useRef<string | null>(null)

  const editor = useEditor({
    immediatelyRender: false,
    editable: !disabled,
    extensions: [
      StarterKit.configure({
        heading: false,
      }),
      Heading.configure({
        levels: [2, 3, 4],
      }),
      Placeholder.configure({
        placeholder: 'Vnesite vsebino objave',
      }),
      Underline,
      LineHeight,
      ImageUpload,
    ],
    content: value.html || '<p></p>',
    editorProps: {
      attributes: {
        'aria-label': 'Vsebina objave',
        class:
          'rich-content min-h-[240px] rounded-lg border border-input bg-muted/30 px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring',
      },
      handlePaste: (_view, event) => {
        const files = Array.from(event.clipboardData?.files ?? []).filter((file) =>
          file.type.startsWith('image/')
        )

        if (files.length === 0) return false

        void handleFiles(files)
        return true
      },
      handleDrop: (view, event) => {
        const files = Array.from(event.dataTransfer?.files ?? []).filter((file) =>
          file.type.startsWith('image/')
        )

        if (files.length === 0) return false

        const coords = view.posAtCoords({
          left: event.clientX,
          top: event.clientY,
        })

        if (coords) {
          editor?.chain().focus().setTextSelection(coords.pos).run()
        }

        void handleFiles(files)
        return true
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      const html = currentEditor.getHTML()
      onChange({
        html: html === '<p></p>' ? '' : html,
        json: currentEditor.getJSON(),
        inline_images_count: countInlineImagesFromHtml(html),
      })
    },
  })

  useEffect(() => {
    if (!editor) return

    const currentHtml = editor.getHTML()
    const nextHtml = value.html || '<p></p>'

    if (currentHtml !== nextHtml) {
      editor.commands.setContent(nextHtml, { emitUpdate: false })
    }
  }, [editor, value.html])

  useEffect(() => {
    if (!editor) return
    editor.setEditable(!disabled)
  }, [disabled, editor])

  async function handleFiles(files: File[]) {
    if (!editor) return

    for (const file of files) {
      const previewUrl = URL.createObjectURL(file)
      const uploadId = createUploadId()

      createUploadPlaceholder(editor, uploadId, previewUrl)

      try {
        const uploaded = await onInlineImageUpload(file)
        replacePlaceholderImage(editor, uploadId, {
          src: uploaded.url,
          alt: file.name,
          storageBucket: uploaded.storage_bucket,
        })
      } catch (error) {
        removePlaceholderImage(editor, uploadId)
        onUploadError(getUploadErrorMessage(error))
      } finally {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }

  function triggerImageUpload() {
    fileInputRef.current?.click()
  }

  function triggerReplaceImage() {
    if (!editor || !editor.isActive('image')) return
    const attrs = editor.getAttributes('image')
    replaceTargetUploadIdRef.current = attrs.uploadId ?? null
    replaceInputRef.current?.click()
  }

  function setImageAlignment(align: EditorImageAlignment) {
    if (!editor) return
    editor.chain().focus().updateAttributes('image', { align }).run()
  }

  function removeSelectedImage() {
    if (!editor || !editor.isActive('image')) return
    editor.chain().focus().deleteSelection().run()
  }

  function updateCaption(caption: string) {
    if (!editor) return
    editor.chain().focus().updateAttributes('image', { caption }).run()
  }

  function keepSelection(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault()
  }

  function isRelaxedSpacingActive() {
    if (!editor) return false

    const paragraphAttrs = editor.getAttributes('paragraph') as {
      lineHeight?: string | null
    }
    const headingAttrs = editor.getAttributes('heading') as {
      lineHeight?: string | null
    }

    return (
      paragraphAttrs.lineHeight === RELAXED_LINE_HEIGHT ||
      headingAttrs.lineHeight === RELAXED_LINE_HEIGHT
    )
  }

  function toggleLineSpacing() {
    if (!editor) return

    const chain = editor.chain().focus()

    if (isRelaxedSpacingActive()) {
      chain.unsetLineHeight().run()
      return
    }

    chain.setLineHeight(RELAXED_LINE_HEIGHT).run()
  }

  if (!editor) {
    const normalized = value.html ? value : normalizeEditorContent(value.html)
    const fallback = normalized.html ? normalized.html : createEmptyEditorContent().html

    return (
      <div className="flex min-h-[240px] items-center rounded-lg border border-input bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        {fallback || 'Nalaganje urejevalnika...'}
      </div>
    )
  }

  const activeImageAttrs = editor.getAttributes('image') as {
    src?: string
    alt?: string
    caption?: string
    align?: EditorImageAlignment
  }
  const isImageSelected = editor.isActive('image')
  const isRelaxedSpacing = isRelaxedSpacingActive()

  return (
    <div className="flex flex-col gap-3" role="group" aria-label="Vsebina objave">
      <div className="flex flex-wrap gap-2 rounded-lg border border-border p-3">
        <Button
          type="button"
          size="icon-xs"
          variant={editor.isActive('bold') ? 'secondary' : 'outline'}
          onMouseDown={keepSelection}
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={disabled}
          aria-label="Krepko besedilo"
        >
          <Bold className="size-4" />
        </Button>
        <Button
          type="button"
          size="icon-xs"
          variant={editor.isActive('italic') ? 'secondary' : 'outline'}
          onMouseDown={keepSelection}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          disabled={disabled}
          aria-label="Ležeče besedilo"
        >
          <Italic className="size-4" />
        </Button>
        <Button
          type="button"
          size="icon-xs"
          variant={editor.isActive('underline') ? 'secondary' : 'outline'}
          onMouseDown={keepSelection}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          disabled={disabled}
          aria-label="Podčrtano besedilo"
        >
          <UnderlineIcon className="size-4" />
        </Button>
        <Button
          type="button"
          size="icon-xs"
          variant={editor.isActive('strike') ? 'secondary' : 'outline'}
          onMouseDown={keepSelection}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          disabled={disabled}
          aria-label="Prečrtano besedilo"
        >
          <Strikethrough className="size-4" />
        </Button>
        <Button
          type="button"
          size="xs"
          variant={isRelaxedSpacing ? 'secondary' : 'outline'}
          onMouseDown={keepSelection}
          onClick={toggleLineSpacing}
          disabled={disabled}
          aria-label="Večji razmik med vrsticami"
        >
          Razmik
        </Button>
        <Button
          type="button"
          size="xs"
          variant={editor.isActive('heading', { level: 2 }) ? 'secondary' : 'outline'}
          onMouseDown={keepSelection}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          disabled={disabled}
        >
          H2
        </Button>
        <Button
          type="button"
          size="xs"
          variant={editor.isActive('heading', { level: 3 }) ? 'secondary' : 'outline'}
          onMouseDown={keepSelection}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          disabled={disabled}
        >
          H3
        </Button>
        <Button
          type="button"
          size="xs"
          variant={editor.isActive('heading', { level: 4 }) ? 'secondary' : 'outline'}
          onMouseDown={keepSelection}
          onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
          disabled={disabled}
        >
          H4
        </Button>
        <Button
          type="button"
          size="icon-xs"
          variant={editor.isActive('bulletList') ? 'secondary' : 'outline'}
          onMouseDown={keepSelection}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          disabled={disabled}
          aria-label="Seznam z oznakami"
        >
          <List className="size-4" />
        </Button>
        <Button
          type="button"
          size="icon-xs"
          variant={editor.isActive('orderedList') ? 'secondary' : 'outline'}
          onMouseDown={keepSelection}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          disabled={disabled}
          aria-label="Oštevilčen seznam"
        >
          <ListOrdered className="size-4" />
        </Button>
        <Button
          type="button"
          size="icon-xs"
          variant={editor.isActive('blockquote') ? 'secondary' : 'outline'}
          onMouseDown={keepSelection}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          disabled={disabled}
          aria-label="Citat"
        >
          <Quote className="size-4" />
        </Button>
        <Button
          type="button"
          size="icon-xs"
          variant={editor.isActive('codeBlock') ? 'secondary' : 'outline'}
          onMouseDown={keepSelection}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          disabled={disabled}
          aria-label="Kodni blok"
        >
          <Code2 className="size-4" />
        </Button>
        <Button
          type="button"
          size="icon-xs"
          variant="outline"
          onMouseDown={keepSelection}
          onClick={triggerImageUpload}
          disabled={disabled}
          aria-label="Dodaj sliko"
        >
          <ImagePlus className="size-4" />
        </Button>
      </div>

      <EditorContent
        editor={editor}
        className={cn(
          'rich-content',
          '[&_figure[data-type="inline-image"]]:my-4 [&_figure[data-type="inline-image"]]:space-y-2 [&_figure[data-type="inline-image"]_img]:rounded-lg [&_figure[data-type="inline-image"]_img]:border [&_figure[data-type="inline-image"]_img]:border-border',
          '[&_figure[data-align="left"]]:mr-auto [&_figure[data-align="center"]]:mx-auto [&_figure[data-align="right"]]:ml-auto'
        )}
      />

      {isImageSelected && (
        <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
          <div className="flex items-center gap-3">
            {activeImageAttrs.src && (
              <img
                src={activeImageAttrs.src}
                alt={activeImageAttrs.alt ?? 'Izbrana slika'}
                className="size-12 shrink-0 rounded border border-border object-cover"
              />
            )}
            <span className="text-xs font-medium text-muted-foreground">
              Nastavitve slike
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="icon-xs"
              variant={activeImageAttrs.align === 'left' ? 'secondary' : 'outline'}
              onMouseDown={keepSelection}
              onClick={() => setImageAlignment('left')}
              aria-label="Poravnaj sliko levo"
            >
              <AlignLeft className="size-4" />
            </Button>
            <Button
              type="button"
              size="icon-xs"
              variant={activeImageAttrs.align === 'center' ? 'secondary' : 'outline'}
              onMouseDown={keepSelection}
              onClick={() => setImageAlignment('center')}
              aria-label="Poravnaj sliko sredinsko"
            >
              <AlignCenter className="size-4" />
            </Button>
            <Button
              type="button"
              size="icon-xs"
              variant={activeImageAttrs.align === 'right' ? 'secondary' : 'outline'}
              onMouseDown={keepSelection}
              onClick={() => setImageAlignment('right')}
              aria-label="Poravnaj sliko desno"
            >
              <AlignRight className="size-4" />
            </Button>
            <Button
              type="button"
              size="xs"
              variant="outline"
              onMouseDown={keepSelection}
              onClick={triggerReplaceImage}
            >
              <Replace className="size-4" />
              Zamenjaj sliko
            </Button>
            <Button
              type="button"
              size="xs"
              variant="destructive"
              onMouseDown={keepSelection}
              onClick={removeSelectedImage}
            >
              <Trash2 className="size-4" />
              Odstrani blok
            </Button>
          </div>
          <div className="border-t border-border" />
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-xs font-medium text-muted-foreground">Podnapis slike</span>
            <input
              type="text"
              value={activeImageAttrs.caption ?? ''}
              onChange={(event) => updateCaption(event.target.value)}
              placeholder="Vnesite podnapis slike..."
              className="min-h-[44px] rounded-lg border border-input bg-muted/30 px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? [])
          event.target.value = ''
          if (files.length > 0) {
            void handleFiles(files)
          }
        }}
      />

      <input
        ref={replaceInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        onChange={async (event) => {
          const file = event.target.files?.[0]
          event.target.value = ''

          if (!file || !editor) return

          try {
            const uploaded = await onInlineImageUpload(file)
            editor
              .chain()
              .focus()
              .updateAttributes('image', {
                src: uploaded.url,
                alt: file.name,
                storageBucket: uploaded.storage_bucket,
              })
              .run()
          } catch (error) {
            onUploadError(getUploadErrorMessage(error))
          } finally {
            replaceTargetUploadIdRef.current = null
          }
        }}
      />
    </div>
  )
}
