import { uploadThumbnail } from '@/lib/media/uploadThumbnail'
import { updateThumbnailUrl } from '@/lib/media/updateThumbnailUrl'
import type { NewMediaItem } from '@/features/admin/types'

export interface NewVideoThumbnailTask {
  item: NewMediaItem
  postMediaId: string
  videoUrl: string
}

interface InsertedMediaRow {
  id: string
  url: string
}

async function requestThumbnailFallback(body: {
  videoUrl: string
  postMediaId: string
}): Promise<void> {
  const res = await fetch('/api/admin/generate-thumbnail-fallback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    throw new Error(`Fallback HTTP ${res.status}`)
  }
}

// Сопоставляет новые видео с вставленными строками post_media по url (порядок
// newItems[i] ↔ uploadedUrls[i] гарантирует uploadFilesWithTracking).
export function buildVideoThumbnailTasks(
  newItems: NewMediaItem[],
  uploadedUrls: string[],
  insertedRows: InsertedMediaRow[]
): NewVideoThumbnailTask[] {
  const rowByUrl = new Map(insertedRows.map((row) => [row.url, row]))
  const tasks: NewVideoThumbnailTask[] = []

  newItems.forEach((item, index) => {
    if (item.media_type !== 'video') return
    const videoUrl = uploadedUrls[index]
    const row = videoUrl ? rowByUrl.get(videoUrl) : undefined
    if (row) {
      tasks.push({ item, postMediaId: row.id, videoUrl })
    }
  })

  return tasks
}

// Best-effort: ошибки логируются и НЕ прерывают сохранение публикации.
export async function applyNewVideoThumbnails(tasks: NewVideoThumbnailTask[]): Promise<void> {
  if (tasks.length === 0) return

  await Promise.allSettled(
    tasks.map(async ({ item, postMediaId, videoUrl }) => {
      try {
        if (item.thumbnail_blob) {
          const url = await uploadThumbnail(item.thumbnail_blob, postMediaId)
          await updateThumbnailUrl(postMediaId, url)
        } else {
          await requestThumbnailFallback({ videoUrl, postMediaId })
        }
      } catch (err) {
        console.warn(`[thumbnails] Napaka za post_media ${postMediaId}:`, err)
      }
    })
  )
}
