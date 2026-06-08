import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NewMediaItem } from '@/features/admin/types'

const mockUploadThumbnail = vi.fn()
const mockUpdateThumbnailUrl = vi.fn()

vi.mock('@/lib/media/uploadThumbnail', () => ({
  uploadThumbnail: (...args: unknown[]) => mockUploadThumbnail(...args),
}))
vi.mock('@/lib/media/updateThumbnailUrl', () => ({
  updateThumbnailUrl: (...args: unknown[]) => mockUpdateThumbnailUrl(...args),
}))

import {
  buildVideoThumbnailTasks,
  applyNewVideoThumbnails,
} from '@/features/admin/api/postThumbnails'

function newVideo(key: string, orderIndex: number, blob: Blob | null): NewMediaItem {
  return {
    kind: 'new',
    key,
    file: new File(['v'], `${key}.mp4`, { type: 'video/mp4' }),
    preview_url: `blob:${key}`,
    media_type: 'video',
    is_cover: false,
    order_index: orderIndex,
    thumbnail_blob: blob,
    thumbnail_status: blob ? 'success' : 'error',
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

  it('пропускает видео без сопоставленной строки', () => {
    const items = [newVideo('v1', 0, new Blob([], { type: 'image/jpeg' }))]
    const tasks = buildVideoThumbnailTasks(items, ['https://cdn/v1.mp4'], [])
    expect(tasks).toHaveLength(0)
  })
})

describe('applyNewVideoThumbnails', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUploadThumbnail.mockResolvedValue('https://cdn/thumb.jpg')
    mockUpdateThumbnailUrl.mockResolvedValue(undefined)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }))
  })

  it('загружает thumbnail и обновляет URL когда blob есть', async () => {
    const blob = new Blob([], { type: 'image/jpeg' })
    await applyNewVideoThumbnails([
      { item: newVideo('v1', 0, blob), postMediaId: 'm1', videoUrl: 'https://cdn/v1.mp4' },
    ])

    expect(mockUploadThumbnail).toHaveBeenCalledWith(blob, 'm1')
    expect(mockUpdateThumbnailUrl).toHaveBeenCalledWith('m1', 'https://cdn/thumb.jpg')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('вызывает серверный fallback когда blob отсутствует', async () => {
    await applyNewVideoThumbnails([
      { item: newVideo('v1', 0, null), postMediaId: 'm1', videoUrl: 'https://cdn/v1.mp4' },
    ])

    expect(mockUploadThumbnail).not.toHaveBeenCalled()
    expect(fetch).toHaveBeenCalledWith(
      '/api/admin/generate-thumbnail-fallback',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('не пробрасывает ошибки (best-effort, не блокирует сохранение)', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    mockUploadThumbnail.mockRejectedValue(new Error('Storage down'))
    const blob = new Blob([], { type: 'image/jpeg' })

    await expect(
      applyNewVideoThumbnails([
        { item: newVideo('v1', 0, blob), postMediaId: 'm1', videoUrl: 'https://cdn/v1.mp4' },
      ])
    ).resolves.toBeUndefined()
  })

  it('ничего не делает для пустого списка задач', async () => {
    await applyNewVideoThumbnails([])
    expect(mockUploadThumbnail).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })
})
