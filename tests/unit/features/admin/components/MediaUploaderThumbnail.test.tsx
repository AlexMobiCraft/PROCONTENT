import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useState } from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('@/lib/media/generateVideoThumbnail', () => ({
  generateVideoThumbnail: vi.fn(() =>
    Promise.resolve(new Blob(['img'], { type: 'image/jpeg' }))
  ),
}))

import { MediaUploader } from '@/features/admin/components/MediaUploader'
import type { MediaItem } from '@/features/admin/types'

function Harness() {
  const [items, setItems] = useState<MediaItem[]>([])
  return <MediaUploader items={items} onChange={setItems} />
}

describe('MediaUploader — генерация poster для видео (Story 8.1)', () => {
  beforeEach(() => {
    let n = 0
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn((obj: Blob) =>
        obj.type === 'image/jpeg' ? 'blob:poster' : `blob:video-${n++}`
      ),
      revokeObjectURL: vi.fn(),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('после добавления видео генерирует и показывает сгенерированный poster', async () => {
    render(<Harness />)

    const input = screen.getByTestId('media-input') as HTMLInputElement
    const file = new File(['v'], 'clip.mp4', { type: 'video/mp4' })
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      expect(document.querySelector('img[src="blob:poster"]')).not.toBeNull()
    })
  })

  it('не запускает генерацию для изображений', async () => {
    const { generateVideoThumbnail } = await import('@/lib/media/generateVideoThumbnail')
    render(<Harness />)

    const input = screen.getByTestId('media-input') as HTMLInputElement
    const file = new File(['i'], 'pic.jpg', { type: 'image/jpeg' })
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText(/Slika/)).toBeInTheDocument()
    })
    expect(generateVideoThumbnail).not.toHaveBeenCalled()
  })
})
