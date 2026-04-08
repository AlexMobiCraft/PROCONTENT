import { createClient } from '@/lib/supabase/client'
import type { Post } from '@/features/feed/types'

function isPostArray(data: unknown): data is Post[] {
  return Array.isArray(data)
}

const SELECT_CLAUSE =
  '*, profiles!author_id(display_name, avatar_url), ' +
  'post_media(id, media_type, url, thumbnail_url, order_index, is_cover), ' +
  'is_liked:posts_is_liked'

async function runFts(
  supabase: ReturnType<typeof createClient>,
  query: string,
  signal?: AbortSignal
): Promise<Post[]> {
  let q = supabase
    .from('posts')
    .select(SELECT_CLAUSE)
    .eq('is_published', true)
    .textSearch('fts', query, { type: 'websearch', config: 'simple' })
    .order('created_at', { ascending: false })
    .limit(50)
  if (signal) q = q.abortSignal(signal)
  const { data, error } = await q
  if (error) throw error
  return isPostArray(data) ? data : []
}

async function runIlike(
  supabase: ReturnType<typeof createClient>,
  query: string,
  signal?: AbortSignal
): Promise<Post[]> {
  // Escaping order: backslash first, then ILIKE wildcards, then PostgREST .or() delimiters
  const escaped = query
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
    .replace(/[,()]/g, ' ')
  const pattern = `%${escaped}%`
  let q = supabase
    .from('posts')
    .select(SELECT_CLAUSE)
    .eq('is_published', true)
    .or(`title.ilike.${pattern},excerpt.ilike.${pattern}`)
    .order('created_at', { ascending: false })
    .limit(50)
  if (signal) q = q.abortSignal(signal)
  const { data, error } = await q
  if (error) throw error
  return isPostArray(data) ? data : []
}

/**
 * Поиск постов: FTS (полные слова) + ILIKE (подстроки в title/excerpt) параллельно.
 * При ошибке FTS — возвращает только ILIKE. Если оба упали — бросает ошибку.
 */
export async function searchPosts(
  query: string,
  options?: { signal?: AbortSignal }
): Promise<Post[]> {
  if (!query.trim()) return []

  const supabase = createClient()
  const signal = options?.signal

  const [ftsSettled, ilikeSettled] = await Promise.allSettled([
    runFts(supabase, query, signal),
    runIlike(supabase, query, signal),
  ])

  if (signal?.aborted) return []

  const ftsResults = ftsSettled.status === 'fulfilled' ? ftsSettled.value : []
  const ilikeResults = ilikeSettled.status === 'fulfilled' ? ilikeSettled.value : []

  if (ftsSettled.status === 'rejected' && ilikeSettled.status === 'rejected') {
    throw ftsSettled.reason ?? ilikeSettled.reason
  }

  // Merge: FTS результаты первыми, затем уникальные из ILIKE, итого не более 50
  const seen = new Set(ftsResults.map((p) => p.id))
  const unique = ilikeResults.filter((p) => !seen.has(p.id))
  return [...ftsResults, ...unique].slice(0, 50)
}
