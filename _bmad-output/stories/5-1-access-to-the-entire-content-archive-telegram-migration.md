# Story 5.1: Доступ ко всему архиву контента (Telegram Migration)

Status: review

## Story

As a участница,
I want иметь доступ ко всем старым публикациям клуба, начиная с первого дня,
so that я могла изучить весь накопленный полезный опыт и материалы прошлых лет.

## Acceptance Criteria

1. **Given** файл экспорта из Telegram (JSON + папка с медиа) **When** администратор запускает `npx tsx scripts/telegram_migration.ts --input <path>` **Then** скрипт читает JSON и переносит все публикации в БД с оригинальными `created_at` датами.
2. Медиагруппы (`media_group_id`) из Telegram объединяются в единые посты-галереи (type=`gallery`) с корректным `order_index` в `post_media`.
3. Медиафайлы загружаются в Supabase Storage bucket `post_media` и связываются с постами через таблицу `post_media`.
4. При ошибке Rate Limit или Timeout во время загрузки медиа скрипт сохраняет cursor (ID последнего успешного поста) в `.migration-state.json` и повторяет попытку с Exponential Backoff (1s → 2s → 4s → 8s, max 5 попыток).
5. Повторный запуск скрипта не дублирует уже загруженные посты (идемпотентность через поле `telegram_message_id` в таблице `posts`).
6. Telegram-архив иммутабелен: скрипт НИКОГДА не обновляет и не удаляет уже импортированные записи (NFR24).
7. Скрипт поддерживает `--dry-run` режим: выводит что будет импортировано без записи в БД.
8. После завершения скрипт выводит сводку: кол-во созданных постов, загруженных медиа, пропущенных (дубли).

## Tasks / Subtasks

- [x] Task 1: Миграция БД — добавить `telegram_message_id` в таблицу `posts` (AC: #5)
  - [x] 1.1 Создать `supabase/migrations/032_add_telegram_message_id.sql` (адаптировано: 031 уже существовал)
  - [x] 1.2 Поле: `telegram_message_id BIGINT UNIQUE` (nullable для постов созданных вручную)
  - [x] 1.3 Создать индекс: `idx_posts_telegram_message_id ON posts(telegram_message_id) WHERE telegram_message_id IS NOT NULL`
  - [x] 1.4 Применить миграцию: `npx supabase db push` — выполнено успешно

- [x] Task 2: Создать скрипт `scripts/telegram_migration.ts` (AC: #1, #2, #3, #4, #5, #6, #7, #8)
  - [x] 2.1 Парсинг аргументов: `--input <path>`, `--dry-run`, `--resume`, `--admin-user-id`
  - [x] 2.2 Валидация ENV vars: `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
  - [x] 2.3 Парсинг `result.json`: функция `parseTelegramExport(jsonPath)` → массив Message[]
  - [x] 2.4 Группировка сообщений: функция `groupMessages(messages)` → PostGroup[] (одиночные + медиагруппы)
  - [x] 2.5 Загрузка медиа: функция `uploadMedia(...)` → Storage URL с Exponential Backoff (1s→2s→4s→8s→16s, max 5 попыток)
  - [x] 2.6 Вставка поста в БД с проверкой идемпотентности через `telegram_message_id` (ON CONFLICT 23505)
  - [x] 2.7 Cursor: сохранение/восстановление состояния из `.migration-state.json`
  - [x] 2.8 Сводный отчёт по завершении (создано/пропущено/загружено медиа)

- [x] Task 3: Установить зависимости для скрипта (AC: #1)
  - [x] 3.1 `npm install --save-dev tsx dotenv` — tsx@4.21.0, dotenv@17.3.1 установлены
  - [x] 3.2 Проверить: `npx tsx scripts/sync-stripe-subscriptions.ts --dry-run` работает ✓

## Dev Notes

### Архитектура скрипта

Скрипт — **локальный CLI-инструмент**, выполняется один раз администратором, **не является частью Next.js app**.

```
scripts/
  telegram_migration.ts   ← новый скрипт (паттерн: sync-stripe-subscriptions.ts)
  sync-stripe-subscriptions.ts   ← референсный паттерн
```

**Паттерн запуска** (из `sync-stripe-subscriptions.ts`):
```bash
npx tsx scripts/telegram_migration.ts --input ./telegram-export --dry-run
npx tsx scripts/telegram_migration.ts --input ./telegram-export
npx tsx scripts/telegram_migration.ts --input ./telegram-export --resume   # продолжить с cursor
```

### Структура Telegram JSON Export

Telegram Desktop экспортирует архив в формате:
```
<export-folder>/
  result.json          ← все сообщения
  files/
    photo_123.jpg
    video_456.mp4
    ...
```

**Формат `result.json`** (ключевые поля):
```json
{
  "messages": [
    {
      "id": 12345,
      "type": "message",
      "date": "2023-01-15T10:30:00",
      "text": "Текст публикации",
      "photo": "files/photo_123.jpg",      // относительный путь
      "media_group_id": "13567890123456",  // BIGINT, одинаковый у сообщений одной группы
      "file": "files/video_456.mp4",       // для видео
      "thumbnail": "files/thumb_456.jpg"   // thumbnail видео (если есть)
    }
  ]
}
```

**Типы сообщений → типы постов**:
| Telegram | posts.type | Условие |
|----------|-----------|---------|
| text только | `text` | `photo` = null AND `file` = null |
| photo | `photo` | `photo` ≠ null AND нет `media_group_id` |
| video | `video` | `file` ≠ null AND нет `media_group_id` |
| медиагруппа (≥2 медиа) | `gallery` | `media_group_id` ≠ null, группируем по нему |

### Алгоритм группировки медиагрупп (CRITICAL)

```typescript
// ВАЖНО: сообщения одной медиагруппы МОГУТ идти не подряд в result.json
// Используем Map для накопления группы, затем сортируем по id (= порядку отправки)

type TelegramMessage = {
  id: number
  date: string
  text: string | TextEntity[]  // может быть массивом с entities
  photo?: string
  file?: string
  thumbnail?: string
  media_group_id?: string
}

function groupMessages(messages: TelegramMessage[]): PostGroup[] {
  const groups = new Map<string, TelegramMessage[]>()
  const singles: TelegramMessage[] = []

  for (const msg of messages) {
    if (msg.type !== 'message') continue  // пропускать service messages
    if (msg.media_group_id) {
      const g = groups.get(msg.media_group_id) ?? []
      g.push(msg)
      groups.set(msg.media_group_id, g)
    } else {
      singles.push(msg)
    }
  }

  // Для медиагрупп: текст берём из первого сообщения группы (у него обычно caption)
  // order_index = порядок по msg.id внутри группы (сортируем по возрастанию id)
  // ...
}
```

### Схема БД (что использует скрипт)

**Таблица `posts`** (существует, из migration 007 + последующие):
```sql
posts.id UUID PRIMARY KEY
posts.author_id UUID  -- admin user ID из Supabase Auth
posts.title TEXT      -- берём первые 100 символов text или "<без текста>"
posts.excerpt TEXT    -- первые 200 символов text
posts.content TEXT    -- полный текст
posts.category TEXT   -- 'insight' (дефолт для всех импортированных)
posts.type TEXT       -- 'text' | 'photo' | 'video' | 'gallery'
posts.image_url TEXT  -- NULL (используем post_media)
posts.is_published BOOLEAN DEFAULT true
posts.created_at TIMESTAMPTZ  -- ОРИГИНАЛЬНАЯ дата из Telegram (НЕ now())
-- НОВОЕ поле (Task 1):
posts.telegram_message_id BIGINT UNIQUE  -- для идемпотентности
```

**Таблица `post_media`** (существует, из migration 016):
```sql
post_media.post_id UUID FK → posts.id
post_media.media_type TEXT  -- 'image' | 'video'
post_media.url TEXT         -- Supabase Storage public URL
post_media.thumbnail_url TEXT  -- nullable, только для видео
post_media.order_index INTEGER  -- порядок в галерее (0-based)
post_media.is_cover BOOLEAN  -- true только для первого (order_index=0)
-- UNIQUE(post_id, order_index) — защита от дублей
```

**Supabase Storage bucket `post_media`** (существует, из migration 022):
- Public bucket (public = true)
- RLS: authenticated может загружать и удалять; public может читать
- URL формат: `{SUPABASE_URL}/storage/v1/object/public/post_media/{filename}`

### Паттерн Exponential Backoff (CRITICAL для NFR19.2)

```typescript
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
      const delay = baseDelay * Math.pow(2, attempt - 1)  // 1s, 2s, 4s, 8s, 16s
      console.log(`Попытка ${attempt} неудачна, повтор через ${delay}ms...`)
      await sleep(delay)
    }
  }
  throw new Error('Unreachable')
}
```

### Cursor и состояние (для возобновления)

```typescript
// .migration-state.json — создаётся рядом со скриптом или в CWD
type MigrationState = {
  lastProcessedTelegramId: number   // последний успешно обработанный msg.id
  processedCount: number
  mediaUploadedCount: number
  startedAt: string
}

// При старте: если --resume, читаем state и пропускаем id <= lastProcessedTelegramId
// После каждого успешного поста: сохраняем state в файл
// NFR24: никогда не обновляем существующие posts по telegram_message_id
```

### ENV vars (паттерн из sync-stripe-subscriptions.ts)

```typescript
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

// ВАЖНО: использовать SERVICE_ROLE_KEY (обходит RLS), НЕ anon key
// createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
```

### Идемпотентность (CRITICAL для NFR24)

```typescript
// Вставка поста — идемпотентна через ON CONFLICT DO NOTHING
const { data: post, error } = await supabase
  .from('posts')
  .insert({ ...postData, telegram_message_id: msg.id })
  .select()
  .single()

// Если error из-за telegram_message_id UNIQUE constraint → пост уже существует → skip
// НИКОГДА не делаем .upsert() — это нарушит NFR24

// Вставка post_media — идемпотентна через UNIQUE(post_id, order_index) + ON CONFLICT DO NOTHING
// Migration 016 уже обеспечивает эту защиту
```

### Загрузка медиа в Supabase Storage

```typescript
// Генерация уникального имени файла чтобы избежать коллизий
const fileName = `telegram/${postId}/${orderIndex}-${path.basename(localFilePath)}`

const fileBuffer = fs.readFileSync(localFilePath)
const mimeType = localFilePath.endsWith('.mp4') ? 'video/mp4' : 'image/jpeg'

const { data, error } = await supabase.storage
  .from('post_media')
  .upload(fileName, fileBuffer, { contentType: mimeType, upsert: false })

// upsert: false — не перезаписывать (идемпотентность)
// Если файл уже существует → продолжаем с его URL

const publicUrl = supabase.storage.from('post_media').getPublicUrl(fileName).data.publicUrl
```

### Текстовые поля из Telegram

```typescript
// msg.text может быть строкой ИЛИ массивом TextEntity:
// [{ "type": "plain", "text": "Обычный текст" }, { "type": "bold", "text": "Жирный" }]
function extractText(text: string | TextEntity[]): string {
  if (typeof text === 'string') return text
  return text.map(e => e.text).join('')
}

// title = первые 100 символов (или '<Медиа без подписи>' для медиа без текста)
// excerpt = первые 200 символов
// content = полный текст
```

### Важные ограничения

- **Лимит 10 медиа на пост**: Триггер `enforce_post_media_limit` в БД (migration 016+017). Если медиагруппа > 10 элементов → разбить на несколько постов или обрезать до 10 (задокументировать решение).
- **`author_id`**: Используем admin user ID. Скрипт должен принять `--admin-user-id <uuid>` аргумент ИЛИ найти первого пользователя с `role='admin'` через Supabase.
- **`category`**: Для всех импортированных постов ставим `'insight'` (дефолт). Администратор может изменить вручную позже.
- **Пропускать service messages**: `msg.type === 'service'` — это системные события (вступление, закрепление), не посты.

### Project Structure Notes

- Скрипт изолирован в `scripts/` — **НЕ импортирует из `src/`**
- Не использует Next.js, React, Zustand — чистый Node.js/TypeScript
- Паттерн именования файлов в Storage: `telegram/{post_uuid}/{order_index}-{original_name}`
- `.migration-state.json` добавить в `.gitignore`

### References

- Паттерн скрипта: `scripts/sync-stripe-subscriptions.ts`
- DB: `supabase/migrations/007_create_posts_table.sql` — схема posts
- DB: `supabase/migrations/016_create_post_media.sql` — схема post_media + UNIQUE constraint + триггер
- DB: `supabase/migrations/022_create_post_media_bucket.sql` — Storage bucket 'post_media'
- Architecture: `_bmad-output/planning-artifacts/architecture.md` раздел "Telegram Migration"
- NFR19.2, NFR24: `_bmad-output/planning-artifacts/epics.md` (NFR section, строки 76, 81)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

Миграция применена с номером 032 (вместо 025 из story-файла) — на момент реализации последней была 031. Supabase db push выполнен успешно.

### Completion Notes List

- ✅ Task 1: Миграция 032_add_telegram_message_id.sql создана и применена. Поле BIGINT UNIQUE nullable + частичный индекс WHERE IS NOT NULL.
- ✅ Task 2: Скрипт scripts/telegram_migration.ts реализован полностью. Поддерживает: --input, --dry-run, --resume, --admin-user-id. Exponential Backoff 1s→2s→4s→8s→16s (max 5 попыток). Курсор в .migration-state.json. Идемпотентность через ON CONFLICT (23505). Медиагруппы > 10 файлов разбиваются на чанки. service messages пропускаются. Автоматический поиск admin user ID через profiles.role='admin'.
- ✅ Task 3: tsx@4.21.0 и dotenv@17.3.1 установлены как devDependencies. Существующий скрипт sync-stripe-subscriptions.ts работает корректно.
- ✅ Tests: 14 unit-тестов для extractText и groupMessages — все зелёные.
- ✅ .gitignore обновлён: добавлен .migration-state.json.

### File List

- supabase/migrations/032_add_telegram_message_id.sql (новый)
- scripts/telegram_migration.ts (новый)
- tests/unit/scripts/telegram_migration.test.ts (новый)
- .gitignore (изменён: добавлен .migration-state.json)
- package.json (изменён: добавлены devDependencies tsx, dotenv)

## Change Log

| Дата | Изменение |
|------|-----------|
| 2026-03-30 | Реализация Story 5.1: миграция БД (032), скрипт telegram_migration.ts, unit-тесты (14 шт.), .gitignore |
