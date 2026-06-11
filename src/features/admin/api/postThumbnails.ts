import { uploadThumbnail } from '@/lib/media/uploadThumbnail'
import { updateThumbnailUrl } from '@/lib/media/updateThumbnailUrl'
import { removeStorageFiles } from './uploadMedia'
import type { NewMediaItem } from '@/features/admin/types'

export interface NewVideoThumbnailTask {
  item: NewMediaItem
  postMediaId: string
  videoUrl: string
}

export interface ThumbnailPipelineResult {
  expected: number
  persisted: number
  allPersisted: boolean
}

interface ThumbnailTaskOutcome {
  postMediaId: string
  persisted: boolean
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
): Promise<ThumbnailTaskOutcome> {
  try {
    if (signal.aborted) return { postMediaId, persisted: false }
    if (item.thumbnail_blob) {
      const url = await uploadThumbnail(item.thumbnail_blob, postMediaId)
      if (signal.aborted) {
        await removeStorageFiles([url]).catch(() => {})
        return { postMediaId, persisted: false }
      }
      try {
        await updateThumbnailUrl(postMediaId, url)
        return { postMediaId, persisted: true }
      } catch (updateErr) {
        await removeStorageFiles([url]).catch(() => {})
        throw updateErr
      }
    } else if (item.thumbnail_status === 'error') {
      // 200 от route = Edge Function уже persisted thumbnail_url (в пределах бюджета).
      // Не-ok/abort → requestThumbnailFallback бросает → persisted:false (catch ниже).
      await requestThumbnailFallback({ videoUrl, postMediaId }, signal)
      return { postMediaId, persisted: true }
    }
    return { postMediaId, persisted: false }
  } catch (err) {
    console.warn(`[thumbnails] Napaka za post_media ${postMediaId}:`, err)
    return { postMediaId, persisted: false }
  }
}

export async function applyNewVideoThumbnails(
  tasks: NewVideoThumbnailTask[],
  options: { budgetMs?: number } = {}
): Promise<ThumbnailPipelineResult> {
  if (tasks.length === 0) {
    return { expected: 0, persisted: 0, allPersisted: true }
  }

  const expected = tasks.length
  const budgetMs = options.budgetMs ?? THUMBNAIL_PIPELINE_BUDGET_MS
  const controller = new AbortController()
  const persistedIds = new Set<string>()

  const work = Promise.allSettled(
    tasks.map(async (task) => {
      const outcome = await runThumbnailTask(task, controller.signal)
      if (outcome.persisted) persistedIds.add(outcome.postMediaId)
    })
  )

  let timer: ReturnType<typeof setTimeout> | undefined
  const budget = new Promise<void>((resolve) => {
    timer = setTimeout(() => {
      controller.abort()
      resolve()
    }, budgetMs)
  })

  await Promise.race([work.finally(() => clearTimeout(timer)), budget])

  return {
    expected,
    persisted: persistedIds.size,
    allPersisted: persistedIds.size >= expected,
  }
}
