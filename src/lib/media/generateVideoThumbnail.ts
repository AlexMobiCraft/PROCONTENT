/**
 * Генерация thumbnail (poster) из первого кадра видео на стороне браузера (Story 8.1).
 *
 * Это primary path: генерация выполняется в браузере автора сразу после добавления
 * видео в форму, что даёт мгновенный визуальный feedback и не требует серверных job'ов.
 *
 * Video-элемент использует crossOrigin="anonymous", чтобы Canvas не получил "tainted"
 * состояние при загрузке видео из Supabase Storage.
 */

/** Целевая ширина thumbnail в px */
export const THUMBNAIL_WIDTH = 640
/** Целевая высота thumbnail в px */
export const THUMBNAIL_HEIGHT = 360
/** Качество JPEG (0..1) */
export const THUMBNAIL_QUALITY = 0.85
/** Момент кадра в секундах — не 0, чтобы избежать чёрного первого кадра */
export const THUMBNAIL_SEEK_TIME = 0.1
/** MIME-тип результата */
export const THUMBNAIL_MIME = 'image/jpeg'
/** Максимальное время ожидания готовности видео (мс) */
const VIDEO_LOAD_TIMEOUT = 15_000

/** Ошибка генерации thumbnail (CORS-taint, неподдерживаемый формат, timeout) */
export class ThumbnailGenerationError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'ThumbnailGenerationError'
  }
}

export interface GenerateVideoThumbnailOptions {
  width?: number
  height?: number
  quality?: number
  seekTime?: number
}

/**
 * Создаёт JPEG-thumbnail из первого кадра видео.
 *
 * @param source File (локальный файл) или string (публичный URL видео)
 * @returns Blob типа image/jpeg
 * @throws ThumbnailGenerationError при CORS-taint, неподдерживаемом формате или timeout
 */
export async function generateVideoThumbnail(
  source: File | string,
  options: GenerateVideoThumbnailOptions = {}
): Promise<Blob> {
  const width = options.width ?? THUMBNAIL_WIDTH
  const height = options.height ?? THUMBNAIL_HEIGHT
  const quality = options.quality ?? THUMBNAIL_QUALITY
  const seekTime = options.seekTime ?? THUMBNAIL_SEEK_TIME

  const isFile = typeof source !== 'string'
  const objectUrl = isFile ? URL.createObjectURL(source) : null
  const src = objectUrl ?? (source as string)

  const video = document.createElement('video')
  // crossOrigin обязателен, иначе canvas станет tainted при URL из Storage
  video.crossOrigin = 'anonymous'
  video.muted = true
  video.playsInline = true
  video.preload = 'auto'

  const cleanup = () => {
    video.onloadeddata = null
    video.onseeked = null
    video.onerror = null
    video.removeAttribute('src')
    video.load()
    if (objectUrl) URL.revokeObjectURL(objectUrl)
  }

  try {
    return await new Promise<Blob>((resolve, reject) => {
      let settled = false

      const timeoutId = setTimeout(() => {
        fail('Časovna omejitev pri nalaganju videa')
      }, VIDEO_LOAD_TIMEOUT)

      function fail(message: string, cause?: unknown) {
        if (settled) return
        settled = true
        clearTimeout(timeoutId)
        reject(new ThumbnailGenerationError(message, { cause }))
      }

      function succeed(blob: Blob) {
        if (settled) return
        settled = true
        clearTimeout(timeoutId)
        resolve(blob)
      }

      function drawFrame() {
        if (settled) return
        try {
          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            fail('Canvas 2D kontekst ni na voljo')
            return
          }
          ctx.drawImage(video, 0, 0, width, height)
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                fail('Ustvarjanje slike ni uspelo')
                return
              }
              succeed(blob)
            },
            THUMBNAIL_MIME,
            quality
          )
        } catch (err) {
          // SecurityError при tainted canvas (CORS)
          fail('Ustvarjanje posterja ni uspelo (CORS)', err)
        }
      }

      video.onerror = () => fail('Videa ni mogoče naložiti (nepodprt format?)')

      video.onloadeddata = () => {
        try {
          const duration = Number.isFinite(video.duration) ? video.duration : 0
          const target = duration > 0 ? Math.min(seekTime, duration) : seekTime
          video.currentTime = target
        } catch (err) {
          fail('Premik na okvir ni uspel', err)
        }
      }

      video.onseeked = () => {
        // rAF гарантирует, что кадр отрисован перед чтением в canvas
        const raf =
          typeof requestAnimationFrame === 'function'
            ? requestAnimationFrame
            : (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0)
        raf(() => drawFrame())
      }

      // src присваиваем после навешивания обработчиков, чтобы не упустить события
      video.src = src
    })
  } finally {
    cleanup()
  }
}
