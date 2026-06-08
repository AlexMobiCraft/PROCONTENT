import { uploadThumbnail } from '@/lib/media/uploadThumbnail'
import { updateThumbnailUrl } from '@/lib/media/updateThumbnailUrl'
import { removeStorageFiles } from './uploadMedia'
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

const FALLBACK_FETCH_TIMEOUT_MS = 2000
const THUMBNAIL_PIPELINE_BUDGET_MS = 2500

async function requestThumbnailFallback(
  body: { videoUrl: string; postMediaId: string },
  externalSignal: AbortSignal
): Promise<void> {
  const controller = new AbortController()
  const abortFromExternal = () => controller.abort()
  if (externalSignal.aborted) {
    controller.abort()
  } else {
    externalSignal.addEventListener('abort', abortFromExternal, { once: true })
  }
  const timer = setTimeout(() => controller.abort(), FALLBACK_FETCH_TIMEOUT_MS)
  try {
    const res = await fetch('/api/admin/generate-thumbnail-fallback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    if (!res.ok) {
      throw new Error(`Fallback HTTP ${res.status}`)
    }
  } finally {
    clearTimeout(timer)
    externalSignal.removeEventListener('abort', abortFromExternal)
  }
}

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
    if (!row) {
      console.warn(
        `[thumbnails] Vrstice post_media za video ni mogoče najti (url=${videoUrl ?? 'neznano'}) — poster preskočen`
      )
      return
    }
    tasks.push({ item, postMediaId: row.id, videoUrl })
  })

  return tasks
}

async function runThumbnailTask(
  { item, postMediaId, videoUrl }: NewVideoThumbnailTask,
  signal: AbortSignal
): Promise<void> {
  try {
    if (signal.aborted) return
    if (item.thumbnail_blob) {
      const url = await uploadThumbnail(item.thumbnail_blob, postMediaId)
      if (signal.aborted) {
        await removeStorageFiles([url]).catch(() => {})
        return
      }
      try {
        await updateThumbnailUrl(postMediaId, url)
      } catch (updateErr) {
        await removeStorageFiles([url]).catch(() => {})
        throw updateErr
      }
    } else if (item.thumbnail_status === 'error') {
      await requestThumbnailFallback({ videoUrl, postMediaId }, signal)
    }
  } catch (err) {
    console.warn(`[thumbnails] Napaka za post_media ${postMediaId}:`, err)
  }
}

export async function applyNewVideoThumbnails(
  tasks: NewVideoThumbnailTask[],
  options: { budgetMs?: number } = {}
): Promise<void> {
  if (tasks.length === 0) return

  const budgetMs = options.budgetMs ?? THUMBNAIL_PIPELINE_BUDGET_MS
  const controller = new AbortController()
  const work = Promise.allSettled(
    tasks.map((task) => runThumbnailTask(task, controller.signal))
  )

  let timer: ReturnType<typeof setTimeout> | undefined
  const budget = new Promise<void>((resolve) => {
    timer = setTimeout(() => {
      controller.abort()
      resolve()
    }, budgetMs)
  })

  await Promise.race([work.finally(() => clearTimeout(timer)), budget])
}
