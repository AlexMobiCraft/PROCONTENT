import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  generateVideoThumbnail,
  ThumbnailGenerationError,
  THUMBNAIL_WIDTH,
  THUMBNAIL_HEIGHT,
} from '@/lib/media/generateVideoThumbnail'

interface FakeVideo {
  crossOrigin: string
  muted: boolean
  playsInline: boolean
  preload: string
  src: string
  duration: number
  currentTime: number
  onloadeddata: (() => void) | null
  onseeked: (() => void) | null
  onerror: (() => void) | null
  removeAttribute: ReturnType<typeof vi.fn>
  load: ReturnType<typeof vi.fn>
}

interface FakeCanvas {
  width: number
  height: number
  getContext: ReturnType<typeof vi.fn>
  toBlob: ReturnType<typeof vi.fn>
}

let fakeVideo: FakeVideo
let fakeCanvas: FakeCanvas
let getContextResult: unknown
let toBlobResult: Blob | null

function makeFile() {
  return new File(['video-bytes'], 'clip.mp4', { type: 'video/mp4' })
}

/** Прогоняет успешный жизненный цикл: loadeddata → seeked → drawFrame */
function driveHappyPath() {
  fakeVideo.onloadeddata?.()
  fakeVideo.onseeked?.()
}

describe('generateVideoThumbnail', () => {
  beforeEach(() => {
    fakeVideo = {
      crossOrigin: '',
      muted: false,
      playsInline: false,
      preload: '',
      src: '',
      duration: 10,
      currentTime: 0,
      onloadeddata: null,
      onseeked: null,
      onerror: null,
      removeAttribute: vi.fn(),
      load: vi.fn(),
    }

    getContextResult = { drawImage: vi.fn() }
    toBlobResult = new Blob(['image-bytes'], { type: 'image/jpeg' })

    fakeCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => getContextResult),
      toBlob: vi.fn((cb: (b: Blob | null) => void) => cb(toBlobResult)),
    }

    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'video') return fakeVideo as unknown as HTMLElement
      if (tag === 'canvas') return fakeCanvas as unknown as HTMLElement
      return {} as HTMLElement
    })

    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0)
      return 0
    })
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:fake-url'),
      revokeObjectURL: vi.fn(),
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('возвращает JPEG-blob из первого кадра File', async () => {
    const p = generateVideoThumbnail(makeFile())
    driveHappyPath()
    const blob = await p

    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('image/jpeg')
  })

  it('устанавливает crossOrigin="anonymous" для защиты canvas от CORS-taint', async () => {
    const p = generateVideoThumbnail(makeFile())
    driveHappyPath()
    await p

    expect(fakeVideo.crossOrigin).toBe('anonymous')
  })

  it('рисует на canvas в размере 640×360 по умолчанию', async () => {
    const p = generateVideoThumbnail(makeFile())
    driveHappyPath()
    await p

    expect(fakeCanvas.width).toBe(THUMBNAIL_WIDTH)
    expect(fakeCanvas.height).toBe(THUMBNAIL_HEIGHT)
  })

  it('сикает на 0.1s (не на нулевой кадр)', async () => {
    const p = generateVideoThumbnail(makeFile())
    driveHappyPath()
    await p

    expect(fakeVideo.currentTime).toBeCloseTo(0.1)
  })

  it('принимает URL-строку без создания ObjectURL', async () => {
    const p = generateVideoThumbnail('https://cdn.example.com/video.mp4')
    driveHappyPath()
    await p

    expect(URL.createObjectURL).not.toHaveBeenCalled()
    expect(fakeVideo.src).toBe('https://cdn.example.com/video.mp4')
  })

  it('освобождает ObjectURL после генерации (cleanup)', async () => {
    const p = generateVideoThumbnail(makeFile())
    driveHappyPath()
    await p

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake-url')
    expect(fakeVideo.load).toHaveBeenCalled()
  })

  it('отклоняется ThumbnailGenerationError при ошибке загрузки видео', async () => {
    const p = generateVideoThumbnail(makeFile())
    fakeVideo.onerror?.()
    await expect(p).rejects.toBeInstanceOf(ThumbnailGenerationError)
  })

  it('отклоняется если toBlob вернул null (tainted canvas)', async () => {
    toBlobResult = null
    const p = generateVideoThumbnail(makeFile())
    driveHappyPath()
    await expect(p).rejects.toBeInstanceOf(ThumbnailGenerationError)
  })

  it('отклоняется если 2D-контекст недоступен', async () => {
    getContextResult = null
    const p = generateVideoThumbnail(makeFile())
    driveHappyPath()
    await expect(p).rejects.toBeInstanceOf(ThumbnailGenerationError)
  })

  it('отклоняется по таймауту если видео не загрузилось', async () => {
    vi.useFakeTimers()
    try {
      const p = generateVideoThumbnail(makeFile()).catch((e) => e)
      await vi.advanceTimersByTimeAsync(15_000)
      const err = await p
      expect(err).toBeInstanceOf(ThumbnailGenerationError)
    } finally {
      vi.useRealTimers()
    }
  })
})
