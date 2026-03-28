import { createClient } from '@/lib/supabase/client'
import type { MediaType, NewMediaItem } from '@/features/admin/types'

const STORAGE_BUCKET = 'post_media'

export interface UploadedMedia {
  url: string
  media_type: MediaType
  thumbnail_url: string | null
  order_index: number
  is_cover: boolean
}

/**
 * Generates a unique storage path for a file.
 * Format: posts/{postId}/{randomUUID}/{safeFileName}
 */
function generateStoragePath(postId: string, fileName: string): string {
  const uuid = crypto.randomUUID()
  const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
  return `posts/${postId}/${uuid}/${safeFileName}`
}

/**
 * Uploads a single file to Supabase Storage and returns its public URL.
 */
export async function uploadSingleFile(postId: string, file: File): Promise<string> {
  const supabase = createClient()
  const path = generateStoragePath(postId, file.name)

  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, {
    upsert: false,
  })

  if (error) {
    throw new Error(`Napaka pri nalaganju datoteke: ${error.message}`)
  }

  const { data: urlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path)
  return urlData.publicUrl
}

/**
 * Uploads all new media items to Supabase Storage in parallel.
 * Returns array of UploadedMedia in the same order as input.
 */
export async function uploadNewMediaItems(
  postId: string,
  newItems: NewMediaItem[]
): Promise<UploadedMedia[]> {
  if (newItems.length === 0) return []

  return Promise.all(
    newItems.map(async (item) => {
      const url = await uploadSingleFile(postId, item.file)
      return {
        url,
        media_type: item.media_type,
        thumbnail_url: null,
        order_index: item.order_index,
        is_cover: item.is_cover,
      } satisfies UploadedMedia
    })
  )
}

/**
 * Removes files from Supabase Storage by their public URLs.
 * Silently skips URLs that do not match the expected bucket path format.
 */
export async function removeStorageFiles(urls: string[]): Promise<void> {
  if (urls.length === 0) return

  const supabase = createClient()
  const marker = `/object/public/${STORAGE_BUCKET}/`

  const paths = urls
    .map((url) => {
      const idx = url.indexOf(marker)
      return idx !== -1 ? url.slice(idx + marker.length) : null
    })
    .filter((p): p is string => p !== null)

  if (paths.length === 0) return

  const { error } = await supabase.storage.from(STORAGE_BUCKET).remove(paths)
  if (error) {
    throw new Error(`Napaka pri brisanju datotek: ${error.message}`)
  }
}
