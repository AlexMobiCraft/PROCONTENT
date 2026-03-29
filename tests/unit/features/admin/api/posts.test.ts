import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ExistingMediaItem, NewMediaItem, PostFormValues } from '@/features/admin/types'
import { MAX_MEDIA_FILES } from '@/features/admin/types'

const mockFrom = vi.fn()

// Build chainable query mock
function makeChain(result: unknown) {
  const chain = {
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockResolvedValue({ error: null }),
    delete: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
  }
  return chain
}

const mockUploadFilesWithTracking = vi.fn()
const mockRemoveStorageFiles = vi.fn()

vi.mock('@/features/admin/api/uploadMedia', () => ({
  uploadFilesWithTracking: (...args: unknown[]) => mockUploadFilesWithTracking(...args),
  removeStorageFiles: (...args: unknown[]) => mockRemoveStorageFiles(...args),
}))

let supabaseChain: ReturnType<typeof makeChain>

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: (...args: unknown[]) => {
      mockFrom(...args)
      return supabaseChain
    },
  }),
}))

import { createPost, updatePost, fetchPostForEdit } from '@/features/admin/api/posts'

const baseFormValues: PostFormValues = {
  title: 'Test Post',
  category: 'insight',
  content: 'Content here',
  excerpt: 'Short excerpt',
}

function makeExistingItem(id: string, orderIndex = 0): ExistingMediaItem {
  return {
    kind: 'existing',
    id,
    url: `https://cdn.example.com/posts/p1/uuid/${id}.jpg`,
    thumbnail_url: null,
    media_type: 'image',
    is_cover: orderIndex === 0,
    order_index: orderIndex,
  }
}

function makeNewItem(key: string, orderIndex = 0): NewMediaItem {
  return {
    kind: 'new',
    key,
    file: new File(['content'], `${key}.jpg`, { type: 'image/jpeg' }),
    preview_url: `blob:${key}`,
    media_type: 'image',
    is_cover: orderIndex === 0,
    order_index: orderIndex,
  }
}

describe('createPost', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUploadFilesWithTracking.mockImplementation(
      async (_postId: string, _files: File[], uploadedUrls: string[]) => {
        const urls = _files.map((_: File, i: number) => `https://cdn.example.com/file${i}.jpg`)
        uploadedUrls.push(...urls)
        return urls
      }
    )
    mockRemoveStorageFiles.mockResolvedValue(undefined)
  })

  it('creates post and returns post id', async () => {
    supabaseChain = makeChain({ data: { id: 'new-post-id' }, error: null })
    supabaseChain.single.mockResolvedValueOnce({ data: { id: 'new-post-id' }, error: null })
    supabaseChain.insert.mockReturnThis()

    const id = await createPost({
      formValues: baseFormValues,
      mediaItems: [],
      authorId: 'user-123',
    })
    expect(id).toBe('new-post-id')
  })

  it('throws when post insert fails', async () => {
    supabaseChain = makeChain({ data: null, error: { message: 'DB error' } })

    await expect(
      createPost({ formValues: baseFormValues, mediaItems: [], authorId: 'u1' })
    ).rejects.toThrow('Napaka pri ustvarjanju objave')
  })

  it('throws when media items exceed MAX_MEDIA_FILES', async () => {
    const tooMany = Array.from({ length: MAX_MEDIA_FILES + 1 }, (_, i) => makeNewItem(`k${i}`, i))

    await expect(
      createPost({ formValues: baseFormValues, mediaItems: tooMany, authorId: 'u1' })
    ).rejects.toThrow('Prekoračena omejitev')
  })

  it('не выбрасывает ошибку при ровно MAX_MEDIA_FILES файлах (граница)', async () => {
    supabaseChain = makeChain({ data: { id: 'post-boundary' }, error: null })
    supabaseChain.insert
      .mockReturnValueOnce(supabaseChain)
      .mockReturnValueOnce({ error: null })
    supabaseChain.single.mockResolvedValueOnce({ data: { id: 'post-boundary' }, error: null })

    const exactMax = Array.from({ length: MAX_MEDIA_FILES }, (_, i) => makeNewItem(`k${i}`, i))

    await expect(
      createPost({ formValues: baseFormValues, mediaItems: exactMax, authorId: 'u1' })
    ).resolves.toBe('post-boundary')
  })

  it('rollback удаляет частично загруженные файлы при ошибке в середине batch', async () => {
    supabaseChain = makeChain({ data: { id: 'post-partial' }, error: null })
    supabaseChain.insert.mockReturnValueOnce(supabaseChain)
    supabaseChain.single.mockResolvedValueOnce({ data: { id: 'post-partial' }, error: null })

    const uploadedUrls: string[] = []
    mockUploadFilesWithTracking.mockImplementation(
      async (_postId: string, _files: File[], trackedUrls: string[]) => {
        trackedUrls.push('https://cdn.example.com/file0.jpg')
        throw new Error('Upload failed mid-batch')
      }
    )

    const items = [makeNewItem('k0', 0), makeNewItem('k1', 1)]

    await expect(
      createPost({ formValues: baseFormValues, mediaItems: items, authorId: 'u1' })
    ).rejects.toThrow('Upload failed mid-batch')

    expect(mockRemoveStorageFiles).toHaveBeenCalled()
    void uploadedUrls
  })

  it('uploads new media items with concurrency after post created', async () => {
    supabaseChain = makeChain({ data: { id: 'post-1' }, error: null })
    supabaseChain.insert
      .mockReturnValueOnce(supabaseChain) // posts insert → chained
      .mockReturnValueOnce({ error: null }) // post_media insert → {error: null}
    supabaseChain.single.mockResolvedValueOnce({ data: { id: 'post-1' }, error: null })

    const newItem = makeNewItem('k1', 0)

    await createPost({
      formValues: baseFormValues,
      mediaItems: [newItem],
      authorId: 'u1',
    })

    expect(mockUploadFilesWithTracking).toHaveBeenCalledWith(
      'post-1',
      [newItem.file],
      expect.any(Array)
    )
  })
})

describe('fetchPostForEdit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns post data on success', async () => {
    const postData = {
      id: 'post-1',
      title: 'My Post',
      content: 'Content',
      excerpt: 'Excerpt',
      category: 'insight',
      type: 'photo',
      post_media: [
        { id: 'm1', url: 'https://cdn.example.com/m1.jpg', thumbnail_url: null, media_type: 'image', order_index: 0, is_cover: true },
      ],
    }
    supabaseChain = makeChain({ data: postData, error: null })

    const result = await fetchPostForEdit('post-1')
    expect(result.id).toBe('post-1')
    expect(result.post_media).toHaveLength(1)
  })

  it('throws when post not found', async () => {
    supabaseChain = makeChain({ data: null, error: { message: 'Not found' } })
    await expect(fetchPostForEdit('bad-id')).rejects.toThrow('Objava ni bila najdena')
  })
})

describe('updatePost', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUploadFilesWithTracking.mockImplementation(
      async (_postId: string, _files: File[], uploadedUrls: string[]) => {
        const urls = _files.map((_: File, i: number) => `https://cdn.example.com/new-file${i}.jpg`)
        uploadedUrls.push(...urls)
        return urls
      }
    )
    mockRemoveStorageFiles.mockResolvedValue(undefined)
    supabaseChain = makeChain({ data: null, error: null })
    // Snapshot select returns current post data
    supabaseChain.single.mockResolvedValue({
      data: { title: 'DB Title', content: 'DB Content', excerpt: null, category: 'cat', type: 'photo' },
      error: null,
    })
    supabaseChain.update.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
    supabaseChain.delete.mockReturnValue({ in: vi.fn().mockResolvedValue({ error: null }) })
  })

  it('deletes removed media only after all DB ops succeed', async () => {
    const original = [makeExistingItem('m1', 0), makeExistingItem('m2', 1)]
    const current = [makeExistingItem('m1', 0)]

    supabaseChain.update.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    })
    supabaseChain.delete.mockReturnValue({
      in: vi.fn().mockResolvedValue({ error: null }),
    })

    await updatePost({
      postId: 'p1',
      formValues: baseFormValues,
      mediaItems: current,
      originalMedia: original,
    })

    expect(mockRemoveStorageFiles).toHaveBeenCalledWith([original[1].url])
  })

  it('throws when post update fails', async () => {
    supabaseChain.update.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: { message: 'Update failed' } }),
    })

    await expect(
      updatePost({
        postId: 'p1',
        formValues: baseFormValues,
        mediaItems: [],
        originalMedia: [],
      })
    ).rejects.toThrow('Napaka pri posodabljanju objave')
  })

  it('throws when media items exceed MAX_MEDIA_FILES', async () => {
    const tooMany = Array.from({ length: MAX_MEDIA_FILES + 1 }, (_, i) => makeNewItem(`k${i}`, i))

    await expect(
      updatePost({
        postId: 'p1',
        formValues: baseFormValues,
        mediaItems: tooMany,
        originalMedia: [],
      })
    ).rejects.toThrow('Prekoračena omejitev')
  })

  it('snapshots DB state for rollback instead of using stale page data', async () => {
    // Snapshot returns current DB state
    supabaseChain.single.mockResolvedValueOnce({
      data: { title: 'Current DB Title', content: 'Current', excerpt: null, category: 'real', type: 'gallery' },
      error: null,
    })

    // Make text update succeed, then upload fail
    supabaseChain.update.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    })
    mockUploadFilesWithTracking.mockRejectedValueOnce(new Error('Upload failed'))

    const newItem = makeNewItem('k1', 0)

    await expect(
      updatePost({
        postId: 'p1',
        formValues: baseFormValues,
        mediaItems: [newItem],
        originalMedia: [],
      })
    ).rejects.toThrow('Upload failed')

    // Verify rollback was called with DB snapshot values (not stale page data)
    expect(supabaseChain.update).toHaveBeenCalledTimes(2) // update + rollback
  })
})
