import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock supabase client
const mockStorageFrom = vi.fn()
const mockUpload = vi.fn()
const mockGetPublicUrl = vi.fn()
const mockRemove = vi.fn()
const mockFrom = vi.fn()
const mockEq = vi.fn()
const mockSingle = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    storage: {
      from: mockStorageFrom,
    },
    from: mockFrom,
  }),
}))

// Mock crypto.randomUUID
vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid-1234' })

import { uploadAvatar, deleteAvatarFile, updateProfile } from '@/features/profile/api/profileApi'

const makeFile = (
  name: string,
  size: number,
  type: string
): File => {
  const content = new Array(size).fill('a').join('')
  const blob = new Blob([content], { type })
  return new File([blob], name, { type })
}

describe('uploadAvatar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStorageFrom.mockReturnValue({
      upload: mockUpload,
      getPublicUrl: mockGetPublicUrl,
    })
    mockGetPublicUrl.mockReturnValue({
      data: { publicUrl: 'https://example.supabase.co/storage/v1/object/public/avatars/user-1/test-uuid-1234/avatar.jpg' },
    })
    mockUpload.mockResolvedValue({ error: null })
  })

  it('throws error when file is 0 bytes', async () => {
    const file = makeFile('empty.jpg', 0, 'image/jpeg')
    await expect(uploadAvatar('user-1', file)).rejects.toThrow('Datoteka ne sme biti prazna')
  })

  it('throws error when file exceeds 5MB', async () => {
    const file = makeFile('big.jpg', 5 * 1024 * 1024 + 1, 'image/jpeg')
    await expect(uploadAvatar('user-1', file)).rejects.toThrow('Datoteka je prevelika')
  })

  it('throws error for invalid MIME type (text/plain)', async () => {
    const file = makeFile('evil.txt', 100, 'text/plain')
    await expect(uploadAvatar('user-1', file)).rejects.toThrow(
      'Samo slike (JPEG, PNG, GIF, WebP) so dovoljene'
    )
  })

  it('throws error for invalid MIME type (application/pdf)', async () => {
    const file = makeFile('doc.pdf', 100, 'application/pdf')
    await expect(uploadAvatar('user-1', file)).rejects.toThrow(
      'Samo slike (JPEG, PNG, GIF, WebP) so dovoljene'
    )
  })

  it('accepts valid JPEG file at exactly 5MB', async () => {
    const file = makeFile('avatar.jpg', 5 * 1024 * 1024, 'image/jpeg')
    const url = await uploadAvatar('user-1', file)
    expect(url).toContain('avatars')
    expect(mockUpload).toHaveBeenCalledTimes(1)
  })

  it('accepts valid PNG file', async () => {
    const file = makeFile('avatar.png', 1024, 'image/png')
    const url = await uploadAvatar('user-1', file)
    expect(typeof url).toBe('string')
    expect(url.length).toBeGreaterThan(0)
  })

  it('accepts valid WebP file', async () => {
    const file = makeFile('avatar.webp', 512, 'image/webp')
    const url = await uploadAvatar('user-1', file)
    expect(typeof url).toBe('string')
  })

  it('throws when supabase storage upload returns error', async () => {
    mockUpload.mockResolvedValue({ error: { message: 'Storage quota exceeded' } })
    const file = makeFile('avatar.jpg', 1024, 'image/jpeg')
    await expect(uploadAvatar('user-1', file)).rejects.toThrow('Napaka pri nalaganju slike')
  })
})

describe('deleteAvatarFile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStorageFrom.mockReturnValue({
      remove: mockRemove,
    })
    mockRemove.mockResolvedValue({ error: null })
  })

  it('does nothing for malformed URL (no avatars path segment)', async () => {
    // Should not throw, should log warn and return
    await expect(
      deleteAvatarFile('https://example.com/no-avatars-here/file.jpg')
    ).resolves.toBeUndefined()
    expect(mockRemove).not.toHaveBeenCalled()
  })

  it('does nothing for completely invalid URL string', async () => {
    await expect(deleteAvatarFile('not-a-url-at-all')).resolves.toBeUndefined()
    expect(mockRemove).not.toHaveBeenCalled()
  })

  it('correctly extracts path and calls remove for valid URL', async () => {
    const url =
      'https://xyz.supabase.co/storage/v1/object/public/avatars/user-1/test-uuid/avatar.jpg'
    await deleteAvatarFile(url)
    expect(mockRemove).toHaveBeenCalledWith(['user-1/test-uuid/avatar.jpg'])
  })

  it('does not throw when storage remove returns error (best-effort)', async () => {
    mockRemove.mockResolvedValue({ error: { message: 'File not found' } })
    const url =
      'https://xyz.supabase.co/storage/v1/object/public/avatars/user-1/uuid/avatar.jpg'
    await expect(deleteAvatarFile(url)).resolves.toBeUndefined()
  })
})

describe('updateProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockEq.mockReturnValue({ data: null, error: null })
    mockSingle.mockReturnValue({ data: { avatar_url: 'https://old-url.com/avatar.jpg' }, error: null })

    const selectChain = { eq: vi.fn().mockReturnValue({ single: mockSingle }) }
    const updateChain = { eq: mockEq }

    mockFrom.mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnValue(selectChain),
          update: vi.fn().mockReturnValue(updateChain),
        }
      }
      return {}
    })
  })

  it('returns old_avatar_url on success', async () => {
    mockSingle.mockReturnValue({ data: { avatar_url: 'https://old.com/avatar.jpg' }, error: null })
    mockEq.mockReturnValue({ error: null })

    const result = await updateProfile('user-1', { first_name: 'Ana' })
    expect(result).toEqual({ old_avatar_url: 'https://old.com/avatar.jpg' })
  })

  it('returns null for old_avatar_url when profile not found', async () => {
    mockSingle.mockReturnValue({ data: null, error: { message: 'Not found' } })
    mockEq.mockReturnValue({ error: null })

    const result = await updateProfile('nonexistent-user', { first_name: 'Ana' })
    expect(result).toEqual({ old_avatar_url: null })
  })

  it('throws when profile update fails', async () => {
    mockSingle.mockReturnValue({ data: { avatar_url: null }, error: null })
    mockEq.mockReturnValue({ error: { message: 'Update failed' } })

    await expect(
      updateProfile('user-1', { first_name: 'Ana' })
    ).rejects.toThrow('Napaka pri posodobitvi profila')
  })
})
