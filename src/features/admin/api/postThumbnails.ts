import { uploadThumbnail } from '@/lib/media/uploadThumbnail'
import { updateThumbnailUrl } from '@/lib/media/updateThumbnailUrl'
import type { NewMediaItem } from '@/features/admin/types'

/** Задача генерации thumbnail для одного нового видео после вставки post_media */
export interface NewVideoThumbnailTask {
  item: NewMediaItem
  /** id вставленной строки post_media */
  postMediaId: string
  /** публичный URL загруженного видео (для серверного fallback) */
  videoUrl: string
}

/** Минимум полей вставленной строки post_media, нужных для сопоставления */
interface InsertedMediaRow {
  id: string
  url: string
}

/**
 * Вызывает серверный fallback генерации thumbnail (Story 8.1, AC 4).
 * @throws при не-2xx ответе
 */
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

/**
 * Сопоставляет новые видео с вставленными строками post_media по URL и строит задачи.
 * newItems[i] ↔ uploadedUrls[i] (порядок гарантирует uploadFilesWithTracking).
 */
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

/**
 * Для каждого нового видео загружает сгенерированный Canvas-thumbnail в Storage и
 * обновляет thumbnail_url. Если Canvas-blob отсутствует (генерация не удалась) —
 * вызывает серверный fallback (Story 8.1, AC 4).
 *
 * Best-effort: ошибки логируются и НЕ прерывают сохранение публикации
 * (Story 8.1 — генерация thumbnail не блокирует сохранение).
 */
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
