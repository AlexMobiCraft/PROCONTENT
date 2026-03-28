import { createClient } from '@/lib/supabase/client'
import type { ExistingMediaItem, MediaItem, NewMediaItem, PostFormValues } from '@/features/admin/types'
import { uploadNewMediaItems, removeStorageFiles } from './uploadMedia'

export interface CreatePostInput {
  formValues: PostFormValues
  mediaItems: MediaItem[]
  authorId: string
}

export interface UpdatePostInput {
  postId: string
  formValues: PostFormValues
  mediaItems: MediaItem[]
  originalMedia: ExistingMediaItem[]
}

/** Derives `posts.type` from the media items in the form state */
function derivePostType(items: MediaItem[]): string {
  if (items.length === 0) return 'text'
  if (items.length === 1) return items[0].media_type === 'video' ? 'video' : 'photo'
  return items.every((m) => m.media_type === 'video') ? 'multi-video' : 'gallery'
}

/**
 * Creates a new post with associated media.
 * Sequence: insert post → upload new files → insert post_media rows
 * On any error after post creation: attempts to roll back the post record.
 */
export async function createPost(input: CreatePostInput): Promise<string> {
  const supabase = createClient()
  const { formValues, mediaItems, authorId } = input

  // 1. Insert post record
  const { data: post, error: postError } = await supabase
    .from('posts')
    .insert({
      title: formValues.title,
      content: formValues.content ?? null,
      excerpt: formValues.excerpt ?? null,
      category: formValues.category,
      author_id: authorId,
      type: derivePostType(mediaItems),
      is_published: true,
    })
    .select('id')
    .single()

  if (postError || !post) {
    throw new Error(
      `Napaka pri ustvarjanju objave: ${postError?.message ?? 'Neznan error'}`
    )
  }

  const postId = post.id

  try {
    // 2. Upload new files to Storage
    const newItems = mediaItems.filter((m): m is NewMediaItem => m.kind === 'new')
    const uploadedMedia = await uploadNewMediaItems(postId, newItems)

    // 3. Build post_media payload — preserve order from mediaItems array
    if (mediaItems.length > 0) {
      let newIdx = 0
      const postMediaPayload = mediaItems.map((item) => {
        if (item.kind === 'existing') {
          return {
            post_id: postId,
            url: item.url,
            thumbnail_url: item.thumbnail_url,
            media_type: item.media_type,
            order_index: item.order_index,
            is_cover: item.is_cover,
          }
        }
        const uploaded = uploadedMedia[newIdx++]
        return {
          post_id: postId,
          url: uploaded.url,
          thumbnail_url: uploaded.thumbnail_url,
          media_type: item.media_type,
          order_index: item.order_index,
          is_cover: item.is_cover,
        }
      })

      const { error: mediaError } = await supabase.from('post_media').insert(postMediaPayload)
      if (mediaError) {
        throw new Error(`Napaka pri shranjevanju medijev: ${mediaError.message}`)
      }
    }

    return postId
  } catch (err) {
    // Rollback: delete the post record
    await supabase.from('posts').delete().eq('id', postId)
    throw err
  }
}

/**
 * Updates an existing post and its media.
 * Handles: updating text fields, deleting removed media from DB + Storage,
 * uploading new files, updating order_index/is_cover for retained items.
 */
export async function updatePost(input: UpdatePostInput): Promise<void> {
  const supabase = createClient()
  const { postId, formValues, mediaItems, originalMedia } = input

  // Determine which original items have been removed
  const retainedIds = new Set(
    mediaItems
      .filter((m): m is ExistingMediaItem => m.kind === 'existing')
      .map((m) => m.id)
  )
  const removedItems = originalMedia.filter((m) => !retainedIds.has(m.id))

  // 1. Update post text fields + type
  const { error: updateError } = await supabase
    .from('posts')
    .update({
      title: formValues.title,
      content: formValues.content ?? null,
      excerpt: formValues.excerpt ?? null,
      category: formValues.category,
      type: derivePostType(mediaItems),
    })
    .eq('id', postId)

  if (updateError) {
    throw new Error(`Napaka pri posodabljanju objave: ${updateError.message}`)
  }

  // 2. Delete removed media rows from DB
  if (removedItems.length > 0) {
    const removedIds = removedItems.map((m) => m.id)
    const { error: deleteError } = await supabase
      .from('post_media')
      .delete()
      .in('id', removedIds)

    if (deleteError) {
      throw new Error(`Napaka pri brisanju medijev: ${deleteError.message}`)
    }

    // 3. Delete removed files from Storage
    await removeStorageFiles(removedItems.map((m) => m.url))
  }

  // 4. Upload new files
  const newItems = mediaItems.filter((m): m is NewMediaItem => m.kind === 'new')
  const uploadedMedia =
    newItems.length > 0 ? await uploadNewMediaItems(postId, newItems) : []

  // 5. Update order_index + is_cover for retained existing items
  const existingItems = mediaItems.filter((m): m is ExistingMediaItem => m.kind === 'existing')
  await Promise.all(
    existingItems.map((item) =>
      supabase
        .from('post_media')
        .update({ order_index: item.order_index, is_cover: item.is_cover })
        .eq('id', item.id)
    )
  )

  // 6. Insert new post_media rows
  if (uploadedMedia.length > 0) {
    const newMediaPayload = newItems.map((item, idx) => ({
      post_id: postId,
      url: uploadedMedia[idx].url,
      thumbnail_url: null as string | null,
      media_type: item.media_type,
      order_index: item.order_index,
      is_cover: item.is_cover,
    }))

    const { error: insertError } = await supabase.from('post_media').insert(newMediaPayload)
    if (insertError) {
      throw new Error(`Napaka pri shranjevanju novih medijev: ${insertError.message}`)
    }
  }
}

/**
 * Fetches a post with its media for pre-filling the edit form.
 * Uses client-side Supabase (called from 'use client' component).
 */
export async function fetchPostForEdit(postId: string) {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('posts')
    .select(
      `
      id,
      title,
      content,
      excerpt,
      category,
      type,
      post_media (
        id,
        url,
        thumbnail_url,
        media_type,
        order_index,
        is_cover
      )
    `
    )
    .eq('id', postId)
    .single()

  if (error || !data) {
    throw new Error(`Objava ni bila najdena: ${error?.message ?? ''}`)
  }

  return data
}
