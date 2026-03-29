import { createClient } from '@/lib/supabase/client'
import type { MediaType } from '@/features/admin/types'

const STORAGE_BUCKET = 'post_media'

export interface UploadedMedia {
  url: string
  media_type: MediaType
  thumbnail_url: string | null
  order_index: number
  is_cover: boolean
}

export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // Fallback for non-secure contexts — use getRandomValues when available
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16)
    crypto.getRandomValues(bytes)
    bytes[6] = (bytes[6] & 0x0f) | 0x40 // version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80 // variant 10
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  }
  // Last resort fallback (e.g., very old browsers)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

/**
 * Generates a unique storage path for a file.
 * Format: posts/{postId}/{randomUUID}/{safeFileName}
 */
function generateStoragePath(postId: string, fileName: string): string {
  const uuid = generateUUID()
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

/** Max number of concurrent file uploads to avoid rate limiting */
const UPLOAD_CONCURRENCY = 3

/**
 * Uploads files with controlled concurrency, tracking each URL for rollback.
 * Returns uploaded URLs in same order as input files.
 */
export async function uploadFilesWithTracking(
  postId: string,
  files: File[],
  uploadedUrls: string[]
): Promise<string[]> {
  const results: string[] = []

  for (let i = 0; i < files.length; i += UPLOAD_CONCURRENCY) {
    const batch = files.slice(i, i + UPLOAD_CONCURRENCY)
    const batchUrls = await Promise.all(
      batch.map((file) => uploadSingleFile(postId, file))
    )
    results.push(...batchUrls)
    uploadedUrls.push(...batchUrls)
  }

  return results
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
