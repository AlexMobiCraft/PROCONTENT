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
import { useRef } from 'react'
import type { MediaItem, MediaType, NewMediaItem } from '@/features/admin/types'
import {
  getMediaItemId,
  MAX_MEDIA_FILES,
  ALLOWED_IMAGE_TYPES,
  ALLOWED_MEDIA_TYPES,
} from '@/features/admin/types'
import { MediaSortableItem } from './MediaSortableItem'

interface MediaUploaderProps {
  items: MediaItem[]
  onChange: (items: MediaItem[]) => void
  isSubmitting?: boolean
}

export function MediaUploader({ items, onChange, isSubmitting }: MediaUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const isAtLimit = items.length >= MAX_MEDIA_FILES

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
    onChange(reordered)
  }

  function handleFilesSelected(files: FileList | null) {
    if (!files || files.length === 0) return

    const remaining = MAX_MEDIA_FILES - items.length
    const toAdd = Array.from(files).slice(0, remaining)

    const newItems: NewMediaItem[] = toAdd.map((file, i) => {
      const mediaType: MediaType = ALLOWED_IMAGE_TYPES.includes(file.type) ? 'image' : 'video'
      return {
        kind: 'new',
        key: crypto.randomUUID(),
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

    // Revoke object URL for new items
    const removed = items.find((item) => getMediaItemId(item) === targetId)
    if (removed?.kind === 'new') URL.revokeObjectURL(removed.preview_url)

    // Re-assign cover if the cover was removed
    if (filtered.length > 0 && !filtered.some((m) => m.is_cover)) {
      filtered[0] = { ...filtered[0], is_cover: true }
    }

    onChange(filtered)
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
          className={`flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded border border-dashed px-4 py-3 text-sm text-muted-foreground transition-colors hover:bg-muted ${
            isAtLimit || isSubmitting ? 'cursor-not-allowed opacity-50' : ''
          }`}
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

        {isAtLimit && (
          <p className="text-xs text-destructive" data-testid="media-limit-message">
            Dosežena je omejitev {MAX_MEDIA_FILES} datotek
          </p>
        )}
      </div>
    </div>
  )
}
