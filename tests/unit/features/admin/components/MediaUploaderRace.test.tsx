import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useState } from 'react'
import { render, act } from '@testing-library/react'
import type { MediaItem, NewMediaItem } from '@/features/admin/types'

type SuccessCb = (key: string, blob: Blob) => void
const generatorCallbacks: Record<string, SuccessCb> = {}

vi.mock('@/features/editor/components/VideoThumbnailGenerator', () => ({
  VideoThumbnailGenerator: ({
    mediaKey,
    onSuccess,
  }: {
    mediaKey: string
    onSuccess: SuccessCb
  }) => {
    generatorCallbacks[mediaKey] = onSuccess
    return null
  },
}))

vi.mock('@/features/admin/components/MediaSortableItem', () => ({
  MediaSortableItem: ({
    item,
    onRemove,
  }: {
    item: MediaItem
    onRemove: () => void
  }) => {
    const id = item.kind === 'new' ? item.key : item.id
    return (
      <div data-testid={`item-${id}`}>
        {item.kind === 'new' ? item.thumbnail_status : ''}
        <button data-testid={`remove-${id}`} onClick={onRemove}>
          remove
        </button>
      </div>
    )
  },
}))

import { MediaUploader } from '@/features/admin/components/MediaUploader'

function makeVideo(key: string, order: number): NewMediaItem {
  return {
    kind: 'new',
    key,
    file: new File(['v'], `${key}.mp4`, { type: 'video/mp4' }),
    preview_url: `blob:${key}`,
    media_type: 'video',
    is_cover: order === 0,
    order_index: order,
    thumbnail_status: 'generating',
    thumbnail_blob: null,
    thumbnail_preview_url: null,
  }
}

function Harness({ initial }: { initial: MediaItem[] }) {
  const [items, setItems] = useState<MediaItem[]>(initial)
  return <MediaUploader items={items} onChange={setItems} />
}

describe('MediaUploader — параллельные thumbnail callbacks (Finding 3)', () => {
  beforeEach(() => {
    for (const k of Object.keys(generatorCallbacks)) delete generatorCallbacks[k]
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:x'),
      revokeObjectURL: vi.fn(),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('два одновременных onSuccess в одном тике не перетирают результаты друг друга', () => {
    const { getByTestId } = render(
      <Harness initial={[makeVideo('k1', 0), makeVideo('k2', 1)]} />
    )

    const blob1 = new Blob([], { type: 'image/jpeg' })
    const blob2 = new Blob([], { type: 'image/jpeg' })

    act(() => {
      generatorCallbacks['k1']('k1', blob1)
      generatorCallbacks['k2']('k2', blob2)
    })

    expect(getByTestId('item-k1')).toHaveTextContent('success')
    expect(getByTestId('item-k2')).toHaveTextContent('success')
  })

  it('поздний onSuccess не воскрешает удалённый в том же тике элемент (Finding 3, Раунд 4)', () => {
    const { queryByTestId, getByTestId } = render(
      <Harness initial={[makeVideo('k1', 0), makeVideo('k2', 1)]} />
    )

    const blob = new Blob([], { type: 'image/jpeg' })

    act(() => {
      getByTestId('remove-k1').click()
      generatorCallbacks['k1']?.('k1', blob)
    })

    expect(queryByTestId('item-k1')).toBeNull()
    expect(getByTestId('item-k2')).toBeInTheDocument()
  })

  it('поздний onSuccess удалённого video не создаёт ObjectURL — нет утечки (Finding 3, Раунд 6)', () => {
    const { getByTestId } = render(
      <Harness initial={[makeVideo('k1', 0), makeVideo('k2', 1)]} />
    )

    const createObjectURL = vi.mocked(URL.createObjectURL)
    createObjectURL.mockClear()

    const blob = new Blob([], { type: 'image/jpeg' })

    act(() => {
      getByTestId('remove-k1').click()
      generatorCallbacks['k1']?.('k1', blob)
    })

    expect(createObjectURL).not.toHaveBeenCalled()
  })

  it('повторный onSuccess для одного item отзывает прежний ObjectURL — нет утечки (Finding 3, Раунд 7)', () => {
    const createObjectURL = vi.mocked(URL.createObjectURL)
    const revokeObjectURL = vi.mocked(URL.revokeObjectURL)
    createObjectURL
      .mockReturnValueOnce('blob:first')
      .mockReturnValueOnce('blob:second')

    const { getByTestId } = render(
      <Harness initial={[makeVideo('k1', 0)]} />
    )

    const blob1 = new Blob([], { type: 'image/jpeg' })
    const blob2 = new Blob([], { type: 'image/jpeg' })

    act(() => {
      generatorCallbacks['k1']('k1', blob1)
    })
    expect(getByTestId('item-k1')).toHaveTextContent('success')

    revokeObjectURL.mockClear()

    act(() => {
      generatorCallbacks['k1']('k1', blob2)
    })

    expect(revokeObjectURL).toHaveBeenCalledWith('blob:first')
  })
})
