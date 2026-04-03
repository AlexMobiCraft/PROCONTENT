import { createClient } from '@/lib/supabase/client'
import type { ExistingMediaItem, MediaItem, NewMediaItem, PostFormValues } from '@/features/admin/types'
import { MAX_MEDIA_FILES, MAX_LANDING_PREVIEW, MAX_ONBOARDING_POSTS } from '@/features/admin/types'
import { uploadFilesWithTracking, removeStorageFiles } from './uploadMedia'

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

  const hasImages = items.some((m) => m.media_type === 'image')
  const hasVideos = items.some((m) => m.media_type === 'video')

  // Defensive: if items exist but none are recognized image/video, treat as text
  if (!hasImages && !hasVideos) return 'text'

  if (hasImages && hasVideos) return 'gallery'
  if (hasVideos) return items.length === 1 ? 'video' : 'multi-video'
  return items.length === 1 ? 'photo' : 'gallery'
}

function getPublishedTimestamp(): string {
  return new Date().toISOString()
}

/**
 * Creates a new post with associated media.
 * Sequence: insert post → upload new files one-by-one (tracking URLs) → insert post_media rows
 * On any error after post creation: cleans up uploaded files and the post record.
 */
export async function createPost(input: CreatePostInput): Promise<string> {
  const supabase = createClient()
  const { formValues, mediaItems, authorId } = input

  if (mediaItems.length > MAX_MEDIA_FILES) {
    throw new Error(`Prekoračena omejitev: največ ${MAX_MEDIA_FILES} datotek`)
  }

  // Guard: landing preview limit
  if (formValues.is_landing_preview) {
    const { data: previewCount } = await supabase.rpc('count_landing_preview_posts', { exclude_id: null })
    if ((previewCount ?? 0) >= MAX_LANDING_PREVIEW) {
      throw new Error(`Največje število predogledov na začetni strani je ${MAX_LANDING_PREVIEW}. Najprej odstranite obstoječi predogled.`)
    }
  }

  // Guard: onboarding limit
  if (formValues.is_onboarding) {
    const { data: onboardingCount } = await supabase.rpc('count_onboarding_posts', { exclude_id: null })
    if ((onboardingCount ?? 0) >= MAX_ONBOARDING_POSTS) {
      throw new Error(`Največje število objav za uvajanje je ${MAX_ONBOARDING_POSTS}. Najprej odstranite obstoječo objavo.`)
    }
  }

  const isScheduled = formValues.status === 'scheduled'

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
      is_published: isScheduled ? false : true,
      status: isScheduled ? 'scheduled' : 'published',
      scheduled_at: isScheduled ? formValues.scheduled_at : null,
      published_at: null,
      is_landing_preview: formValues.is_landing_preview ?? false,
      is_onboarding: formValues.is_onboarding ?? false,
    })
    .select('id')
    .single()

  if (postError || !post) {
    throw new Error(
      `Napaka pri ustvarjanju objave: ${postError?.message ?? 'Neznan error'}`,
      { cause: postError }
    )
  }

  const postId = post.id
  const uploadedUrls: string[] = []

  try {
    // 2. Upload new files to Storage with controlled concurrency — track URLs for rollback
    const newItems = mediaItems.filter((m): m is NewMediaItem => m.kind === 'new')
    const newFileUrls = await uploadFilesWithTracking(
      postId,
      newItems.map((item) => item.file),
      uploadedUrls
    )

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
        return {
          post_id: postId,
          url: newFileUrls[newIdx++],
          thumbnail_url: null,
          media_type: item.media_type,
          order_index: item.order_index,
          is_cover: item.is_cover,
        }
      })

      const { error: mediaError } = await supabase.from('post_media').insert(postMediaPayload)
      if (mediaError) {
        throw new Error(`Napaka pri shranjevanju medijev: ${mediaError.message}`, { cause: mediaError })
      }
    }

    // Set published_at after all media is ready — reflects real publication moment
    // Skip for scheduled posts — published_at will be set by cron or manual publish
    if (!isScheduled) {
      const { error: publishedAtError } = await supabase
        .from('posts')
        .update({ published_at: getPublishedTimestamp() })
        .eq('id', postId)

      if (publishedAtError) {
        console.warn('Napaka pri posodobitvi published_at:', publishedAtError)
      }
    }

    return postId
  } catch (err) {
    // Rollback: remove individually tracked uploaded files, then delete the post record
    if (uploadedUrls.length > 0) {
      await removeStorageFiles(uploadedUrls).catch((e) => {
        console.warn('Rollback: napaka pri brisanju datotek iz Storage:', e)
      })
    }
    await supabase.from('posts').delete().eq('id', postId)
    throw err
  }
}

/**
 * Updates an existing post and its media.
 * Operation order ensures no data loss on failure:
 * 1. Snapshot current DB state (for rollback)
 * 2. Update text fields
 * 3. Upload new files (tracked for rollback)
 * 4. Upsert existing media (order_index/is_cover)
 * 5. Insert new post_media rows
 * 6. Delete removed media from DB + Storage (only after all DB ops succeed)
 */
export async function updatePost(input: UpdatePostInput): Promise<void> {
  const supabase = createClient()
  const { postId, formValues, mediaItems, originalMedia } = input

  if (mediaItems.length > MAX_MEDIA_FILES) {
    throw new Error(`Prekoračena omejitev: največ ${MAX_MEDIA_FILES} datotek`)
  }

  // Guard: landing preview limit (exclude current post from count since we're updating it)
  if (formValues.is_landing_preview) {
    const { data: previewCount } = await supabase.rpc('count_landing_preview_posts', { exclude_id: postId })
    if ((previewCount ?? 0) >= MAX_LANDING_PREVIEW) {
      throw new Error(`Največje število predogledov na začetni strani je ${MAX_LANDING_PREVIEW}. Najprej odstranite obstoječi predogled.`)
    }
  }

  // Guard: onboarding limit (exclude current post from count)
  if (formValues.is_onboarding) {
    const { data: onboardingCount } = await supabase.rpc('count_onboarding_posts', { exclude_id: postId })
    if ((onboardingCount ?? 0) >= MAX_ONBOARDING_POSTS) {
      throw new Error(`Največje število objav za uvajanje je ${MAX_ONBOARDING_POSTS}. Najprej odstranite obstoječo objavo.`)
    }
  }

  // Determine which original items have been removed
  const retainedIds = new Set(
    mediaItems
      .filter((m): m is ExistingMediaItem => m.kind === 'existing')
      .map((m) => m.id)
  )
  const removedItems = originalMedia.filter((m) => !retainedIds.has(m.id))

  const newItems = mediaItems.filter((m): m is NewMediaItem => m.kind === 'new')
  const uploadedUrls: string[] = []
  let textUpdated = false

  // 1. Snapshot current post state from DB for accurate rollback
  const { data: snapshot } = await supabase
    .from('posts')
    .select('title, content, excerpt, category, type, is_landing_preview, is_onboarding, is_published, status, scheduled_at, published_at')
    .eq('id', postId)
    .single()

  try {
    // 2. Update post text fields + type + curation flags + scheduling
    const updatePayload: Record<string, unknown> = {
      title: formValues.title,
      content: formValues.content ?? null,
      excerpt: formValues.excerpt ?? null,
      category: formValues.category,
      type: derivePostType(mediaItems),
      is_landing_preview: formValues.is_landing_preview ?? false,
      is_onboarding: formValues.is_onboarding ?? false,
    }

    // Include scheduling fields only when form provides status
    if (formValues.status) {
      // Guard: published posts cannot be re-scheduled (AC 2.6)
      if (formValues.status === 'scheduled' && snapshot?.published_at) {
        throw new Error('Objavljene objave ni mogoče ponovno načrtovati')
      }

      if (formValues.status === 'scheduled') {
        updatePayload.status = 'scheduled'
        updatePayload.scheduled_at = formValues.scheduled_at
        updatePayload.is_published = false
        updatePayload.published_at = null
      } else if (formValues.status === 'draft') {
        updatePayload.status = 'draft'
        updatePayload.scheduled_at = null
        updatePayload.is_published = false
        updatePayload.published_at = null
      }
      // status === 'published' is handled by the /api/posts/publish route handler
    }

    const { error: updateError } = await supabase
      .from('posts')
      .update(updatePayload)
      .eq('id', postId)

    if (updateError) {
      throw new Error(`Napaka pri posodabljanju objave: ${updateError.message}`, { cause: updateError })
    }
    textUpdated = true

    // 3. Upload new files (tracked for rollback)
    await uploadFilesWithTracking(
      postId,
      newItems.map((item) => item.file),
      uploadedUrls
    )

    // 4. Upsert existing media (order_index/is_cover) — single call
    const existingItems = mediaItems.filter((m): m is ExistingMediaItem => m.kind === 'existing')
    if (existingItems.length > 0) {
      const upsertPayload = existingItems.map((item) => ({
        id: item.id,
        post_id: postId,
        url: item.url,
        thumbnail_url: item.thumbnail_url,
        media_type: item.media_type,
        order_index: item.order_index,
        is_cover: item.is_cover,
      }))

      const { error } = await supabase
        .from('post_media')
        .upsert(upsertPayload, { onConflict: 'id' })

      if (error) {
        throw new Error(`Napaka pri posodabljanju vrstnega reda: ${error.message}`, { cause: error })
      }
    }

    // 5. Insert new post_media rows
    if (newItems.length > 0) {
      const newMediaPayload = newItems.map((item, idx) => ({
        post_id: postId,
        url: uploadedUrls[idx],
        thumbnail_url: null as string | null,
        media_type: item.media_type,
        order_index: item.order_index,
        is_cover: item.is_cover,
      }))

      const { error: insertError } = await supabase.from('post_media').insert(newMediaPayload)
      if (insertError) {
        throw new Error(`Napaka pri shranjevanju novih medijev: ${insertError.message}`, { cause: insertError })
      }
    }

    // 6. Delete removed media AFTER all DB ops succeed — prevents data loss on failure
    if (removedItems.length > 0) {
      const removedIds = removedItems.map((m) => m.id)
      const { error: deleteError } = await supabase
        .from('post_media')
        .delete()
        .in('id', removedIds)

      if (deleteError) {
        console.warn('Napaka pri brisanju starih medijev iz DB:', deleteError)
      }

      // Delete removed files from Storage (best-effort)
      await removeStorageFiles(removedItems.map((m) => m.url)).catch((e) => {
        console.warn('Napaka pri brisanju starih datotek iz Storage:', e)
      })
    }
  } catch (err) {
    // Rollback: remove newly uploaded files from Storage
    if (uploadedUrls.length > 0) {
      await removeStorageFiles(uploadedUrls).catch((e) => {
        console.warn('Rollback: napaka pri brisanju novih datotek iz Storage:', e)
      })
    }
    // Rollback: revert text fields using DB snapshot (not stale page data)
    if (textUpdated && snapshot) {
      const { error: rollbackError } = await supabase
        .from('posts')
        .update({
          title: snapshot.title,
          content: snapshot.content,
          excerpt: snapshot.excerpt,
          category: snapshot.category,
          type: snapshot.type,
          is_landing_preview: snapshot.is_landing_preview,
          is_onboarding: snapshot.is_onboarding,
          is_published: snapshot.is_published,
          status: snapshot.status,
          scheduled_at: snapshot.scheduled_at,
          published_at: snapshot.published_at,
        })
        .eq('id', postId)

      if (rollbackError) {
        console.warn('Rollback: napaka pri povrnitvi besedila objave:', rollbackError)
      }
    }
    throw err
  }
}

export async function deletePost(postId: string): Promise<void> {
  const supabase = createClient()

  const { data: mediaRows, error: mediaError } = await supabase
    .from('post_media')
    .select('url')
    .eq('post_id', postId)

  if (mediaError) {
    throw new Error(`Napaka pri pridobivanju medijev objave: ${mediaError.message}`, { cause: mediaError })
  }

  const mediaUrls = mediaRows?.map((item) => item.url).filter((url): url is string => Boolean(url)) ?? []

  const { error: deleteError } = await supabase.from('posts').delete().eq('id', postId)

  if (deleteError) {
    throw new Error(`Napaka pri brisanju objave: ${deleteError.message}`, { cause: deleteError })
  }

  if (mediaUrls.length > 0) {
    await removeStorageFiles(mediaUrls).catch((error) => {
      console.warn('Napaka pri brisanju datotek objave iz Storage:', error)
    })
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
      status,
      scheduled_at,
      published_at,
      is_landing_preview,
      is_onboarding,
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
    throw new Error(`Objava ni bila najdena: ${error?.message ?? ''}`, { cause: error })
  }

  return data
}
