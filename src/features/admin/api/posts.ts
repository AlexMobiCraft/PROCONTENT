import { createClient } from '@/lib/supabase/client'
import type {
  EditorContentValue,
  ExistingMediaItem,
  MediaItem,
  NewMediaItem,
  PostFormValues,
  PostMetaState,
} from '@/features/admin/types'
import {
  MAX_LANDING_PREVIEW,
  MAX_MEDIA_FILES,
  MAX_ONBOARDING_POSTS,
} from '@/features/admin/types'
import { removeStorageFiles, uploadFilesWithTracking } from './uploadMedia'

export interface CreatePostInput {
  formValues: PostFormValues
  mediaItems: MediaItem[]
  authorId: string
  meta?: PostMetaState
  gallery?: MediaItem[]
  editor?: EditorContentValue
}

export interface UpdatePostInput {
  postId: string
  formValues: PostFormValues
  mediaItems: MediaItem[]
  originalMedia: ExistingMediaItem[]
  meta?: PostMetaState
  gallery?: MediaItem[]
  editor?: EditorContentValue
}

function derivePostType(items: MediaItem[]): string {
  if (items.length === 0) return 'text'

  const hasImages = items.some((item) => item.media_type === 'image')
  const hasVideos = items.some((item) => item.media_type === 'video')

  if (!hasImages && !hasVideos) return 'text'
  if (hasImages && hasVideos) return 'gallery'
  if (hasVideos) return items.length === 1 ? 'video' : 'multi-video'
  return items.length === 1 ? 'photo' : 'gallery'
}

function getPublishedTimestamp() {
  return new Date().toISOString()
}

function resolveGallery(input: { gallery?: MediaItem[]; mediaItems: MediaItem[] }) {
  return input.gallery ?? input.mediaItems
}

function resolveContent(input: {
  editor?: EditorContentValue
  formValues: PostFormValues
}) {
  return input.editor?.html ?? input.formValues.content ?? null
}

function resolveMeta(input: {
  meta?: PostMetaState
  formValues: PostFormValues
}) {
  const { meta, formValues } = input

  return {
    title: meta?.title ?? formValues.title,
    category: meta?.category ?? formValues.category,
    excerpt: meta?.excerpt ?? formValues.excerpt ?? null,
    is_landing_preview:
      meta?.is_landing_preview ?? formValues.is_landing_preview ?? false,
    is_onboarding: meta?.is_onboarding ?? formValues.is_onboarding ?? false,
    status: meta?.status ?? formValues.status ?? 'published',
    scheduled_at: meta?.scheduled_at ?? formValues.scheduled_at ?? null,
  }
}

async function validateCurationLimits(
  postId: string | null,
  meta: ReturnType<typeof resolveMeta>
) {
  const supabase = createClient()

  if (meta.is_landing_preview) {
    const { data: previewCount } = await supabase.rpc('count_landing_preview_posts', {
      exclude_id: postId,
    })

    if ((previewCount ?? 0) >= MAX_LANDING_PREVIEW) {
      throw new Error(
        `Največje število predogledov na začetni strani je ${MAX_LANDING_PREVIEW}. Najprej odstranite obstoječi predogled.`
      )
    }
  }

  if (meta.is_onboarding) {
    const { data: onboardingCount } = await supabase.rpc('count_onboarding_posts', {
      exclude_id: postId,
    })

    if ((onboardingCount ?? 0) >= MAX_ONBOARDING_POSTS) {
      throw new Error(
        `Največje število objav za uvajanje je ${MAX_ONBOARDING_POSTS}. Najprej odstranite obstoječo objavo.`
      )
    }
  }
}

export async function createPost(input: CreatePostInput): Promise<string> {
  const supabase = createClient()
  const gallery = resolveGallery(input)
  const meta = resolveMeta(input)
  const content = resolveContent(input)

  if (gallery.length > MAX_MEDIA_FILES) {
    throw new Error(`Prekoračena omejitev: največ ${MAX_MEDIA_FILES} datotek`)
  }

  await validateCurationLimits(null, meta)

  const isScheduled = meta.status === 'scheduled'

  const { data: post, error: postError } = await supabase
    .from('posts')
    .insert({
      title: meta.title,
      content,
      excerpt: meta.excerpt,
      category: meta.category,
      author_id: input.authorId,
      type: derivePostType(gallery),
      is_published: !isScheduled,
      status: isScheduled ? 'scheduled' : 'published',
      scheduled_at: isScheduled ? meta.scheduled_at : null,
      published_at: null,
      is_landing_preview: meta.is_landing_preview,
      is_onboarding: meta.is_onboarding,
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
    const newItems = gallery.filter(
      (item): item is NewMediaItem => item.kind === 'new'
    )
    const newFileUrls = await uploadFilesWithTracking(
      postId,
      newItems.map((item) => item.file),
      uploadedUrls
    )

    if (gallery.length > 0) {
      let newItemIndex = 0
      const postMediaPayload = gallery.map((item) => {
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
          url: newFileUrls[newItemIndex++],
          thumbnail_url: null,
          media_type: item.media_type,
          order_index: item.order_index,
          is_cover: item.is_cover,
        }
      })

      const { error: mediaError } = await supabase
        .from('post_media')
        .insert(postMediaPayload)

      if (mediaError) {
        throw new Error(`Napaka pri shranjevanju medijev: ${mediaError.message}`, {
          cause: mediaError,
        })
      }
    }

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
  } catch (error) {
    if (uploadedUrls.length > 0) {
      await removeStorageFiles(uploadedUrls).catch((rollbackError) => {
        console.warn(
          'Rollback: napaka pri brisanju datotek iz Storage:',
          rollbackError
        )
      })
    }

    await supabase.from('posts').delete().eq('id', postId)
    throw error
  }
}

export async function updatePost(input: UpdatePostInput): Promise<void> {
  const supabase = createClient()
  const gallery = resolveGallery(input)
  const meta = resolveMeta(input)
  const content = resolveContent(input)

  if (gallery.length > MAX_MEDIA_FILES) {
    throw new Error(`Prekoračena omejitev: največ ${MAX_MEDIA_FILES} datotek`)
  }

  await validateCurationLimits(input.postId, meta)

  const retainedIds = new Set(
    gallery
      .filter((item): item is ExistingMediaItem => item.kind === 'existing')
      .map((item) => item.id)
  )
  const removedItems = input.originalMedia.filter((item) => !retainedIds.has(item.id))
  const newItems = gallery.filter((item): item is NewMediaItem => item.kind === 'new')

  const uploadedUrls: string[] = []
  let textUpdated = false

  const { data: snapshot } = await supabase
    .from('posts')
    .select(
      'title, content, excerpt, category, type, is_landing_preview, is_onboarding, is_published, status, scheduled_at, published_at'
    )
    .eq('id', input.postId)
    .single()

  try {
    const updatePayload: Record<string, unknown> = {
      title: meta.title,
      content,
      excerpt: meta.excerpt,
      category: meta.category,
      type: derivePostType(gallery),
      is_landing_preview: meta.is_landing_preview,
      is_onboarding: meta.is_onboarding,
    }

    if (meta.status === 'scheduled' && snapshot?.published_at) {
      throw new Error('Objavljene objave ni mogoče ponovno načrtovati')
    }

    if (meta.status === 'scheduled') {
      updatePayload.status = 'scheduled'
      updatePayload.scheduled_at = meta.scheduled_at
      updatePayload.is_published = false
      updatePayload.published_at = null
    } else if (meta.status === 'draft') {
      updatePayload.status = 'draft'
      updatePayload.scheduled_at = null
      updatePayload.is_published = false
      updatePayload.published_at = null
    }

    const { error: updateError } = await supabase
      .from('posts')
      .update(updatePayload)
      .eq('id', input.postId)

    if (updateError) {
      throw new Error(`Napaka pri posodabljanju objave: ${updateError.message}`, {
        cause: updateError,
      })
    }

    textUpdated = true

    await uploadFilesWithTracking(
      input.postId,
      newItems.map((item) => item.file),
      uploadedUrls
    )

    const existingItems = gallery.filter(
      (item): item is ExistingMediaItem => item.kind === 'existing'
    )

    if (existingItems.length > 0) {
      const upsertPayload = existingItems.map((item) => ({
        id: item.id,
        post_id: input.postId,
        url: item.url,
        thumbnail_url: item.thumbnail_url,
        media_type: item.media_type,
        order_index: item.order_index,
        is_cover: item.is_cover,
      }))

      const { error: upsertError } = await supabase
        .from('post_media')
        .upsert(upsertPayload, { onConflict: 'id' })

      if (upsertError) {
        throw new Error(
          `Napaka pri posodabljanju vrstnega reda: ${upsertError.message}`,
          { cause: upsertError }
        )
      }
    }

    if (newItems.length > 0) {
      const newMediaPayload = newItems.map((item, index) => ({
        post_id: input.postId,
        url: uploadedUrls[index],
        thumbnail_url: null as string | null,
        media_type: item.media_type,
        order_index: item.order_index,
        is_cover: item.is_cover,
      }))

      const { error: insertError } = await supabase
        .from('post_media')
        .insert(newMediaPayload)

      if (insertError) {
        throw new Error(
          `Napaka pri shranjevanju novih medijev: ${insertError.message}`,
          { cause: insertError }
        )
      }
    }

    if (removedItems.length > 0) {
      const removedIds = removedItems.map((item) => item.id)
      const { error: deleteError } = await supabase
        .from('post_media')
        .delete()
        .in('id', removedIds)

      if (deleteError) {
        console.warn('Napaka pri brisanju starih medijev iz DB:', deleteError)
      }

      await removeStorageFiles(removedItems.map((item) => item.url)).catch(
        (removeError) => {
          console.warn(
            'Napaka pri brisanju starih datotek iz Storage:',
            removeError
          )
        }
      )
    }
  } catch (error) {
    if (uploadedUrls.length > 0) {
      await removeStorageFiles(uploadedUrls).catch((rollbackError) => {
        console.warn(
          'Rollback: napaka pri brisanju novih datotek iz Storage:',
          rollbackError
        )
      })
    }

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
        .eq('id', input.postId)

      if (rollbackError) {
        console.warn(
          'Rollback: napaka pri povrnitvi besedila objave:',
          rollbackError
        )
      }
    }

    throw error
  }
}

export async function deletePost(postId: string): Promise<void> {
  const supabase = createClient()

  const { data: mediaRows, error: mediaError } = await supabase
    .from('post_media')
    .select('url')
    .eq('post_id', postId)

  if (mediaError) {
    throw new Error(`Napaka pri pridobivanju medijev objave: ${mediaError.message}`, {
      cause: mediaError,
    })
  }

  const mediaUrls =
    mediaRows?.map((item) => item.url).filter((url): url is string => Boolean(url)) ??
    []

  const { error: deleteError } = await supabase.from('posts').delete().eq('id', postId)

  if (deleteError) {
    throw new Error(`Napaka pri brisanju objave: ${deleteError.message}`, {
      cause: deleteError,
    })
  }

  if (mediaUrls.length > 0) {
    await removeStorageFiles(mediaUrls).catch((error) => {
      console.warn('Napaka pri brisanju datotek objave iz Storage:', error)
    })
  }
}

export async function cancelScheduledPost(postId: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('posts')
    .update({ status: 'draft', scheduled_at: null })
    .eq('id', postId)

  if (error) {
    throw new Error(`Napaka pri preklicu objave: ${error.message}`, { cause: error })
  }
}

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
    throw new Error(`Objava ni bila najdena: ${error?.message ?? ''}`, {
      cause: error,
    })
  }

  return data
}
