export const THUMBNAIL_WIDTH = 640
export const THUMBNAIL_HEIGHT = 360
export const THUMBNAIL_QUALITY = 0.85
export const THUMBNAIL_SEEK_TIME = 0.1
export const THUMBNAIL_MIME = 'image/jpeg'
export const VIDEO_LOAD_TIMEOUT = 15_000

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
  signal?: AbortSignal
}

export async function generateVideoThumbnail(
  source: File | string,
  options: GenerateVideoThumbnailOptions = {}
): Promise<Blob> {
  const width = options.width ?? THUMBNAIL_WIDTH
  const height = options.height ?? THUMBNAIL_HEIGHT
  const quality = options.quality ?? THUMBNAIL_QUALITY
  const seekTime = options.seekTime ?? THUMBNAIL_SEEK_TIME
  const signal = options.signal

  const isFile = typeof source !== 'string'
  const objectUrl = isFile ? URL.createObjectURL(source) : null
  const src = objectUrl ?? (source as string)

  const video = document.createElement('video')
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

      const onAbort = () => fail('Generiranje posterja prekinjeno')

      function fail(message: string, cause?: unknown) {
        if (settled) return
        settled = true
        clearTimeout(timeoutId)
        signal?.removeEventListener('abort', onAbort)
        reject(new ThumbnailGenerationError(message, { cause }))
      }

      function succeed(blob: Blob) {
        if (settled) return
        settled = true
        clearTimeout(timeoutId)
        signal?.removeEventListener('abort', onAbort)
        resolve(blob)
      }

      if (signal?.aborted) {
        fail('Generiranje posterja prekinjeno')
        return
      }
      signal?.addEventListener('abort', onAbort, { once: true })

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
          const vw = video.videoWidth
          const vh = video.videoHeight
          if (vw > 0 && vh > 0) {
            const targetRatio = width / height
            const videoRatio = vw / vh
            let sx = 0
            let sy = 0
            let sw = vw
            let sh = vh
            if (videoRatio > targetRatio) {
              sw = vh * targetRatio
              sx = (vw - sw) / 2
            } else if (videoRatio < targetRatio) {
              sh = vw / targetRatio
              sy = (vh - sh) / 2
            }
            ctx.drawImage(video, sx, sy, sw, sh, 0, 0, width, height)
          } else {
            ctx.drawImage(video, 0, 0, width, height)
          }
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
          const target = duration > 0 ? Math.min(seekTime, duration / 2) : seekTime
          video.currentTime = target
        } catch (err) {
          fail('Premik na okvir ni uspel', err)
        }
      }

      video.onseeked = () => {
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
