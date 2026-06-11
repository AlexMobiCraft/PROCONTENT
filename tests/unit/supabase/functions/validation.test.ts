import { describe, it, expect } from 'vitest'
import {
  decodeJwtRole,
  assertServiceRole,
  assertAllowedVideoUrl,
  buildThumbnailPath,
  ThumbnailHttpError,
} from '../../../../supabase/functions/_shared/validation'
import { getThumbnailStoragePath } from '@/lib/media/uploadThumbnail'

const JWT_SECRET = 'test-secret-12345678901234567890123456789012'
const PUBLIC_URL = 'https://api.procontent.si'
const VALID_VIDEO_URL = `${PUBLIC_URL}/storage/v1/object/public/post_media/posts/p1/u/clip.mp4`

function base64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function encodeSegment(obj: unknown): string {
  return base64Url(new TextEncoder().encode(JSON.stringify(obj)))
}

async function signJwt(payload: Record<string, unknown>, secret = JWT_SECRET): Promise<string> {
  const header = encodeSegment({ alg: 'HS256', typ: 'JWT' })
  const body = encodeSegment(payload)
  const data = `${header}.${body}`
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  return `${data}.${base64Url(new Uint8Array(sig))}`
}

describe('buildThumbnailPath', () => {
  it('строит путь thumbnails/{id}_thumb.jpg', () => {
    expect(buildThumbnailPath('m1')).toBe('thumbnails/m1_thumb.jpg')
  })

  it('ИНВАРИАНТ: совпадает с getThumbnailStoragePath (Next.js)', () => {
    for (const id of ['m1', 'abc-123', '00000000-0000-0000-0000-000000000000']) {
      expect(buildThumbnailPath(id)).toBe(getThumbnailStoragePath(id))
    }
  })
})

describe('assertServiceRole', () => {
  it('пропускает service_role', () => {
    expect(() => assertServiceRole('service_role')).not.toThrow()
  })

  it('отклоняет обычного пользователя (403)', () => {
    try {
      assertServiceRole('authenticated')
      throw new Error('должно было бросить')
    } catch (err) {
      expect(err).toBeInstanceOf(ThumbnailHttpError)
      expect((err as ThumbnailHttpError).status).toBe(403)
    }
  })
})

describe('assertAllowedVideoUrl', () => {
  it('пропускает видео из public/post_media/posts/', () => {
    expect(() => assertAllowedVideoUrl(VALID_VIDEO_URL, PUBLIC_URL)).not.toThrow()
  })

  it('пропускает при trailing slash в publicUrl', () => {
    expect(() => assertAllowedVideoUrl(VALID_VIDEO_URL, `${PUBLIC_URL}/`)).not.toThrow()
  })

  it('отклоняет чужой домен (400)', () => {
    expect(() =>
      assertAllowedVideoUrl('https://evil.example.com/video.mp4', PUBLIC_URL)
    ).toThrow(ThumbnailHttpError)
  })

  it('отклоняет другой bucket (400)', () => {
    expect(() =>
      assertAllowedVideoUrl(
        `${PUBLIC_URL}/storage/v1/object/public/avatars/u1/avatar.png`,
        PUBLIC_URL
      )
    ).toThrow(ThumbnailHttpError)
  })

  it('отклоняет thumbnails-объект bucket post_media (не posts/)', () => {
    expect(() =>
      assertAllowedVideoUrl(
        `${PUBLIC_URL}/storage/v1/object/public/post_media/thumbnails/m1_thumb.jpg`,
        PUBLIC_URL
      )
    ).toThrow(ThumbnailHttpError)
  })

  it('отклоняет signed-путь', () => {
    expect(() =>
      assertAllowedVideoUrl(
        `${PUBLIC_URL}/storage/v1/object/sign/post_media/posts/p1/clip.mp4`,
        PUBLIC_URL
      )
    ).toThrow(ThumbnailHttpError)
  })

  it('отклоняет не-video расширение в posts/', () => {
    expect(() =>
      assertAllowedVideoUrl(
        `${PUBLIC_URL}/storage/v1/object/public/post_media/posts/p1/u/photo.jpg`,
        PUBLIC_URL
      )
    ).toThrow(ThumbnailHttpError)
  })

  it('игнорирует query-string при проверке расширения', () => {
    expect(() =>
      assertAllowedVideoUrl(`${VALID_VIDEO_URL}?token=abc`, PUBLIC_URL)
    ).not.toThrow()
  })

  it('бросает 500 при отсутствии publicUrl', () => {
    try {
      assertAllowedVideoUrl(VALID_VIDEO_URL, '')
      throw new Error('должно было бросить')
    } catch (err) {
      expect((err as ThumbnailHttpError).status).toBe(500)
    }
  })
})

describe('decodeJwtRole', () => {
  it('возвращает role при валидной HS256-подписи', async () => {
    const token = await signJwt({ role: 'service_role' })
    await expect(decodeJwtRole(`Bearer ${token}`, JWT_SECRET)).resolves.toBe('service_role')
  })

  it('читает role обычного пользователя (для последующего assertServiceRole)', async () => {
    const token = await signJwt({ role: 'authenticated', sub: 'user-1' })
    await expect(decodeJwtRole(`Bearer ${token}`, JWT_SECRET)).resolves.toBe('authenticated')
  })

  it('отклоняет подделанную подпись (401)', async () => {
    const token = await signJwt({ role: 'service_role' }, 'wrong-secret-000000000000000000000000')
    await expect(decodeJwtRole(`Bearer ${token}`, JWT_SECRET)).rejects.toMatchObject({
      status: 401,
    })
  })

  it('отклоняет отсутствие Authorization (401)', async () => {
    await expect(decodeJwtRole(null, JWT_SECRET)).rejects.toMatchObject({ status: 401 })
  })

  it('отклоняет не-Bearer заголовок (401)', async () => {
    await expect(decodeJwtRole('Basic abc', JWT_SECRET)).rejects.toMatchObject({ status: 401 })
  })

  it('отклоняет токен без role claim (403)', async () => {
    const token = await signJwt({ sub: 'user-1' })
    await expect(decodeJwtRole(`Bearer ${token}`, JWT_SECRET)).rejects.toMatchObject({
      status: 403,
    })
  })

  it('бросает 500 при отсутствии jwtSecret', async () => {
    const token = await signJwt({ role: 'service_role' })
    await expect(decodeJwtRole(`Bearer ${token}`, '')).rejects.toMatchObject({ status: 500 })
  })
})
