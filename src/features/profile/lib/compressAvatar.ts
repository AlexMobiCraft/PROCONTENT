'use client'

/**
 * Клиентское сжатие аватара через Canvas API.
 *
 * Изображения > 256 КБ центрируются и обрезаются (center-crop) в квадрат
 * 512×512, затем кодируются в WebP (фолбэк JPEG) с подбором качества под
 * целевой вес ~200 КБ. Файлы ≤ 256 КБ возвращаются без изменений.
 *
 * Без npm-зависимостей и серверных вызовов.
 */

const MAX_DIMENSION = 512
const TARGET_BYTES = 200 * 1024
const COMPRESS_THRESHOLD = 256 * 1024
const QUALITY_STEPS = [0.8, 0.7, 0.6, 0.5]

/** Промисификация callback-based canvas.toBlob. */
function blobFromCanvas(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality)
  })
}

/** Заменяет расширение в имени файла (avatar.png → avatar.webp). */
function replaceExt(fileName: string, ext: string): string {
  const base = fileName.replace(/\.[^./\\]+$/, '')
  return `${base}.${ext}`
}

/**
 * Сжимает изображение до center-crop квадрата 512×512 / ~200 КБ.
 * Возвращает исходный файл, если он ≤ 256 КБ.
 *
 * @throws при отсутствии поддержки Canvas (для файлов > 256 КБ) или ошибке декода.
 */
export async function compressAvatar(file: File): Promise<File> {
  // Мелкие файлы не сжимаем — грузим как есть.
  if (file.size <= COMPRESS_THRESHOLD) {
    return file
  }

  // Без Canvas НЕ заливаем большой файл молча — явный отказ.
  if (typeof createImageBitmap !== 'function') {
    throw new Error('Vaš brskalnik ne podpira obdelave slik')
  }

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch (cause) {
    throw new Error('Slike ni bilo mogoče obdelati', { cause })
  }

  try {
    const canvas = document.createElement('canvas')
    canvas.width = MAX_DIMENSION
    canvas.height = MAX_DIMENSION

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('Slike ni bilo mogoče obdelati')
    }

    // Center-crop (cover): берём квадрат по меньшей стороне, чтобы результат
    // совпадал с круглым object-cover дисплеем аватара.
    // Заливаем фон белым: JPEG-фолбэк не поддерживает альфу (иначе прозрачные
    // области стали бы чёрными), а для WebP — предсказуемый фон вместо прозрачности.
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, MAX_DIMENSION, MAX_DIMENSION)

    const side = Math.min(bitmap.width, bitmap.height)
    const sx = (bitmap.width - side) / 2
    const sy = (bitmap.height - side) / 2
    ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, MAX_DIMENSION, MAX_DIMENSION)

    let last: Blob | null = null
    for (const quality of QUALITY_STEPS) {
      const blob =
        (await blobFromCanvas(canvas, 'image/webp', quality)) ??
        (await blobFromCanvas(canvas, 'image/jpeg', quality))

      if (blob && blob.size <= TARGET_BYTES) {
        return blobToFile(blob, file.name)
      }
      last = blob
    }

    if (!last) {
      throw new Error('Slike ni bilo mogoče obdelati')
    }
    return blobToFile(last, file.name)
  } finally {
    bitmap.close()
  }
}

/** Расширение по реальному MIME-типу blob (браузер мог отдать PNG вместо WebP). */
const MIME_EXT: Record<string, string> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png',
}

/** Оборачивает Blob в File с расширением, соответствующим его реальному MIME-типу. */
function blobToFile(blob: Blob, originalName: string): File {
  const ext = MIME_EXT[blob.type] ?? 'jpg'
  return new File([blob], replaceExt(originalName, ext), { type: blob.type })
}
