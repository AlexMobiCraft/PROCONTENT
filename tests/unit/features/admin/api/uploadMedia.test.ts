import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NewMediaItem } from '@/features/admin/types'

const mockUpload = vi.fn()
const mockGetPublicUrl = vi.fn()
const mockRemove = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    storage: {
      from: () => ({
        upload: mockUpload,
        getPublicUrl: mockGetPublicUrl,
        remove: mockRemove,
      }),
    },
  }),
}))

import {
  uploadSingleFile,
  uploadNewMediaItems,
  removeStorageFiles,
} from '@/features/admin/api/uploadMedia'

function makeFile(name = 'photo.jpg', type = 'image/jpeg') {
  return new File(['content'], name, { type })
}

function makeNewItem(key: string, orderIndex = 0): NewMediaItem {
  return {
    kind: 'new',
    key,
    file: makeFile(),
    preview_url: `blob:${key}`,
    media_type: 'image',
    is_cover: orderIndex === 0,
    order_index: orderIndex,
  }
}

describe('uploadSingleFile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUpload.mockResolvedValue({ error: null })
    mockGetPublicUrl.mockReturnValue({ data: { publicUrl: 'https://cdn.example.com/file.jpg' } })
  })

  it('uploads file and returns public URL', async () => {
    const url = await uploadSingleFile('post-123', makeFile())
    expect(mockUpload).toHaveBeenCalledOnce()
    expect(url).toBe('https://cdn.example.com/file.jpg')
  })

  it('uses unique path containing post id', async () => {
    await uploadSingleFile('post-abc', makeFile('test.png'))
    const [path] = mockUpload.mock.calls[0]
    expect(path).toMatch(/^posts\/post-abc\//)
    expect(path).toContain('test.png')
  })

  it('throws on storage upload error', async () => {
    mockUpload.mockResolvedValue({ error: { message: 'Bucket not found' } })
    await expect(uploadSingleFile('p1', makeFile())).rejects.toThrow('Napaka pri nalaganju datoteke')
  })
})

describe('uploadNewMediaItems', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUpload.mockResolvedValue({ error: null })
    mockGetPublicUrl.mockReturnValue({ data: { publicUrl: 'https://cdn.example.com/media.jpg' } })
  })

  it('uploads all items and returns UploadedMedia array', async () => {
    const items = [makeNewItem('k1', 0), makeNewItem('k2', 1)]
    const result = await uploadNewMediaItems('post-1', items)
    expect(result).toHaveLength(2)
    expect(result[0].url).toBe('https://cdn.example.com/media.jpg')
    expect(result[0].order_index).toBe(0)
    expect(result[0].is_cover).toBe(true)
    expect(result[1].order_index).toBe(1)
    expect(result[1].is_cover).toBe(false)
  })

  it('returns empty array for empty input', async () => {
    const result = await uploadNewMediaItems('post-1', [])
    expect(result).toHaveLength(0)
    expect(mockUpload).not.toHaveBeenCalled()
  })
})

describe('removeStorageFiles', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRemove.mockResolvedValue({ error: null })
  })

  it('does nothing for empty array', async () => {
    await removeStorageFiles([])
    expect(mockRemove).not.toHaveBeenCalled()
  })

  it('extracts paths from public URLs and calls storage.remove', async () => {
    const urls = [
      'https://abc.supabase.co/storage/v1/object/public/post_media/posts/p1/uuid/file.jpg',
    ]
    await removeStorageFiles(urls)
    expect(mockRemove).toHaveBeenCalledWith(['posts/p1/uuid/file.jpg'])
  })

  it('throws on storage remove error', async () => {
    mockRemove.mockResolvedValue({ error: { message: 'Not found' } })
    const urls = [
      'https://abc.supabase.co/storage/v1/object/public/post_media/posts/p1/uuid/file.jpg',
    ]
    await expect(removeStorageFiles(urls)).rejects.toThrow('Napaka pri brisanju datotek')
  })

  it('skips URLs that do not match expected bucket path', async () => {
    const urls = ['https://example.com/other/path/file.jpg']
    await removeStorageFiles(urls)
    // No valid paths extracted — remove should not be called
    expect(mockRemove).not.toHaveBeenCalled()
  })
})
