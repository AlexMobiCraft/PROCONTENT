import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockUpload = vi.fn()
const mockGetPublicUrl = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    storage: {
      from: () => ({
        upload: mockUpload,
        getPublicUrl: mockGetPublicUrl,
      }),
    },
  }),
}))

import { uploadThumbnail, getThumbnailStoragePath } from '@/lib/media/uploadThumbnail'

function jpegBlob() {
  return new Blob(['img'], { type: 'image/jpeg' })
}

describe('getThumbnailStoragePath', () => {
  it('строит путь thumbnails/{id}_thumb.jpg', () => {
    expect(getThumbnailStoragePath('abc-123')).toBe('thumbnails/abc-123_thumb.jpg')
  })
})

describe('uploadThumbnail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUpload.mockResolvedValue({ error: null })
    mockGetPublicUrl.mockReturnValue({
      data: { publicUrl: 'https://cdn.example.com/thumbnails/abc_thumb.jpg' },
    })
  })

  it('загружает blob с upsert и возвращает публичный URL', async () => {
    const url = await uploadThumbnail(jpegBlob(), 'abc')
    expect(mockUpload).toHaveBeenCalledOnce()
    const [path, , options] = mockUpload.mock.calls[0]
    expect(path).toBe('thumbnails/abc_thumb.jpg')
    expect(options).toMatchObject({ contentType: 'image/jpeg', upsert: true })
    expect(url).toBe('https://cdn.example.com/thumbnails/abc_thumb.jpg')
  })

  it('отклоняет blob неверного MIME (security)', async () => {
    const pngBlob = new Blob(['x'], { type: 'image/png' })
    await expect(uploadThumbnail(pngBlob, 'abc')).rejects.toThrow('Neveljaven tip slike')
    expect(mockUpload).not.toHaveBeenCalled()
  })

  it('бросает ошибку при сбое загрузки в Storage', async () => {
    mockUpload.mockResolvedValue({ error: { message: 'Bucket error' } })
    await expect(uploadThumbnail(jpegBlob(), 'abc')).rejects.toThrow(
      'Napaka pri nalaganju posterja'
    )
  })
})
