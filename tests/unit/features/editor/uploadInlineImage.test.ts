import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockUpload = vi.fn()
const mockGetPublicUrl = vi.fn()
const mockGenerateUUID = vi.fn()

vi.mock('@/features/admin/api/uploadMedia', () => ({
  generateUUID: () => mockGenerateUUID(),
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    storage: {
      from: () => ({
        upload: (...args: unknown[]) => mockUpload(...args),
        getPublicUrl: (...args: unknown[]) => mockGetPublicUrl(...args),
      }),
    },
  }),
}))

import { uploadInlineImage } from '@/features/editor/lib/uploadInlineImage'

describe('uploadInlineImage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGenerateUUID.mockReturnValue('uuid-123')
    mockUpload.mockResolvedValue({ error: null })
    mockGetPublicUrl.mockReturnValue({
      data: {
        publicUrl:
          'https://cdn.example.com/storage/v1/object/public/inline-images/editor/uuid-123/photo.jpg',
      },
    })
  })

  it('uploads valid image to inline-images bucket and returns public url', async () => {
    const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg' })

    const result = await uploadInlineImage(file)

    expect(mockUpload).toHaveBeenCalledWith(
      'editor/uuid-123/photo.jpg',
      file,
      expect.objectContaining({
        upsert: false,
        cacheControl: '3600',
      })
    )
    expect(result).toEqual({
      url:
        'https://cdn.example.com/storage/v1/object/public/inline-images/editor/uuid-123/photo.jpg',
      storage_bucket: 'inline-images',
    })
  })

  it('sanitizes unsafe filename characters before upload', async () => {
    const file = new File(['img'], 'my photo(1).jpg', { type: 'image/jpeg' })

    await uploadInlineImage(file)

    expect(mockUpload).toHaveBeenCalledWith(
      'editor/uuid-123/my_photo_1_.jpg',
      file,
      expect.any(Object)
    )
  })

  it('rejects unsupported mime types', async () => {
    const file = new File(['txt'], 'note.txt', { type: 'text/plain' })

    await expect(uploadInlineImage(file)).rejects.toThrow(
      'Dovoljene so samo slike JPG, PNG, WEBP ali GIF'
    )
    expect(mockUpload).not.toHaveBeenCalled()
  })

  it('rejects files larger than 10 MB', async () => {
    const file = new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'big.png', {
      type: 'image/png',
    })

    await expect(uploadInlineImage(file)).rejects.toThrow(
      'Slika je prevelika. Največja dovoljena velikost je 10 MB'
    )
    expect(mockUpload).not.toHaveBeenCalled()
  })

  it('surfaces storage upload errors', async () => {
    mockUpload.mockResolvedValueOnce({
      error: { message: 'Storage failed' },
    })

    const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg' })

    await expect(uploadInlineImage(file)).rejects.toThrow(
      'Napaka pri nalaganju slike: Storage failed'
    )
  })
})
