import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NewMediaItem, ThumbnailStatus } from '@/features/admin/types'

const mockUploadThumbnail = vi.fn()
const mockUpdateThumbnailUrl = vi.fn()
const mockRemoveStorageFiles = vi.fn()

vi.mock('@/lib/media/uploadThumbnail', () => ({
  uploadThumbnail: (...args: unknown[]) => mockUploadThumbnail(...args),
}))
vi.mock('@/lib/media/updateThumbnailUrl', () => ({
  updateThumbnailUrl: (...args: unknown[]) => mockUpdateThumbnailUrl(...args),
}))
vi.mock('@/features/admin/api/uploadMedia', () => ({
  removeStorageFiles: (...args: unknown[]) => mockRemoveStorageFiles(...args),
}))

import {
  buildVideoThumbnailTasks,
  applyNewVideoThumbnails,
} from '@/features/admin/api/postThumbnails'

function newVideo(
  key: string,
  orderIndex: number,
  blob: Blob | null,
  status?: ThumbnailStatus
): NewMediaItem {
  return {
    kind: 'new',
    key,
    file: new File(['v'], `${key}.mp4`, { type: 'video/mp4' }),
    preview_url: `blob:${key}`,
    media_type: 'video',
    is_cover: false,
    order_index: orderIndex,
    thumbnail_blob: blob,
    thumbnail_status: status ?? (blob ? 'success' : 'error'),
  }
}

function newImage(key: string, orderIndex: number): NewMediaItem {
  return {
    kind: 'new',
    key,
    file: new File(['i'], `${key}.jpg`, { type: 'image/jpeg' }),
    preview_url: `blob:${key}`,
    media_type: 'image',
    is_cover: false,
    order_index: orderIndex,
  }
}

describe('buildVideoThumbnailTasks', () => {
  it('создаёт задачи только для видео, сопоставляя по url', () => {
    const items = [newImage('i0', 0), newVideo('v1', 1, new Blob([], { type: 'image/jpeg' }))]
    const uploadedUrls = ['https://cdn/i0.jpg', 'https://cdn/v1.mp4']
    const rows = [
      { id: 'row-i0', url: 'https://cdn/i0.jpg' },
      { id: 'row-v1', url: 'https://cdn/v1.mp4' },
    ]

    const tasks = buildVideoThumbnailTasks(items, uploadedUrls, rows)

    expect(tasks).toHaveLength(1)
    expect(tasks[0]).toMatchObject({ postMediaId: 'row-v1', videoUrl: 'https://cdn/v1.mp4' })
  })

  it('пропускает видео без сопоставленной строки и логирует предупреждение (Finding 6)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const items = [newVideo('v1', 0, new Blob([], { type: 'image/jpeg' }))]

    const tasks = buildVideoThumbnailTasks(items, ['https://cdn/v1.mp4'], [])

    expect(tasks).toHaveLength(0)
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('post_media')
    )
    warnSpy.mockRestore()
  })
})

describe('applyNewVideoThumbnails', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUploadThumbnail.mockResolvedValue('https://cdn/thumb.jpg')
    mockUpdateThumbnailUrl.mockResolvedValue(undefined)
    mockRemoveStorageFiles.mockResolvedValue(undefined)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }))
  })

  it('загружает thumbnail и обновляет URL когда blob есть', async () => {
    const blob = new Blob([], { type: 'image/jpeg' })
    const result = await applyNewVideoThumbnails([
      { item: newVideo('v1', 0, blob), postMediaId: 'm1', videoUrl: 'https://cdn/v1.mp4' },
    ])

    expect(mockUploadThumbnail).toHaveBeenCalledWith(blob, 'm1')
    expect(mockUpdateThumbnailUrl).toHaveBeenCalledWith('m1', 'https://cdn/thumb.jpg')
    expect(fetch).not.toHaveBeenCalled()
    expect(result).toEqual({ expected: 1, persisted: 1, allPersisted: true })
  })

  it('вызывает серверный fallback когда Canvas не удался (status=error)', async () => {
    await applyNewVideoThumbnails([
      { item: newVideo('v1', 0, null, 'error'), postMediaId: 'm1', videoUrl: 'https://cdn/v1.mp4' },
    ])

    expect(mockUploadThumbnail).not.toHaveBeenCalled()
    expect(fetch).toHaveBeenCalledWith(
      '/api/admin/generate-thumbnail-fallback',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('Canvas-error видео (fallback) считается expected и даёт allPersisted=false без сохранённого poster (Finding 3)', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 501 }))

    const result = await applyNewVideoThumbnails([
      { item: newVideo('v1', 0, null, 'error'), postMediaId: 'm1', videoUrl: 'https://cdn/v1.mp4' },
    ])

    expect(mockUploadThumbnail).not.toHaveBeenCalled()
    expect(result).toEqual({ expected: 1, persisted: 0, allPersisted: false })
  })

  it('НЕ вызывает fallback когда poster ещё генерируется (status=generating) (Finding 2)', async () => {
    await applyNewVideoThumbnails([
      {
        item: newVideo('v1', 0, null, 'generating'),
        postMediaId: 'm1',
        videoUrl: 'https://cdn/v1.mp4',
      },
    ])

    expect(mockUploadThumbnail).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('удаляет orphaned thumbnail когда upload успешен, а updateThumbnailUrl падает (Finding 5)', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    mockUpdateThumbnailUrl.mockRejectedValue(new Error('DB down'))
    const blob = new Blob([], { type: 'image/jpeg' })

    const result = await applyNewVideoThumbnails([
      { item: newVideo('v1', 0, blob), postMediaId: 'm1', videoUrl: 'https://cdn/v1.mp4' },
    ])

    expect(mockUploadThumbnail).toHaveBeenCalledWith(blob, 'm1')
    expect(mockRemoveStorageFiles).toHaveBeenCalledWith(['https://cdn/thumb.jpg'])
    expect(result).toEqual({ expected: 1, persisted: 0, allPersisted: false })
  })

  it('не пробрасывает ошибки и сообщает allPersisted=false (best-effort, не блокирует сохранение)', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    mockUploadThumbnail.mockRejectedValue(new Error('Storage down'))
    const blob = new Blob([], { type: 'image/jpeg' })

    const result = await applyNewVideoThumbnails([
      { item: newVideo('v1', 0, blob), postMediaId: 'm1', videoUrl: 'https://cdn/v1.mp4' },
    ])

    expect(result).toEqual({ expected: 1, persisted: 0, allPersisted: false })
  })

  it('ничего не делает для пустого списка задач (allPersisted=true)', async () => {
    const result = await applyNewVideoThumbnails([])
    expect(mockUploadThumbnail).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
    expect(result).toEqual({ expected: 0, persisted: 0, allPersisted: true })
  })

  it('зависший Storage upload по истечении бюджета не считается persisted (Findings 1, 2)', async () => {
    vi.useFakeTimers()
    try {
      mockUploadThumbnail.mockImplementation(() => new Promise(() => {}))
      const blob = new Blob([], { type: 'image/jpeg' })

      const promise = applyNewVideoThumbnails(
        [{ item: newVideo('v1', 0, blob), postMediaId: 'm1', videoUrl: 'https://cdn/v1.mp4' }],
        { budgetMs: 1000 }
      )

      await vi.advanceTimersByTimeAsync(1000)
      await expect(promise).resolves.toEqual({
        expected: 1,
        persisted: 0,
        allPersisted: false,
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it('прерывает незавершённый fallback fetch при истечении бюджета (Finding B)', async () => {
    vi.useFakeTimers()
    try {
      let capturedSignal: AbortSignal | undefined
      const fetchMock = vi.fn((_url: string, opts: { signal?: AbortSignal }) => {
        capturedSignal = opts.signal
        return new Promise(() => {})
      })
      vi.stubGlobal('fetch', fetchMock)

      const promise = applyNewVideoThumbnails(
        [{ item: newVideo('v1', 0, null, 'error'), postMediaId: 'm1', videoUrl: 'https://cdn/v1.mp4' }],
        { budgetMs: 1000 }
      )

      await vi.advanceTimersByTimeAsync(1000)
      await expect(promise).resolves.toEqual({
        expected: 1,
        persisted: 0,
        allPersisted: false,
      })
      expect(capturedSignal?.aborted).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })
})
