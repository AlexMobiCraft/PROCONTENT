import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NewMediaItem, PostFormValues } from '@/features/admin/types'

const mockUploadThumbnail = vi.fn()
const mockUpdateThumbnailUrl = vi.fn()

vi.mock('@/lib/media/uploadThumbnail', () => ({
  uploadThumbnail: (...args: unknown[]) => mockUploadThumbnail(...args),
}))
vi.mock('@/lib/media/updateThumbnailUrl', () => ({
  updateThumbnailUrl: (...args: unknown[]) => mockUpdateThumbnailUrl(...args),
}))

const mockUploadFilesWithTracking = vi.fn()
const mockRemoveStorageFiles = vi.fn()
vi.mock('@/features/admin/api/uploadMedia', () => ({
  uploadFilesWithTracking: (...args: unknown[]) => mockUploadFilesWithTracking(...args),
  removeStorageFiles: (...args: unknown[]) => mockRemoveStorageFiles(...args),
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let supabaseChain: any
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ from: () => supabaseChain }),
}))

import { createPost } from '@/features/admin/api/posts'

const baseFormValues: PostFormValues = {
  title: 'Video Post',
  category: null,
  content: '',
  excerpt: '',
  status: 'published',
}

function videoItem(blob: Blob | null): NewMediaItem {
  return {
    kind: 'new',
    key: 'v1',
    file: new File(['v'], 'clip.mp4', { type: 'video/mp4' }),
    preview_url: 'blob:v1',
    media_type: 'video',
    is_cover: true,
    order_index: 0,
    thumbnail_blob: blob,
    thumbnail_status: blob ? 'success' : 'error',
  }
}

describe('createPost — thumbnail для нового видео (Story 8.1, Task 4)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUploadThumbnail.mockResolvedValue('https://cdn.example.com/thumbnails/row-v_thumb.jpg')
    mockUpdateThumbnailUrl.mockResolvedValue(undefined)
    mockUploadFilesWithTracking.mockImplementation(
      async (_postId: string, files: File[], urls: string[]) => {
        const out = files.map((_f, i) => `https://cdn.example.com/file${i}.mp4`)
        urls.push(...out)
        return out
      }
    )

    supabaseChain = {
      insert: vi
        .fn()
        // posts insert → .select('id').single()
        .mockReturnValueOnce({
          select: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: { id: 'post-1' }, error: null }),
          })),
        })
        // post_media insert → .select('id, url')
        .mockReturnValueOnce({
          select: vi.fn().mockResolvedValue({
            data: [{ id: 'row-v', url: 'https://cdn.example.com/file0.mp4' }],
            error: null,
          }),
        }),
      update: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })),
    }
  })

  it('загружает Canvas-blob и обновляет thumbnail_url с id вставленной строки', async () => {
    const blob = new Blob(['img'], { type: 'image/jpeg' })

    await createPost({
      formValues: baseFormValues,
      mediaItems: [videoItem(blob)],
      authorId: 'user-1',
    })

    expect(mockUploadThumbnail).toHaveBeenCalledWith(blob, 'row-v')
    expect(mockUpdateThumbnailUrl).toHaveBeenCalledWith(
      'row-v',
      'https://cdn.example.com/thumbnails/row-v_thumb.jpg'
    )
  })

  it('вызывает серверный fallback когда Canvas-blob отсутствует', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }))

    await createPost({
      formValues: baseFormValues,
      mediaItems: [videoItem(null)],
      authorId: 'user-1',
    })

    expect(mockUploadThumbnail).not.toHaveBeenCalled()
    expect(fetch).toHaveBeenCalledWith(
      '/api/admin/generate-thumbnail-fallback',
      expect.objectContaining({ method: 'POST' })
    )

    vi.unstubAllGlobals()
  })
})
