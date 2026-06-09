import { render } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGenerate = vi.fn()
vi.mock('@/lib/media/generateVideoThumbnail', () => ({
  generateVideoThumbnail: (...args: unknown[]) => mockGenerate(...args),
}))

import { VideoThumbnailGenerator } from '@/features/editor/components/VideoThumbnailGenerator'

function makeFile() {
  return new File(['v'], 'clip.mp4', { type: 'video/mp4' })
}

describe('VideoThumbnailGenerator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('передаёт AbortSignal и отменяет генерацию при unmount (Finding 3)', () => {
    let capturedSignal: AbortSignal | undefined
    mockGenerate.mockImplementation(
      (_file: File, opts: { signal?: AbortSignal }) => {
        capturedSignal = opts?.signal
        return new Promise<Blob>(() => {})
      }
    )

    const onGenerating = vi.fn()
    const onSuccess = vi.fn()
    const onError = vi.fn()

    const { unmount } = render(
      <VideoThumbnailGenerator
        mediaKey="k1"
        file={makeFile()}
        onGenerating={onGenerating}
        onSuccess={onSuccess}
        onError={onError}
      />
    )

    expect(onGenerating).toHaveBeenCalledWith('k1')
    expect(capturedSignal).toBeInstanceOf(AbortSignal)
    expect(capturedSignal?.aborted).toBe(false)

    unmount()

    expect(capturedSignal?.aborted).toBe(true)
    expect(onSuccess).not.toHaveBeenCalled()
    expect(onError).not.toHaveBeenCalled()
  })

  it('не вызывает onError после unmount, если отменённая генерация падает', async () => {
    let rejectFn: (reason?: unknown) => void = () => {}
    mockGenerate.mockImplementation(
      () =>
        new Promise<Blob>((_resolve, reject) => {
          rejectFn = reject
        })
    )

    const onError = vi.fn()
    const { unmount } = render(
      <VideoThumbnailGenerator
        mediaKey="k1"
        file={makeFile()}
        onGenerating={vi.fn()}
        onSuccess={vi.fn()}
        onError={onError}
      />
    )

    unmount()
    rejectFn(new Error('aborted'))
    await Promise.resolve()

    expect(onError).not.toHaveBeenCalled()
  })

  it('вызывает onSuccess только с blob и не создаёт ObjectURL (Finding 3, Раунд 6)', async () => {
    const blob = new Blob(['img'], { type: 'image/jpeg' })
    mockGenerate.mockResolvedValue(blob)
    const createObjectURL = vi.fn(() => 'blob:poster')
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL: vi.fn() })

    const onSuccess = vi.fn()
    render(
      <VideoThumbnailGenerator
        mediaKey="k1"
        file={makeFile()}
        onGenerating={vi.fn()}
        onSuccess={onSuccess}
        onError={vi.fn()}
      />
    )

    await vi.waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith('k1', blob)
    })
    expect(createObjectURL).not.toHaveBeenCalled()

    vi.unstubAllGlobals()
  })
})
