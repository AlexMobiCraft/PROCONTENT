import { describe, it, expect, vi, beforeEach } from 'vitest'

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
  uploadFilesWithTracking,
  removeStorageFiles,
} from '@/features/admin/api/uploadMedia'

function makeFile(name = 'photo.jpg', type = 'image/jpeg') {
  return new File(['content'], name, { type })
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

describe('uploadFilesWithTracking', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUpload.mockResolvedValue({ error: null })
    mockGetPublicUrl.mockReturnValue({ data: { publicUrl: 'https://cdn.example.com/media.jpg' } })
  })

  it('uploads files in batches and returns URLs', async () => {
    const files = [makeFile('a.jpg'), makeFile('b.jpg')]
    const uploadedUrls: string[] = []
    const result = await uploadFilesWithTracking('post-1', files, uploadedUrls)
    expect(result).toHaveLength(2)
    expect(result[0]).toBe('https://cdn.example.com/media.jpg')
    expect(uploadedUrls).toHaveLength(2)
  })

  it('tracks uploaded URLs for rollback', async () => {
    const files = [makeFile('a.jpg')]
    const uploadedUrls: string[] = []
    await uploadFilesWithTracking('post-1', files, uploadedUrls)
    expect(uploadedUrls).toEqual(['https://cdn.example.com/media.jpg'])
  })

  it('returns empty array for empty input', async () => {
    const uploadedUrls: string[] = []
    const result = await uploadFilesWithTracking('post-1', [], uploadedUrls)
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
