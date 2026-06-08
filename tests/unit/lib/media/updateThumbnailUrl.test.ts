import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockEq = vi.fn()
const mockUpdate = vi.fn(() => ({ eq: mockEq }))
const mockFrom = vi.fn(() => ({ update: mockUpdate }))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ from: mockFrom }),
}))

import { updateThumbnailUrl } from '@/lib/media/updateThumbnailUrl'

describe('updateThumbnailUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEq.mockResolvedValue({ error: null })
  })

  it('обновляет thumbnail_url по id записи post_media', async () => {
    await updateThumbnailUrl('media-1', 'https://cdn.example.com/t.jpg')

    expect(mockFrom).toHaveBeenCalledWith('post_media')
    expect(mockUpdate).toHaveBeenCalledWith({
      thumbnail_url: 'https://cdn.example.com/t.jpg',
    })
    expect(mockEq).toHaveBeenCalledWith('id', 'media-1')
  })

  it('бросает ошибку при сбое БД', async () => {
    mockEq.mockResolvedValue({ error: { message: 'RLS denied' } })
    await expect(
      updateThumbnailUrl('media-1', 'https://cdn.example.com/t.jpg')
    ).rejects.toThrow('Napaka pri shranjevanju posterja')
  })
})
