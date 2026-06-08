import { createClient } from '@/lib/supabase/client'
import { THUMBNAIL_MIME } from './generateVideoThumbnail'

const STORAGE_BUCKET = 'post_media'
const THUMBNAIL_PREFIX = 'thumbnails'

export function getThumbnailStoragePath(postMediaId: string): string {
  return `${THUMBNAIL_PREFIX}/${postMediaId}_thumb.jpg`
}

export async function uploadThumbnail(blob: Blob, postMediaId: string): Promise<string> {
  if (blob.type !== THUMBNAIL_MIME) {
    throw new Error(`Neveljaven tip slike za poster: ${blob.type || 'neznano'}`)
  }

  const supabase = createClient()
  const path = getThumbnailStoragePath(postMediaId)

  // upsert: повторная генерация перезаписывает старый thumbnail
  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, blob, {
    contentType: THUMBNAIL_MIME,
    upsert: true,
    cacheControl: '3600',
  })

  if (error) {
    throw new Error(`Napaka pri nalaganju posterja: ${error.message}`, { cause: error })
  }

  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path)
  return data.publicUrl
}
