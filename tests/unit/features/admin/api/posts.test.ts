import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ExistingMediaItem, NewMediaItem, PostFormValues } from '@/features/admin/types'

const mockFrom = vi.fn()

// Build chainable query mock
function makeChain(result: unknown) {
  const chain = {
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
  }
  return chain
}

const mockUploadNewMediaItems = vi.fn()
const mockRemoveStorageFiles = vi.fn()

vi.mock('@/features/admin/api/uploadMedia', () => ({
  uploadNewMediaItems: (...args: unknown[]) => mockUploadNewMediaItems(...args),
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
    mockUploadNewMediaItems.mockResolvedValue([])
    mockRemoveStorageFiles.mockResolvedValue(undefined)
  })

  it('creates post and returns post id', async () => {
    supabaseChain = makeChain({ data: { id: 'new-post-id' }, error: null })
    supabaseChain.single.mockResolvedValueOnce({ data: { id: 'new-post-id' }, error: null })
    // Second call for post_media insert
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

  it('uploads new media items after post created', async () => {
    supabaseChain = makeChain({ data: { id: 'post-1' }, error: null })
    // First insert (posts): chain returns itself so .select().single() works
    supabaseChain.insert
      .mockReturnValueOnce(supabaseChain) // posts insert → chained
      .mockReturnValueOnce({ error: null }) // post_media insert → {error: null}
    supabaseChain.single.mockResolvedValueOnce({ data: { id: 'post-1' }, error: null })

    const newItem = makeNewItem('k1', 0)
    mockUploadNewMediaItems.mockResolvedValue([
      { url: 'https://cdn.example.com/file.jpg', media_type: 'image', thumbnail_url: null, order_index: 0, is_cover: true },
    ])

    await createPost({
      formValues: baseFormValues,
      mediaItems: [newItem],
      authorId: 'u1',
    })

    expect(mockUploadNewMediaItems).toHaveBeenCalledWith('post-1', [newItem])
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
    mockUploadNewMediaItems.mockResolvedValue([])
    mockRemoveStorageFiles.mockResolvedValue(undefined)
    supabaseChain = makeChain({ data: null, error: null })
    supabaseChain.update.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
    supabaseChain.delete.mockReturnValue({ in: vi.fn().mockResolvedValue({ error: null }) })
    supabaseChain.update.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }), error: null })
  })

  it('calls removeStorageFiles for deleted media', async () => {
    const original = [makeExistingItem('m1', 0), makeExistingItem('m2', 1)]
    // Keep only m1 — m2 should be deleted
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
})
