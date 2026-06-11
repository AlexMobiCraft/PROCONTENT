import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// server-only бросает при импорте вне серверного окружения — глушим для unit-теста.
vi.mock('server-only', () => ({}))

import { requestServerThumbnail, ServerThumbnailError } from '@/lib/media/serverThumbnail'

const FUNCTIONS_URL = 'https://api.procontent.si/functions/v1'
const SERVICE_KEY = 'service-role-key'

describe('requestServerThumbnail', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://api.procontent.si')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', SERVICE_KEY)
    vi.stubEnv('SUPABASE_FUNCTIONS_URL', '')
    vi.stubEnv('SERVER_THUMBNAIL_TIMEOUT_MS', '')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('POST-ит на …/functions/v1/generate-thumbnail с Bearer и snake_case body, возвращает thumbnail_url', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ thumbnail_url: 'https://cdn/thumbnails/m1_thumb.jpg' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await requestServerThumbnail({
      postMediaId: 'm1',
      videoUrl: 'https://api.procontent.si/storage/v1/object/public/post_media/posts/p1/clip.mp4',
    })

    expect(result).toEqual({ thumbnail_url: 'https://cdn/thumbnails/m1_thumb.jpg' })
    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toBe(`${FUNCTIONS_URL}/generate-thumbnail`)
    expect(opts.method).toBe('POST')
    expect(opts.headers.Authorization).toBe(`Bearer ${SERVICE_KEY}`)
    expect(JSON.parse(opts.body)).toEqual({
      post_media_id: 'm1',
      video_url: 'https://api.procontent.si/storage/v1/object/public/post_media/posts/p1/clip.mp4',
    })
  })

  it('использует SUPABASE_FUNCTIONS_URL когда задан', async () => {
    vi.stubEnv('SUPABASE_FUNCTIONS_URL', 'https://edge.example.com/functions/v1')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ thumbnail_url: 'https://cdn/t.jpg' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await requestServerThumbnail({ postMediaId: 'm1', videoUrl: 'https://x/v.mp4' })

    expect(fetchMock.mock.calls[0][0]).toBe('https://edge.example.com/functions/v1/generate-thumbnail')
  })

  it('бросает ServerThumbnailError со статусом при не-ok ответе', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        json: async () => ({ error: 'engine failed' }),
      })
    )

    await expect(
      requestServerThumbnail({ postMediaId: 'm1', videoUrl: 'https://x/v.mp4' })
    ).rejects.toMatchObject({ name: 'ServerThumbnailError', status: 502 })
  })

  it('бросает ServerThumbnailError при ответе без thumbnail_url', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })
    )

    await expect(
      requestServerThumbnail({ postMediaId: 'm1', videoUrl: 'https://x/v.mp4' })
    ).rejects.toBeInstanceOf(ServerThumbnailError)
  })

  it('бросает понятную ошибку конфигурации при отсутствии env (вне try/catch)', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
    vi.stubEnv('SUPABASE_FUNCTIONS_URL', '')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      requestServerThumbnail({ postMediaId: 'm1', videoUrl: 'https://x/v.mp4' })
    ).rejects.toThrow(/Manjkajo okoljske spremenljivke/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('пробрасывает внешний AbortSignal в fetch (отмена по бюджету)', async () => {
    let captured: AbortSignal | undefined
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, opts: { signal?: AbortSignal }) => {
        captured = opts.signal
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ thumbnail_url: 'x' }) })
      })
    )

    const external = new AbortController()
    external.abort()
    await requestServerThumbnail({ postMediaId: 'm1', videoUrl: 'https://x/v.mp4' }, external.signal)

    expect(captured?.aborted).toBe(true)
  })
})
