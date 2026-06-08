export const THUMBNAIL_WIDTH = 640
export const THUMBNAIL_HEIGHT = 360
export const THUMBNAIL_QUALITY = 0.85
export const THUMBNAIL_SEEK_TIME = 0.1
export const THUMBNAIL_MIME = 'image/jpeg'
const VIDEO_LOAD_TIMEOUT = 15_000

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

      video.src = src
    })
  } finally {
    cleanup()
  }
}
