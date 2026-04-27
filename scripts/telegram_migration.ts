/**
 * Скрипт миграции архива Telegram в Supabase.
 *
 * Алгоритм:
 * 1. Парсит result.json из Telegram Desktop экспорта
 * 2. Группирует сообщения в посты (одиночные + медиагруппы → gallery)
 * 3. Загружает медиафайлы в Supabase Storage bucket 'post_media'
 * 4. Вставляет посты в БД с оригинальными датами из Telegram
 * 5. Идемпотентен: повторный запуск пропускает уже импортированные посты
 *
 * Запуск:
 *   npx tsx scripts/telegram_migration.ts --input ./telegram-export --dry-run
 *   npx tsx scripts/telegram_migration.ts --input ./telegram-export
 *   npx tsx scripts/telegram_migration.ts --input ./telegram-export --resume
 *   npx tsx scripts/telegram_migration.ts --input ./telegram-export --admin-user-id <uuid>
 */

import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

// ── Аргументы командной строки ───────────────────────────────────────────────

const args = process.argv.slice(2)

function getArg(name: string): string | undefined {
  const idx = args.indexOf(name)
  if (idx === -1) return undefined
  return args[idx + 1]
}

const INPUT_PATH = getArg('--input')
const DRY_RUN = args.includes('--dry-run')
const RESUME = args.includes('--resume')
const ADMIN_USER_ID_ARG = getArg('--admin-user-id')

if (!INPUT_PATH) {
  console.error('Ошибка: укажите --input <path> к папке с экспортом Telegram')
  process.exit(1)
}

// ── Переменные окружения ──────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Ошибка: не заданы переменные окружения.')
  console.error('Нужны: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

// ── Константы ─────────────────────────────────────────────────────────────────

const STATE_FILE = '.migration-state.json'
const MAX_MEDIA_PER_POST = 10
const CATEGORY_MAPPING_FILE = 'category-mapping.json' // маппинг ID → категория
const MAX_UPLOAD_SIZE_MB = 50 // Supabase Storage лимит на размер файла
// Telegram Desktop экспорт не всегда содержит media_group_id —
// группируем последовательные медиа-сообщения, отправленные близко по времени
const ALBUM_TIME_THRESHOLD_SECONDS = 90

// ── Типы ──────────────────────────────────────────────────────────────────────

type TextEntity = {
  type: string
  text: string
}

type TelegramMessage = {
  id: number
  type: string
  date: string
  text: string | TextEntity[]
  photo?: string
  file?: string
  thumbnail?: string
  media_group_id?: string
}

type TelegramExport = {
  messages: TelegramMessage[]
}

type PostGroup = {
  messages: TelegramMessage[]
  media_group_id?: string
  postType: 'text' | 'photo' | 'video' | 'gallery'
}

type MigrationState = {
  lastProcessedTelegramId: number
  processedCount: number
  mediaUploadedCount: number
  startedAt: string
}

// ── Вспомогательные функции ───────────────────────────────────────────────────

function timeDiffSeconds(date1: string, date2: string): number {
  return Math.abs(new Date(date2).getTime() - new Date(date1).getTime()) / 1000
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function extractText(text: string | TextEntity[]): string {
  if (typeof text === 'string') return text
  return text.map((e) => e.text).join('')
}

function isRateLimitError(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase()
    return msg.includes('rate limit') || msg.includes('429') || msg.includes('too many requests')
  }
  return false
}

function isTimeoutError(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase()
    return msg.includes('timeout') || msg.includes('etimedout') || msg.includes('econnreset')
  }
  return false
}

async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 5,
  baseDelay = 1000
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      const isRetryable = isRateLimitError(err) || isTimeoutError(err)
      if (!isRetryable || attempt === maxAttempts) throw err
      const delay = baseDelay * Math.pow(2, attempt - 1) // 1s, 2s, 4s, 8s, 16s
      console.log(`  ⏳ Попытка ${attempt} неудачна, повтор через ${delay}ms...`)
      await sleep(delay)
    }
  }
  throw new Error('Unreachable')
}

// ── Состояние (cursor) ────────────────────────────────────────────────────────

function loadState(): MigrationState | null {
  if (!fs.existsSync(STATE_FILE)) return null
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8')) as MigrationState
  } catch {
    return null
  }
}

function saveState(state: MigrationState): void {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8')
}

// ── Маппинг категорий ─────────────────────────────────────────────────────────

function loadCategoryMapping(): Record<string, string> {
  if (!fs.existsSync(CATEGORY_MAPPING_FILE)) {
    console.warn(`⚠️  Маппинг категорий не найден (${CATEGORY_MAPPING_FILE}) — все посты получат 'drugo'`)
    return {}
  }
  try {
    return JSON.parse(fs.readFileSync(CATEGORY_MAPPING_FILE, 'utf-8')) as Record<string, string>
  } catch {
    console.warn('⚠️  Ошибка при загрузке маппинга категорий')
    return {}
  }
}

function getCategory(messageId: number, mapping: Record<string, string>): string {
  return mapping[messageId.toString()] || 'drugo'
}

// ── Парсинг Telegram JSON ─────────────────────────────────────────────────────

function parseTelegramExport(inputPath: string): TelegramMessage[] {
  const jsonPath = path.join(inputPath, 'result.json')
  if (!fs.existsSync(jsonPath)) {
    console.error(`Ошибка: файл не найден: ${jsonPath}`)
    process.exit(1)
  }
  const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf-8')) as TelegramExport
  return raw.messages ?? []
}

// ── Группировка сообщений ─────────────────────────────────────────────────────

function groupMessages(messages: TelegramMessage[]): PostGroup[] {
  // Сначала собираем явные медиагруппы (media_group_id присутствует в новых экспортах)
  const mediaGroupMap = new Map<string, TelegramMessage[]>()
  const nonGrouped: TelegramMessage[] = []

  for (const msg of messages) {
    if (msg.type !== 'message') continue
    if (msg.media_group_id) {
      const g = mediaGroupMap.get(msg.media_group_id) ?? []
      g.push(msg)
      mediaGroupMap.set(msg.media_group_id, g)
    } else {
      nonGrouped.push(msg)
    }
  }

  const result: PostGroup[] = []

  // Сортируем по id перед proximity-группировкой — Telegram экспорт обычно упорядочен,
  // но явная сортировка гарантирует корректный результат.
  nonGrouped.sort((a, b) => a.id - b.id)

  // Обрабатываем остальные сообщения последовательно.
  // Последовательные медиа-сообщения, отправленные в пределах ALBUM_TIME_THRESHOLD_SECONDS,
  // объединяются в gallery (альбом) — Telegram Desktop не всегда экспортирует media_group_id.
  let i = 0
  while (i < nonGrouped.length) {
    const msg = nonGrouped[i]
    const isMedia = !!(msg.photo || msg.file)

    if (isMedia) {
      const group = [msg]
      let j = i + 1
      while (j < nonGrouped.length) {
        const next = nonGrouped[j]
        const nextIsMedia = !!(next.photo || next.file)
        if (nextIsMedia && timeDiffSeconds(group[0].date, next.date) <= ALBUM_TIME_THRESHOLD_SECONDS) {
          group.push(next)
          j++
        } else {
          break
        }
      }

      for (let k = 0; k < group.length; k += MAX_MEDIA_PER_POST) {
        const chunk = group.slice(k, k + MAX_MEDIA_PER_POST)
        const firstInChunk = chunk[0]
        result.push({
          messages: chunk,
          postType: chunk.length === 1 ? (firstInChunk.photo ? 'photo' : 'video') : 'gallery',
        })
      }
      i = j
    } else {
      result.push({ messages: [msg], postType: 'text' })
      i++
    }
  }

  // Явные медиагруппы (из media_group_id) → gallery
  for (const [groupId, msgs] of mediaGroupMap) {
    const sorted = msgs.sort((a, b) => a.id - b.id)
    for (let k = 0; k < sorted.length; k += MAX_MEDIA_PER_POST) {
      result.push({ messages: sorted.slice(k, k + MAX_MEDIA_PER_POST), media_group_id: groupId, postType: 'gallery' })
    }
  }

  result.sort((a, b) => a.messages[0].id - b.messages[0].id)
  return result
}

// ── Загрузка медиа в Supabase Storage ────────────────────────────────────────

async function uploadMedia(
  inputPath: string,
  localFilePath: string,
  postId: string,
  orderIndex: number,
  dryRun: boolean
): Promise<string | null> {
  const fullPath = path.join(inputPath, localFilePath)
  if (!fs.existsSync(fullPath)) {
    console.warn(`  ⚠️  Файл не найден: ${fullPath} — пропускаем`)
    return null
  }

  const sizeMB = fs.statSync(fullPath).size / 1024 / 1024
  if (sizeMB > MAX_UPLOAD_SIZE_MB) {
    console.warn(`  ⚠️  Файл слишком большой (${sizeMB.toFixed(1)} MB > ${MAX_UPLOAD_SIZE_MB} MB), пропускаем: ${localFilePath}`)
    return null
  }

  const ext = path.extname(localFilePath).toLowerCase()
  const fileName = `telegram/${postId}/${orderIndex}-${path.basename(localFilePath)}`

  if (dryRun) {
    return `${SUPABASE_URL}/storage/v1/object/public/post_media/${fileName}`
  }

  return withRetry(async () => {
    const fileBuffer = fs.readFileSync(fullPath)

    let mimeType = 'image/jpeg'
    if (ext === '.mp4') mimeType = 'video/mp4'
    else if (ext === '.mov') mimeType = 'video/quicktime'
    else if (ext === '.webm') mimeType = 'video/webm'
    else if (ext === '.png') mimeType = 'image/png'
    else if (ext === '.webp') mimeType = 'image/webp'
    else if (ext === '.gif') mimeType = 'image/gif'

    const { error } = await supabase.storage
      .from('post_media')
      .upload(fileName, fileBuffer, { contentType: mimeType, upsert: false })

    if (error) {
      // Файл уже существует — продолжаем с его URL
      if (error.message.includes('already exists') || error.message.includes('Duplicate')) {
        console.log(`  ℹ️  Медиа уже загружено: ${fileName}`)
      } else {
        throw new Error(error.message)
      }
    }

    return supabase.storage.from('post_media').getPublicUrl(fileName).data.publicUrl
  })
}

// ── Вставка поста в БД ────────────────────────────────────────────────────────

async function insertPost(
  group: PostGroup,
  inputPath: string,
  adminUserId: string,
  dryRun: boolean,
  stats: { created: number; skipped: number; mediaUploaded: number },
  categoryMapping: Record<string, string>
): Promise<number | null> {
  const primaryMsg = group.messages[0]
  const rawText = extractText(primaryMsg.text)
  const title = rawText.trim().slice(0, 100) || '<>'
  const excerpt = rawText.trim().slice(0, 200) || null
  const content = rawText.trim() || null

  const postData = {
    author_id: adminUserId,
    title,
    excerpt,
    content,
    category: getCategory(primaryMsg.id, categoryMapping), // категория из маппинга или 'drugo'
    type: group.postType,
    image_url: null,
    is_published: true,
    created_at: new Date(primaryMsg.date).toISOString(),
    telegram_message_id: primaryMsg.id,
  }

  if (dryRun) {
    console.log(
      `  [dry-run] Пост: id=${primaryMsg.id} type=${group.postType} date=${primaryMsg.date} title="${title.slice(0, 50)}"`
    )
    if (group.messages.length > 1 || primaryMsg.photo || primaryMsg.file) {
      console.log(`  [dry-run]   Медиа: ${group.messages.filter((m) => m.photo || m.file).length} файл(ов)`)
    }
    stats.created++
    return primaryMsg.id
  }

  // Проверяем существование поста (идемпотентность)
  const { data: existing } = await supabase
    .from('posts')
    .select('id')
    .eq('telegram_message_id', primaryMsg.id)
    .maybeSingle()

  if (existing) {
    stats.skipped++
    return primaryMsg.id // уже импортирован
  }

  // Вставляем пост
  const { data: post, error: postError } = await supabase
    .from('posts')
    .insert(postData)
    .select('id')
    .single()

  if (postError) {
    // UNIQUE constraint → пост уже существует
    if (postError.code === '23505') {
      stats.skipped++
      return primaryMsg.id
    }
    throw new Error(`Ошибка вставки поста ${primaryMsg.id}: ${postError.message}`)
  }

  const postId = post.id

  // Загружаем медиа
  const mediaMessages = group.messages.filter((m) => m.photo || m.file)
  for (let i = 0; i < mediaMessages.length; i++) {
    const msg = mediaMessages[i]
    const isVideo = !!msg.file
    const localFile = isVideo ? msg.file! : msg.photo!

    const mediaUrl = await uploadMedia(inputPath, localFile, postId, i, dryRun)
    if (!mediaUrl) continue

    let thumbnailUrl: string | null = null
    if (isVideo && msg.thumbnail) {
      thumbnailUrl = await uploadMedia(inputPath, msg.thumbnail, postId, i, dryRun)
      if (thumbnailUrl) stats.mediaUploaded++
    }

    const { error: mediaError } = await supabase.from('post_media').insert({
      post_id: postId,
      media_type: isVideo ? 'video' : 'image',
      url: mediaUrl,
      thumbnail_url: thumbnailUrl,
      order_index: i,
      is_cover: i === 0,
    })

    if (mediaError && !mediaError.message.includes('duplicate')) {
      console.warn(`  ⚠️  Ошибка вставки медиа для поста ${primaryMsg.id}: ${mediaError.message}`)
    } else {
      stats.mediaUploaded++
    }
  }

  stats.created++
  return primaryMsg.id
}

// ── Получение admin user ID ───────────────────────────────────────────────────

async function resolveAdminUserId(adminUserIdArg?: string): Promise<string> {
  if (adminUserIdArg) {
    return adminUserIdArg
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'admin')
    .limit(1)
    .single()

  if (error || !data) {
    console.error('Ошибка: не удалось найти admin пользователя в БД.')
    console.error('Передайте --admin-user-id <uuid> явно.')
    process.exit(1)
  }

  return data.id
}

// ── Основная функция ──────────────────────────────────────────────────────────

async function run() {
  console.log(DRY_RUN ? '=== DRY RUN — изменения не сохраняются ===\n' : '=== Telegram Migration → Supabase ===\n')

  if (RESUME) {
    console.log('Режим: --resume (продолжение с cursor)\n')
  }

  // Загружаем маппинг категорий
  const categoryMapping = loadCategoryMapping()
  if (Object.keys(categoryMapping).length > 0) {
    console.log(`✓ Маппинг категорий загружен: ${Object.keys(categoryMapping).length} постов\n`)
  }

  // Загружаем cursor состояние
  let state: MigrationState | null = null
  if (RESUME) {
    state = loadState()
    if (state) {
      console.log(
        `Возобновление: последний обработанный id=${state.lastProcessedTelegramId}, уже обработано=${state.processedCount}\n`
      )
    } else {
      console.log('Файл состояния не найден — начинаем с начала\n')
    }
  }

  // Получаем admin user ID
  const adminUserId = await resolveAdminUserId(ADMIN_USER_ID_ARG)
  console.log(`Admin user ID: ${adminUserId}\n`)

  // Парсим экспорт
  console.log(`Читаем экспорт из: ${INPUT_PATH}`)
  const messages = parseTelegramExport(INPUT_PATH!)
  console.log(`Сообщений в архиве: ${messages.length}`)

  // Группируем сообщения
  const groups = groupMessages(messages)
  console.log(`Групп для импорта: ${groups.length}\n`)

  const stats = {
    created: state?.processedCount ?? 0,
    skipped: 0,
    mediaUploaded: state?.mediaUploadedCount ?? 0,
  }

  const startedAt = state?.startedAt ?? new Date().toISOString()
  let lastProcessedId = state?.lastProcessedTelegramId ?? 0

  // Обрабатываем группы
  for (let i = 0; i < groups.length; i++) {
    const group = groups[i]
    const primaryId = group.messages[0].id

    // Пропускаем уже обработанные при --resume
    if (RESUME && state && primaryId <= state.lastProcessedTelegramId) {
      continue
    }

    const progress = `[${i + 1}/${groups.length}]`
    console.log(`${progress} id=${primaryId} type=${group.postType} date=${group.messages[0].date}`)

    try {
      const processedId = await insertPost(group, INPUT_PATH!, adminUserId, DRY_RUN, stats, categoryMapping)

      if (processedId !== null) {
        lastProcessedId = processedId
      }

      // Сохраняем cursor после каждого успешного поста (не в dry-run)
      if (!DRY_RUN) {
        saveState({
          lastProcessedTelegramId: lastProcessedId,
          processedCount: stats.created,
          mediaUploadedCount: stats.mediaUploaded,
          startedAt,
        })
      }
    } catch (err) {
      console.error(`  ✗ Ошибка обработки группы id=${primaryId}: ${(err as Error).message}`)
      console.error('  Cursor сохранён. Используйте --resume для продолжения.')
      break
    }
  }

  // Итоговый отчёт
  console.log('\n' + '─'.repeat(60))
  console.log('ИТОГИ МИГРАЦИИ:\n')
  console.log(`  ✓ Создано постов:       ${stats.created}`)
  console.log(`  – Пропущено (дубли):    ${stats.skipped}`)
  console.log(`  📎 Загружено медиа:     ${stats.mediaUploaded}`)
  console.log('─'.repeat(60))

  if (DRY_RUN) {
    console.log('\nЗапусти без --dry-run чтобы применить изменения.')
  } else {
    // Очищаем cursor файл при успешном завершении
    if (fs.existsSync(STATE_FILE)) {
      fs.unlinkSync(STATE_FILE)
      console.log('\nФайл состояния удалён (миграция завершена успешно).')
    }
    console.log('\nМиграция завершена.')
  }
}

run().catch((err) => {
  console.error('Критическая ошибка:', err)
  process.exit(1)
})
