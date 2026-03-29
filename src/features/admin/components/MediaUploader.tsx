'use client'

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  arrayMove,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { ImagePlus } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import type { MediaItem, MediaType, NewMediaItem } from '@/features/admin/types'
import {
  getMediaItemId,
  MAX_MEDIA_FILES,
  MAX_IMAGE_SIZE,
  MAX_VIDEO_SIZE,
  ALLOWED_IMAGE_TYPES,
  ALLOWED_MEDIA_TYPES,
} from '@/features/admin/types'
import { generateUUID } from '@/features/admin/api/uploadMedia'
import { MediaSortableItem } from './MediaSortableItem'

interface MediaUploaderProps {
  items: MediaItem[]
  onChange: (items: MediaItem[]) => void
  isSubmitting?: boolean
}

function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${(bytes / 1024).toFixed(0)} KB`
}

/** Map common file extensions to MIME types for browsers that return empty type */
const EXTENSION_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
}

/**
 * Resolves MIME type from browser-provided type, falling back to extension.
 * Extension fallback is client-side UX only — Supabase Storage validates server-side.
 */
function resolveFileType(file: File): string {
  if (file.type && ALLOWED_MEDIA_TYPES.includes(file.type)) return file.type
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  return EXTENSION_TO_MIME[ext] ?? ''
}

export function MediaUploader({ items, onChange, isSubmitting }: MediaUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const isAtLimit = items.length >= MAX_MEDIA_FILES
  const [fileError, setFileError] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = items.findIndex((m) => getMediaItemId(m) === active.id)
    const newIndex = items.findIndex((m) => getMediaItemId(m) === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove(items, oldIndex, newIndex).map((item, idx) => ({
      ...item,
      order_index: idx,
    }))
    // Clear stale error on successful reorder
    setFileError(null)
    onChange(reordered)
  }

  const processFiles = useCallback(
    (fileList: File[]) => {
      if (fileList.length === 0) return

      setFileError(null)
      const errors: string[] = []

      // Resolve MIME types (fallback to extension for empty type)
      const filesWithTypes = fileList.map((f) => ({ file: f, resolvedType: resolveFileType(f) }))

      // Filter by allowed MIME type
      const validTypeFiles = filesWithTypes.filter(({ file, resolvedType }) => {
        if (!ALLOWED_MEDIA_TYPES.includes(resolvedType)) {
          errors.push(`"${file.name}" — nepodprt format`)
          return false
        }
        return true
      })

      // Filter by file size
      const validFiles = validTypeFiles.filter(({ file, resolvedType }) => {
        const isImage = ALLOWED_IMAGE_TYPES.includes(resolvedType)
        const maxSize = isImage ? MAX_IMAGE_SIZE : MAX_VIDEO_SIZE
        if (file.size > maxSize) {
          errors.push(
            `"${file.name}" presega omejitev ${formatSize(maxSize)}`
          )
          return false
        }
        return true
      })

      const remaining = MAX_MEDIA_FILES - items.length
      if (remaining <= 0) {
        setFileError(`Dosežena je omejitev ${MAX_MEDIA_FILES} datotek`)
        return
      }

      const toAdd = validFiles.slice(0, remaining)
      if (validFiles.length > remaining) {
        errors.push(
          `${validFiles.length - remaining} datotek ni bilo dodanih — omejitev ${MAX_MEDIA_FILES}`
        )
      }

      if (errors.length > 0) {
        setFileError(errors.join('. '))
      }

      if (toAdd.length === 0) return

      const newItems: NewMediaItem[] = toAdd.map(({ file, resolvedType }, i) => {
        const mediaType: MediaType = ALLOWED_IMAGE_TYPES.includes(resolvedType) ? 'image' : 'video'
        return {
          kind: 'new',
          key: generateUUID(),
          file,
          preview_url: URL.createObjectURL(file),
          media_type: mediaType,
          is_cover: false,
          order_index: items.length + i,
        }
      })

      // Auto-assign first item as cover if none set
      const combined: MediaItem[] = [...items, ...newItems]
      const hasCover = combined.some((m) => m.is_cover)
      if (!hasCover && combined.length > 0) {
        combined[0] = { ...combined[0], is_cover: true }
      }

      onChange(combined)
      // Reset input so same file can be re-selected
      if (inputRef.current) inputRef.current.value = ''
    },
    [items, onChange]
  )

  function handleFilesSelected(files: FileList | null) {
    if (!files) return
    processFiles(Array.from(files))
  }

  function handleSetCover(targetId: string) {
    const updated = items.map((item) => ({
      ...item,
      is_cover: getMediaItemId(item) === targetId,
    }))
    onChange(updated)
  }

  function handleRemove(targetId: string) {
    const filtered = items
      .filter((item) => getMediaItemId(item) !== targetId)
      .map((item, idx) => ({ ...item, order_index: idx }))

    // Revoke object URL for new items immediately
    const removed = items.find((item) => getMediaItemId(item) === targetId)
    if (removed?.kind === 'new') URL.revokeObjectURL(removed.preview_url)

    // Re-assign cover if the cover was removed
    if (filtered.length > 0 && !filtered.some((m) => m.is_cover)) {
      filtered[0] = { ...filtered[0], is_cover: true }
    }

    onChange(filtered)
    setFileError(null)
  }

  function hasFileTransfer(e: React.DragEvent): boolean {
    try {
      return e.dataTransfer?.types?.includes('Files') ?? false
    } catch {
      return false
    }
  }

  // Native drag-and-drop handlers for file upload zone
  function handleNativeDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!hasFileTransfer(e)) return
    if (!isAtLimit && !isSubmitting) setIsDragOver(true)
  }

  function handleNativeDragLeave(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }

  function handleNativeDrop(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    if (isAtLimit || isSubmitting) return
    if (!hasFileTransfer(e)) return
    const files = e.dataTransfer.files
    if (files.length > 0) {
      processFiles(Array.from(files))
    }
  }

  const sortableIds = items.map(getMediaItemId)

  return (
    <div className="flex flex-col gap-3">
      {/* Sortable list */}
      {items.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-2">
              {items.map((item) => (
                <MediaSortableItem
                  key={getMediaItemId(item)}
                  item={item}
                  onSetCover={() => handleSetCover(getMediaItemId(item))}
                  onRemove={() => handleRemove(getMediaItemId(item))}
                  isSubmitting={isSubmitting}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Upload button / drop zone */}
      <div className="flex flex-col gap-1">
        <label
          onDragOver={handleNativeDragOver}
          onDragLeave={handleNativeDragLeave}
          onDrop={handleNativeDrop}
          className={`flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded border border-dashed px-4 py-3 text-sm text-muted-foreground transition-colors focus-within:ring-2 focus-within:ring-ring hover:bg-muted ${
            isDragOver ? 'border-primary bg-primary/5' : ''
          } ${isAtLimit || isSubmitting ? 'cursor-not-allowed opacity-50' : ''}`}
        >
          <ImagePlus className="size-4" />
          <span>Dodaj medij ({items.length}/{MAX_MEDIA_FILES})</span>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ALLOWED_MEDIA_TYPES.join(',')}
            className="sr-only"
            disabled={isAtLimit || isSubmitting}
            data-testid="media-input"
            onChange={(e) => handleFilesSelected(e.target.files)}
          />
        </label>

        {isAtLimit && !fileError && (
          <p className="text-xs text-destructive" data-testid="media-limit-message">
            Dosežena je omejitev {MAX_MEDIA_FILES} datotek
          </p>
        )}

        {fileError && (
          <p className="text-xs text-destructive" data-testid="media-file-error">
            {fileError}
          </p>
        )}
      </div>
    </div>
  )
}
