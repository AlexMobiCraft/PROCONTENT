import { createClient } from '@/lib/supabase/client'
import { THUMBNAIL_MIME } from './generateVideoThumbnail'

/** Bucket для медиа постов (тот же, что и для основных файлов) */
const STORAGE_BUCKET = 'post_media'
/** Подпапка для thumbnail'ов внутри bucket */
const THUMBNAIL_PREFIX = 'thumbnails'

/**
 * Путь thumbnail в Storage: thumbnails/{post_media_id}_thumb.jpg (Story 8.1, AC 1).
 */
export function getThumbnailStoragePath(postMediaId: string): string {
  return `${THUMBNAIL_PREFIX}/${postMediaId}_thumb.jpg`
}

/**
 * Загружает thumbnail-blob в Storage и возвращает публичный URL.
 *
 * upsert=true обеспечивает идемпотентность: при повторной генерации старый
 * thumbnail перезаписывается (Story 8.1, Dev Notes — идемпотентность).
 *
 * @throws Error если blob не image/jpeg (защита) или upload не удался
 */
export async function uploadThumbnail(blob: Blob, postMediaId: string): Promise<string> {
  if (blob.type !== THUMBNAIL_MIME) {
    throw new Error(`Neveljaven tip slike za poster: ${blob.type || 'neznano'}`)
  }

  const supabase = createClient()
  const path = getThumbnailStoragePath(postMediaId)

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
