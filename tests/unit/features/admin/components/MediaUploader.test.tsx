import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { MediaItem, NewMediaItem, ExistingMediaItem } from '@/features/admin/types'
import { MAX_MEDIA_FILES } from '@/features/admin/types'

// @dnd-kit requires pointer events support — mock sortable context for unit tests
vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  closestCenter: vi.fn(),
  KeyboardSensor: vi.fn(),
  PointerSensor: vi.fn(),
  useSensor: vi.fn(() => ({})),
  useSensors: vi.fn(() => []),
  DragEndEvent: {},
}))

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  sortableKeyboardCoordinates: vi.fn(),
  arrayMove: vi.fn((arr: unknown[], from: number, to: number) => {
    const result = [...arr]
    const [removed] = result.splice(from, 1)
    result.splice(to, 0, removed)
    return result
  }),
  useSortable: vi.fn(() => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  })),
  verticalListSortingStrategy: {},
}))

vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: vi.fn(() => '') } },
}))

vi.mock('@/features/admin/api/uploadMedia', () => ({
  generateUUID: () => 'test-uuid-' + Math.random().toString(36).slice(2, 8),
}))

import { MediaUploader } from '@/features/admin/components/MediaUploader'

function makeExistingItem(id: string, orderIndex = 0): ExistingMediaItem {
  return {
    kind: 'existing',
    id,
    url: `https://example.com/${id}.jpg`,
    thumbnail_url: null,
    media_type: 'image',
    is_cover: orderIndex === 0,
    order_index: orderIndex,
  }
}

describe('MediaUploader', () => {
  let onChange: ReturnType<typeof vi.fn<(items: MediaItem[]) => void>>

  beforeEach(() => {
    onChange = vi.fn<(items: MediaItem[]) => void>()
  })

  it('renders empty drop zone when no items', () => {
    render(<MediaUploader items={[]} onChange={onChange} />)
    expect(screen.getByTestId('media-input')).toBeInTheDocument()
  })

  it('shows existing media items', () => {
    const items: MediaItem[] = [makeExistingItem('abc', 0), makeExistingItem('def', 1)]
    render(<MediaUploader items={items} onChange={onChange} />)
    expect(screen.getAllByTestId(/^media-item-/)).toHaveLength(2)
  })

  it('shows inline error when at MAX_MEDIA_FILES limit', () => {
    const existingItems: MediaItem[] = Array.from({ length: MAX_MEDIA_FILES }, (_, i) =>
      makeExistingItem(`item${i}`, i)
    )
    render(<MediaUploader items={existingItems} onChange={onChange} />)
    // Input should be disabled when at limit
    expect(screen.getByTestId('media-input')).toBeDisabled()
    expect(screen.getByTestId('media-limit-message')).toBeInTheDocument()
  })

  it('calls onChange when a new file is selected', async () => {
    const user = userEvent.setup()
    render(<MediaUploader items={[]} onChange={onChange} />)

    const file = new File(['content'], 'photo.jpg', { type: 'image/jpeg' })
    const input = screen.getByTestId('media-input')
    await user.upload(input, file)

    expect(onChange).toHaveBeenCalledOnce()
    const newItems: MediaItem[] = onChange.mock.calls[0][0]
    expect(newItems).toHaveLength(1)
    expect(newItems[0].kind).toBe('new')
    expect((newItems[0] as NewMediaItem).media_type).toBe('image')
  })

  it('shows inline error when files exceed limit and trims excess', async () => {
    const user = userEvent.setup()
    // Start with 9 items
    const existingItems: MediaItem[] = Array.from({ length: 9 }, (_, i) =>
      makeExistingItem(`item${i}`, i)
    )
    render(<MediaUploader items={existingItems} onChange={onChange} />)

    // Try to add 3 files — only 1 should be added
    const files = [
      new File(['a'], 'a.jpg', { type: 'image/jpeg' }),
      new File(['b'], 'b.jpg', { type: 'image/jpeg' }),
      new File(['c'], 'c.jpg', { type: 'image/jpeg' }),
    ]
    const input = screen.getByTestId('media-input')
    await user.upload(input, files)

    expect(onChange).toHaveBeenCalledOnce()
    const newItems: MediaItem[] = onChange.mock.calls[0][0]
    // 9 existing + 1 new = 10
    expect(newItems).toHaveLength(10)
    // Error message should appear
    expect(screen.getByTestId('media-file-error')).toBeInTheDocument()
  })

  it('shows error for oversized image file', async () => {
    const user = userEvent.setup()
    render(<MediaUploader items={[]} onChange={onChange} />)

    // Create a file object > 10 MB
    const largeContent = new Uint8Array(11 * 1024 * 1024)
    const file = new File([largeContent], 'huge.jpg', { type: 'image/jpeg' })
    const input = screen.getByTestId('media-input')
    await user.upload(input, file)

    // Should not add the file
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByTestId('media-file-error')).toBeInTheDocument()
  })

  it('marks item as cover when cover button is clicked', () => {
    const items: MediaItem[] = [
      makeExistingItem('a', 0),
      makeExistingItem('b', 1),
    ]
    items[0].is_cover = false
    items[1].is_cover = false

    render(<MediaUploader items={items} onChange={onChange} />)

    const coverBtns = screen.getAllByTestId(/^cover-btn-/)
    fireEvent.click(coverBtns[1])

    expect(onChange).toHaveBeenCalledOnce()
    const updated: MediaItem[] = onChange.mock.calls[0][0]
    expect(updated[0].is_cover).toBe(false)
    expect(updated[1].is_cover).toBe(true)
  })

  it('only one item can be cover at a time', () => {
    const items: MediaItem[] = [
      { ...makeExistingItem('a', 0), is_cover: true },
      { ...makeExistingItem('b', 1), is_cover: false },
    ]
    render(<MediaUploader items={items} onChange={onChange} />)

    const coverBtns = screen.getAllByTestId(/^cover-btn-/)
    fireEvent.click(coverBtns[1])

    const updated: MediaItem[] = onChange.mock.calls[0][0]
    expect(updated.filter((m) => m.is_cover)).toHaveLength(1)
    expect(updated[1].is_cover).toBe(true)
    expect(updated[0].is_cover).toBe(false)
  })

  it('calls onChange without item when delete button is clicked', () => {
    const items: MediaItem[] = [makeExistingItem('a', 0), makeExistingItem('b', 1)]
    render(<MediaUploader items={items} onChange={onChange} />)

    const deleteBtns = screen.getAllByTestId(/^delete-btn-/)
    fireEvent.click(deleteBtns[0])

    const updated: MediaItem[] = onChange.mock.calls[0][0]
    expect(updated).toHaveLength(1)
    expect(updated[0].kind === 'existing' && (updated[0] as ExistingMediaItem).id).toBe('b')
  })

  it('disables input when isSubmitting', () => {
    render(<MediaUploader items={[]} onChange={onChange} isSubmitting={true} />)
    expect(screen.getByTestId('media-input')).toBeDisabled()
  })
})
