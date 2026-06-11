// Извлечение ОДНОГО кадра видео в JPEG 640×360 средствами ffmpeg.wasm (single-thread).
//
// ⚠️ Это движок (Story 8.5, Subtask 1.0/1.3), который верифицируется и тюнингуется
// на стенде (supabase/edge-runtime). HTTP-контракт и оркестрация (index.ts) от него
// НЕ зависят: при нестабильности ffmpeg.wasm движок заменяется escape hatch'ем
// (Вариант C — внешний Node+ffmpeg-static сервис) без изменения вызывающих сторон.
//
// Single-thread: НЕ требует SharedArrayBuffer/потоков. Извлекаем ровно один кадр
// (-ss 0.1 -frames:v 1), не декодируя всё видео; cover-crop без искажения aspect ratio
// (как клиентский generateVideoThumbnail.ts), кодируем mjpeg.

import { FFmpeg } from 'npm:@ffmpeg/ffmpeg@0.12.15'

export const THUMB_WIDTH = 640
export const THUMB_HEIGHT = 360
export const THUMB_SEEK_SECONDS = 0.1
// mjpeg -q:v: 2 (лучшее) … 31 (худшее). 3 ≈ ~85% качества; 640×360 укладывается в ≤150 KB.
const MJPEG_QUALITY = 3

// Single-thread ffmpeg-core (без core-mt, без SharedArrayBuffer).
const CORE_BASE = 'https://esm.sh/@ffmpeg/core@0.12.10/dist/esm'

let ffmpegPromise: Promise<FFmpeg> | null = null

// Кешируем ЗАГРУЖЕННЫЙ инстанс (load() дорогой). Параллельность 8.3 (≤5) безопасна
// за счёт уникальных имён файлов на вызов; реальная изоляция тяжёлых вызовов — на
// уровне отдельных worker-инвокаций main-роутера (worker на запрос).
function getFFmpeg(): Promise<FFmpeg> {
  if (!ffmpegPromise) {
    ffmpegPromise = (async () => {
      const ffmpeg = new FFmpeg()
      await ffmpeg.load({
        coreURL: `${CORE_BASE}/ffmpeg-core.js`,
        wasmURL: `${CORE_BASE}/ffmpeg-core.wasm`,
      })
      return ffmpeg
    })()
  }
  return ffmpegPromise
}

export async function extractThumbnailJpeg(videoBytes: Uint8Array): Promise<Uint8Array> {
  const ffmpeg = await getFFmpeg()
  const id = crypto.randomUUID()
  const inputName = `in-${id}`
  const outputName = `out-${id}.jpg`

  await ffmpeg.writeFile(inputName, videoBytes)
  try {
    const code = await ffmpeg.exec([
      '-ss',
      String(THUMB_SEEK_SECONDS),
      '-i',
      inputName,
      '-frames:v',
      '1',
      '-vf',
      `scale=${THUMB_WIDTH}:${THUMB_HEIGHT}:force_original_aspect_ratio=increase,crop=${THUMB_WIDTH}:${THUMB_HEIGHT}`,
      '-q:v',
      String(MJPEG_QUALITY),
      '-f',
      'image2',
      outputName,
    ])
    if (code !== 0) {
      throw new Error(`ffmpeg exit ${code}`)
    }
    const data = await ffmpeg.readFile(outputName)
    const bytes =
      typeof data === 'string' ? new TextEncoder().encode(data) : (data as Uint8Array)
    if (!bytes || bytes.byteLength === 0) {
      throw new Error('prazen rezultat ffmpeg')
    }
    return bytes
  } finally {
    await ffmpeg.deleteFile(inputName).catch(() => {})
    await ffmpeg.deleteFile(outputName).catch(() => {})
  }
}
