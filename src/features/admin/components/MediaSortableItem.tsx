'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Star, Trash2, GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MediaItem } from '@/features/admin/types'
import { getMediaItemId } from '@/features/admin/types'

interface MediaSortableItemProps {
  item: MediaItem
  onSetCover: () => void
  onRemove: () => void
  isSubmitting?: boolean
}

export function MediaSortableItem({
  item,
  onSetCover,
  onRemove,
  isSubmitting,
}: MediaSortableItemProps) {
  const id = getMediaItemId(item)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: isSubmitting,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const previewUrl = item.kind === 'new' ? item.preview_url : item.url
  const isVideo = item.media_type === 'video'

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-testid={`media-item-${id}`}
      className={cn(
        'relative flex items-center gap-2 rounded border bg-background p-2',
        isDragging && 'opacity-50 ring-2 ring-primary',
        item.is_cover && 'ring-2 ring-primary/60'
      )}
    >
      {/* Drag handle */}
      <button
        type="button"
        className="cursor-grab touch-none text-muted-foreground disabled:cursor-default"
        aria-label="Povleci za premikanje"
        disabled={isSubmitting}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>

      {/* Thumbnail */}
      <div className="size-14 shrink-0 overflow-hidden rounded bg-muted">
        {isVideo ? (
          <video
            src={previewUrl}
            className="size-full object-cover"
            muted
            preload="metadata"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="" className="size-full object-cover" />
        )}
      </div>

      {/* Media type badge */}
      <span className="text-xs uppercase text-muted-foreground">
        {isVideo ? 'Video' : 'Slika'}
      </span>

      {item.is_cover && (
        <span className="ml-auto mr-1 text-xs font-medium text-primary">Naslovnica</span>
      )}

      <div className={cn('flex gap-1', item.is_cover ? '' : 'ml-auto')}>
        {/* Set cover button */}
        <button
          type="button"
          data-testid={`cover-btn-${id}`}
          className={cn(
            'flex min-h-[44px] min-w-[44px] items-center justify-center rounded transition-colors',
            item.is_cover
              ? 'text-primary'
              : 'text-muted-foreground hover:text-primary'
          )}
          aria-label="Nastavi kot naslovnico"
          disabled={isSubmitting}
          onClick={onSetCover}
        >
          <Star className={cn('size-4', item.is_cover && 'fill-primary')} />
        </button>

        {/* Remove button */}
        <button
          type="button"
          data-testid={`delete-btn-${id}`}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded text-muted-foreground transition-colors hover:text-destructive"
          aria-label="Odstrani medij"
          disabled={isSubmitting}
          onClick={onRemove}
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </div>
  )
}
