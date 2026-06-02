import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { compressAvatar } from '@/features/profile/lib/compressAvatar'

// --- Хелперы ---------------------------------------------------------------

/** Файл > 256 КБ (триггерит сжатие) без аллокации реальных байтов. */
function bigFile(type = 'image/jpeg', name = 'photo.jpg'): File {
  const f = new File([new Uint8Array(8)], name, { type })
  Object.defineProperty(f, 'size', { value: 300 * 1024 })
  return f
}

/** Реальный Blob заданного размера и типа (для детерминированного blob.size). */
function blobOf(bytes: number, type: string): Blob {
  return new Blob([new Uint8Array(bytes)], { type })
}

const TARGET = 200 * 1024

// Подменяемая реализация toBlob: (type, quality) => Blob | null
let toBlobImpl: (type: string, quality: number) => Blob | null
let closeMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  closeMock = vi.fn()

  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(async () => ({ width: 1000, height: 800, close: closeMock }))
  )

  // jsdom не реализует canvas — стабим getContext и toBlob.
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    drawImage: vi.fn(),
    fillRect: vi.fn(),
    fillStyle: '',
  })) as unknown as HTMLCanvasElement['getContext']

  HTMLCanvasElement.prototype.toBlob = function (
    callback: BlobCallback,
    type?: string,
    quality?: number
  ) {
    callback(toBlobImpl(type as string, quality as number))
  }

  // По умолчанию: webp всегда укладывается в target.
  toBlobImpl = (type) => blobOf(150 * 1024, type)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// --- Тесты -----------------------------------------------------------------

describe('compressAvatar', () => {
  it('возвращает файл без изменений, если ≤ 256 КБ (no-op)', async () => {
    const small = new File([new Uint8Array(8)], 'small.png', { type: 'image/png' })
    Object.defineProperty(small, 'size', { value: 100 * 1024 })

    const result = await compressAvatar(small)

    expect(result).toBe(small)
    expect(createImageBitmap).not.toHaveBeenCalled()
  })

  it('бросает ошибку, если Canvas недоступен и файл > 256 КБ', async () => {
    vi.stubGlobal('createImageBitmap', undefined)

    await expect(compressAvatar(bigFile())).rejects.toThrow(
      'Vaš brskalnik ne podpira obdelave slik'
    )
  })

  it('подбирает качество и останавливается на первом blob ≤ 200 КБ', async () => {
    const toBlob = vi.fn((type: string, q: number) =>
      q >= 0.8 ? blobOf(300 * 1024, type) : blobOf(150 * 1024, type)
    )
    toBlobImpl = toBlob

    const result = await compressAvatar(bigFile())

    expect(result.type).toBe('image/webp')
    expect(result.name).toBe('photo.webp')
    // q=0.8 (велик) → продолжили; q=0.7 (≤target) → остановились
    expect(toBlob).toHaveBeenCalledWith('image/webp', 0.8)
    expect(toBlob).toHaveBeenCalledWith('image/webp', 0.7)
    expect(result.size).toBeLessThanOrEqual(TARGET)
  })

  it('фолбэк на JPEG, если WebP не поддержан (toBlob → null)', async () => {
    toBlobImpl = (type) => (type === 'image/webp' ? null : blobOf(150 * 1024, type))

    const result = await compressAvatar(bigFile('image/png', 'avatar.png'))

    expect(result.type).toBe('image/jpeg')
    expect(result.name).toBe('avatar.jpg')
  })

  it('сохраняет PNG, если браузер отдал image/png вместо WebP (ext по типу)', async () => {
    // Старый браузер: toBlob('image/webp') молча возвращает PNG-blob, не null.
    toBlobImpl = () => blobOf(150 * 1024, 'image/png')

    const result = await compressAvatar(bigFile('image/png', 'avatar.png'))

    expect(result.type).toBe('image/png')
    expect(result.name).toBe('avatar.png')
  })

  it('бросает ошибку при битом/неподдерживаемом декоде', async () => {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => {
        throw new Error('decode failed')
      })
    )

    await expect(compressAvatar(bigFile())).rejects.toThrow('Slike ni bilo mogoče obdelati')
  })

  it('освобождает ImageBitmap через close() после сжатия', async () => {
    await compressAvatar(bigFile())
    expect(closeMock).toHaveBeenCalledTimes(1)
  })
})
