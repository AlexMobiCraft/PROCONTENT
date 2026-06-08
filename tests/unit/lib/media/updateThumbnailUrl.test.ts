import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSelect = vi.fn()
const mockEq = vi.fn(() => ({ select: mockSelect }))
const mockUpdate = vi.fn(() => ({ eq: mockEq }))
const mockFrom = vi.fn(() => ({ update: mockUpdate }))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ from: mockFrom }),
}))

import { updateThumbnailUrl } from '@/lib/media/updateThumbnailUrl'

describe('updateThumbnailUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSelect.mockResolvedValue({ data: [{ id: 'media-1' }], error: null })
  })

  it('обновляет thumbnail_url по id записи post_media', async () => {
    await updateThumbnailUrl('media-1', 'https://cdn.example.com/t.jpg')

    expect(mockFrom).toHaveBeenCalledWith('post_media')
    expect(mockUpdate).toHaveBeenCalledWith({
      thumbnail_url: 'https://cdn.example.com/t.jpg',
    })
    expect(mockEq).toHaveBeenCalledWith('id', 'media-1')
    expect(mockSelect).toHaveBeenCalledWith('id')
  })

  it('бросает ошибку при сбое БД', async () => {
    mockSelect.mockResolvedValue({ data: null, error: { message: 'RLS denied' } })
    await expect(
      updateThumbnailUrl('media-1', 'https://cdn.example.com/t.jpg')
    ).rejects.toThrow('Napaka pri shranjevanju posterja')
  })

  it('бросает ошибку, когда обновлено 0 строк (RLS/несуществующий id) — иначе thumbnail осиротеет', async () => {
    mockSelect.mockResolvedValue({ data: [], error: null })
    await expect(
      updateThumbnailUrl('media-1', 'https://cdn.example.com/t.jpg')
    ).rejects.toThrow('Napaka pri shranjevanju posterja')
  })
})
