---
workflowType: 'prd-epic'
epicNumber: 8
epicName: 'Video Thumbnails — Avtomatska in ročna upravljanje posterjev za video'
date: '2026-05-17'
classification:
  domain: general
  projectType: web_app
  complexity: low
inputDocuments:
  - "_bmad-output/planning-artifacts/prd.md"
  - "_bmad-output/planning-artifacts/architecture.md"
  - "_bmad-output/planning-artifacts/epics.md"
  - "_bmad-output/planning-artifacts/ux-design-specification.md"
relatedStories:
  - "Story 4.1: Создание и редактирование мультимедийных объектов (Editor)"
  - "Story 2.1: Мультимедийная поддержка в ленте (Feed + GalleryGrid + VideoPlayerContainer)"
  - "Story 5.1: Telegram миграция (post_media)"
dependencies:
  - "Epic 4: Creator Operations (Admin Dashboard) — форма post_media, компоненты editor'а"
  - "Epic 2: Knowledge Discovery — LazyMediaWrapper, GalleryGrid"
  - "Epic 5: Telegram Migration — база данных post_media с существующими видео-записями"
stepsCompleted: []
---

# Epic 8: Video Thumbnails — Автоматическое и ручное управление poster'ами для видео

**Автор:** Alex  
**Дата:** 2026-05-17  
**Статус:** Draft — готов к ревью и имплементации  
**Язык документации:** Русский  
**Язык UI:** Словенский  

## Сводка

Epic 8 решает проблему, когда видео-объекты в `post_media` не имеют установленного `thumbnail_url`. В таком случае система в ленте и галереях не может отобразить предпросмотр (poster), что ухудшает пользовательский опыт и приводит к пустым или непривлекательным превью.

**Ключевые функции:**
1. **Автоматическая генерация thumbnail'а** из первого кадра видео при сохранении объекта — если `thumbnail_url` не установлен.
2. **Ручная замена poster'а** в редакторе — автор может во время создания/публикации объекта выбрать любое изображение в качестве poster'а для каждого видео.
3. **Ретроактивное исправление** для существующих объектов — администратор может вручную запустить команду, которая проверит все видео-записи без `thumbnail_url` и автоматически сгенерирует недостающие poster'ы.

**Вне области (out of scope):** Динамическая генерация thumbnail'ов из внешних URL, AI-generated poster'ы, автоматический выбор "лучшего" кадра.

## Критерии успеха

| # | Критерий | Метрика |
|---|---|---|
| SC8.1 | 100 % новых видео-объектов имеют сгенерированный thumbnail при публикации | Измеряется: при публикации `thumbnail_url` автоматически заполняется для каждого видео |
| SC8.2 | 100 % существующих видео без thumbnail'а обрабатывается в одной ретроактивной акции | Измеряется: admin bulk-акция покрывает все записи `thumbnail_url IS NULL` |
| SC8.3 | Время сохранения объекта остаётся ≤ 3 с независимо от генерации thumbnail'а | Измеряется: Network tab / backend logging |
| SC8.4 | Ни одно видео в ленте не имеет пустого/повреждённого предпросмотра | Измеряется: визуальная проверка ленты после имплементации |

---

## FR — Функциональные требования

### FR8.1 [M] Автоматическая генерация thumbnail'а при сохранении объекта
**Описание:** Когда автор сохраняет объект (create или update) и в `post_media` существует видео с `media_type = 'video'` без `thumbnail_url`, система автоматически из первого кадра видео генерирует изображение (poster), загружает его в Supabase Storage и записывает `thumbnail_url` в соответствующую запись `post_media`.

- **Триггер:** Сохранение объекта (`INSERT` или `UPDATE` на `posts` + связанные `post_media`).
- **Условие:** `media_type = 'video'` AND (`thumbnail_url IS NULL` OR `thumbnail_url = ''`).
- **Результат:** Сгенерированный thumbnail сохранён в bucket `post_media/thumbnails/` с именем `{post_media_id}_thumb.jpg`. `thumbnail_url` обновлён в `post_media`.

### FR8.2 [M] Отображение poster'а в редакторе при создании объекта
**Описание:** При добавлении видео-файла в объект редактор отображает сгенерированный или выбранный poster как превью-изображение. Если poster ещё не существует (например, только что загруженное видео), отображается индикатор загрузки или стандартная иконка видео.

### FR8.3 [S] Ручная замена poster'а в редакторе
**Описание:** Автор может для каждого видео в объекте нажать кнопку "Zamenjaj poster" (слов.: `Spremeni poster`) и выбрать другое изображение (из существующих `post_media` этого объекта или загрузить новое). Выбранное изображение становится `thumbnail_url` для этого видео.

**Ограничения:**
- Ручной выбор изображения должен быть формата `image/jpeg` или `image/png`.
- Размер файла не должен превышать 2 MB.
- При ручном выборе thumbnail из видео не генерируется — выбор пользователя имеет приоритет.

### FR8.4 [M] Ретроактивная обработка существующих объектов
**Описание:** Администратор может запустить разовую (повторяемую) команду (кнопка admin в dashboard'е), которая:
1. Находит все записи `post_media` с `media_type = 'video'` и `thumbnail_url IS NULL`.
2. Для каждой такой записи генерирует thumbnail из первого кадра.
3. Результат записывает в `thumbnail_url`.
4. Возвращает отчёт: количество обработанных записей, количество успешных, количество неудачных (с причинами).

**Безопасность:** Команда требует admin-аутентификации. Не создаёт дубликатов — если `thumbnail_url` уже существует, запись пропускается.

### FR8.5 [M] Отображение thumbnail'а в ленте и галереях
**Описание:** Видео в ленте и галереях отображают `thumbnail_url` как poster перед воспроизведением. Если `thumbnail_url` отсутствует, используется fallback (первый кадр видео или стандартная иконка).

**Acceptance:** После имплементации Epic 8 ни одно видео в ленте не должно иметь пустого/повреждённого превью.

### FR8.6 [S] Удаление thumbnail'а при удалении видео
**Описание:** Когда удаляется запись `post_media` (или весь объект с CASCADE), система автоматически удаляет и связанный thumbnail из Storage, чтобы не появлялись осиротевшие (orphaned) файлы.

### FR8.7 [S] Повторная генерация thumbnail'а
**Описание:** Автор может в admin-просмотре для конкретного видео нажать "Ponovno generiraj poster" (слов.: `Znova ustvari poster`). Система удаляет старый thumbnail, генерирует новый из текущего видео и обновляет `thumbnail_url`.

---

## NFR — Нефункциональные требования

### NFR8.1: Генерация thumbnail'а не должна блокировать сохранение объекта
Временное требование: сохранение объекта (create/update) должно занимать ≤ 3 секунды независимо от генерации thumbnail'ов. Canvas-генерация проходит параллельно с загрузкой видео в редактор и завершается до клика на "Objavi". Если Canvas fallback вызывает server API, этот вызов тоже должен быть неблокирующим для основного POST/PUT flow.

### NFR8.2: Качество thumbnail'а
Сгенерированное изображение должно быть:
- Формат: JPEG, качество 85%.
- Разрешение: 640×360 px (16:9) — подходящее для LCP на мобильных устройствах.
- Размер файла: ≤ 150 KB.
- Первый кадр захвачен при `currentTime = 0.1s`, чтобы избежать чёрного начального кадра.

### NFR8.3: Надёжность ретроактивной обработки
Ретроактивный скрипт (Supabase Edge Function или Hetzner service) должен:
- Обрабатывать ошибки отдельного видео без прерывания всего процесса.
- Поддерживать resume — если процесс прерывается, он может продолжиться с места прерывания.
- Ограничивать параллелизм максимум 5 одновременными процессами (чтобы не перегружать сервер/Edge Function).  
**SLA:** Обработка 100 видео не должна занимать более 10 минут.

### NFR8.4: Безопасность загрузки ручных poster'ов
Проверка MIME-типа (magic bytes), не только расширения. Запрещённые форматы: SVG, GIF, WebP (для консистентности с остальной платформой). Изображение должно быть перед загрузкой уменьшено до максимум 1920×1080 px.

### NFR8.5: Идемпотентность
Повторный запуск ретроактивной команды или повторное сохранение того же объекта не должно создавать дубликатов thumbnail'ов в Storage. Старый thumbnail при повторной генерации заменяется (overwrite).

### NFR8.6: Доступность
Все кнопки управления poster'ами должны иметь `aria-label` и быть доступными с клавиатуры. Touch target: минимум 44×44 px.

---

## UX Design Requirements

### UX-DR8.1: Предпросмотр video poster'а в редакторе
В media-upload списке редактора для каждого видео отображается квадратный предпросмотр (aspect-ratio 16/9) со следующими состояниями:
- **Загрузка:** `Skeleton` с анимацией `animate-pulse`.
- **Сгенерирован:** отображается изображение thumbnail'а с маленькой иконкой видео overlay (как в `LazyMediaWrapper`).
- **Ручной выбор:** отображается изображение с меткой "Ročni poster" (слов.: `Ročni poster`) в правом верхнем углу.
- **Отсутствует:** стандартная иконка видео с серым фоном и надписью "Brez posterja" (слов.: `Brez posterja`).

### UX-DR8.2: Контекстное меню для poster'а
При клике на предпросмотр видео открывается небольшое меню с опциями:
- `Spremeni poster` (икона изображения) — открывает file picker.
- `Znova ustvari poster` (икона обновления) — повторно генерирует из видео.
- `Odstrani poster` (икона корзины) — устанавливает `thumbnail_url = NULL`, fallback на первый кадр.

### UX-DR8.3: Toast-уведомления
- Успешная генерация: "Poster je bil ustvarjen" (слов.: `Poster je bil ustvarjen`).
- Ошибка генерации: "Napaka pri ustvarjanju posterja. Poskusite znova." (слов.: `Napaka pri ustvarjanju posterja. Poskusite znova.`).
- Успешная замена: "Poster je bil posodobljen" (слов.: `Poster je bil posodobljen`).

### UX-DR8.4: Admin-просмотр для ретроактивной обработки
В admin panel под вкладку "Orodja" (слов.: `Orodja`) добавляется карточка:
- Заголовок: "Generiraj manjkajoče postere" (слов.: `Generiraj manjkajoče postere`).
- Подзаголовок: отображает количество видео без poster'а.
- Кнопка: "Zaženi zdaj" (слов.: `Zaženi zdaj`) — отключена во время выполнения.
- Progress bar во время выполнения.
- Результат: количество успешно обработанных / неудачных.

---

## Техническая реализация

### 1. Схема базы данных (миграция)

Таблица `post_media` уже содержит `thumbnail_url`. Изменение схемы не требуется, за исключением возможного дополнительного индекса для быстрого поиска видео без thumbnail'а:

```sql
-- Migration: 031_add_thumbnail_index.sql
CREATE INDEX IF NOT EXISTS idx_post_media_missing_thumbnail
  ON public.post_media(media_type, thumbnail_url)
  WHERE media_type = 'video' AND thumbnail_url IS NULL;
```

### 2. Supabase Storage — структура bucket'а

Bucket `post_media` уже существует. Thumbnail'ы сохраняются в подпапку:
- Путь: `post_media/thumbnails/{post_media_id}_thumb.jpg`
- Публично читаемый (public read), запись разрешена только admin'у.

### 3. Архитектура генерации thumbnail'а

#### Опция A: Client-side Canvas (рекомендуется для автора — FR8.1, FR8.2)
При загрузке видео в редактор браузер генерирует poster:
1. `<video src="{url}" crossOrigin="anonymous">` → `seekTo(0.1)`
2. `<canvas>` drawImage → `toBlob('image/jpeg', 0.85)`
3. Blob загружается в Storage и записывается `thumbnail_url`
4. **Fallback:** если canvas не срабатывает (CORS, неподдерживаемый формат, слишком большой файл) → вызывается server API (`POST /api/admin/generate-thumbnail-fallback`)

**Почему client-side primary:**
- Мгновенный feedback — poster виден в редакторе сразу после загрузки видео (~200-500ms).
- Без нагрузки на сервер — не расходует Vercel execution time/RAM.
- Автор получает мгновенный визуальный предпросмотр перед публикацией.

**Ограничения Canvas:**
- Требуются правильные CORS-заголовки на Storage.
- Качество JPEG и размер файла зависят от браузера.
- Очень большие файлы (>100 MB) или экзотические форматы (MOV/HEVC) могут не работать.

#### Опция B: Server-side fallback + bulk (FR8.4)
**Supabase Edge Function** `POST /functions/v1/generate-thumbnail`:
- Для ретроактивной обработки (Story 8.3) и fallback'а, когда Canvas не срабатывает.
- Использует `ffmpeg.wasm` в Deno-окружении — меньшее потребление RAM, чем в Next.js Function.
- Результат: консистентное качество независимо от браузера.

**Почему не Route Handler + ffmpeg.wasm в Vercel:**
- Vercel Function имеет 10s timeout (Hobby) и ограничение RAM (~1GB).
- ffmpeg.wasm требует 100-200 MB RAM — при одновременных запросах (bulk) происходит OOM.
- Canvas покрывает 95% случаев (workflow автора); Edge Function покрывает остаток.

### 4. Поток генерации thumbnail'а

```
Автор загружает видео в редактор
  → Client создаёт <video> element, seekTo(0.1)
  → Canvas рисует кадр → toBlob('image/jpeg', 0.85)
  → Client загружает blob в Storage: post_media/thumbnails/{id}_thumb.jpg
  → Client записывает thumbnail_url в запись post_media
  → Editor отображает poster сразу (~200-500ms)

При сохранении объекта:
  → Видео уже имеет thumbnail_url (сгенерирован при загрузке)
  → Если Canvas не сработал → server fallback (Edge Function)
  → Сохранение занимает ≤ 3 секунды, независимо от thumbnail'а
```

**Решение по реализации:**
Для v1 используется **client-side Canvas как primary path** — генерация происходит в браузере при загрузке видео, а не при сохранении объекта. Это обеспечивает мгновенный визуальный feedback и устраняет необходимость в асинхронных job'ах в workflow автора. **Server fallback** (`POST /api/admin/generate-thumbnail-fallback`) используется только если Canvas не срабатывает (CORS, неподдерживаемый формат). **Bulk ретроактивная обработка** (Story 8.3) выполняется через Supabase Edge Function с 5-worker параллелизмом.

### 5. Ретроактивный скрипт

**Расположение:** `scripts/generate-missing-thumbnails.ts`  
**Способ запуска:** `npx tsx scripts/generate-missing-thumbnails.ts --env=.env.local`  
**Кнопка Admin UI:** Отправляет запрос на `POST /api/admin/bulk-generate-thumbnails`, который запускает ту же логику.

```typescript
// Псевдокод скрипта
async function generateMissingThumbnails() {
  const { data: videos } = await supabase
    .from('post_media')
    .select('id, url')
    .eq('media_type', 'video')
    .is('thumbnail_url', null)

  const results = { processed: 0, success: 0, failed: 0, errors: [] }

  for (const video of videos || []) {
    results.processed++
    try {
      await generateThumbnail(video.id, video.url)
      results.success++
    } catch (err) {
      results.failed++
      results.errors.push({ id: video.id, error: err.message })
    }
    // Rate limiting: 200ms delay между последовательными вызовами
    await delay(200)
  }

  return results
}
```

### 6. Компоненты

#### Новые / изменённые компоненты

| Компонента | Расположение | Описание |
|---|---|---|
| `VideoThumbnailGenerator` | `src/features/editor/components/VideoThumbnailGenerator.tsx` | Smart container — вызывает API, управляет статусом генерации |
| `MediaItemPreview` | `src/features/editor/components/MediaItemPreview.tsx` | Dumb UI — отображает poster + overlay иконки + меню |
| `PosterContextMenu` | `src/features/editor/components/PosterContextMenu.tsx` | Dumb UI — меню для замены/удаления poster'а |
| `BulkThumbnailPanel` | `src/features/admin/components/BulkThumbnailPanel.tsx` | Admin panel для ретроактивной обработки |
| `generateThumbnail` | `src/app/api/admin/generate-thumbnail/route.ts` | Route Handler для генерации |
| `bulkGenerateThumbnails` | `src/app/api/admin/bulk-generate-thumbnails/route.ts` | Route Handler для массовой обработки |
| `deleteThumbnail` | `src/lib/storage/thumbnails.ts` | Вспомогательная функция для удаления из Storage |

#### Изменения существующих компонент

- `LazyMediaWrapper.tsx`: Использует `thumbnail_url` для video poster'а. Fallback на первый кадр если отсутствует.
- `MediaUpload` (в редакторе): Расширен предпросмотром poster'а и контекстным меню.

### 7. API Endpoints

| Метод | Путь | Авторизация | Описание |
|---|---|---|---|
| `POST` | `/api/admin/generate-thumbnail` | Admin only | Генерирует thumbnail для одного видео |
| `POST` | `/api/admin/bulk-generate-thumbnails` | Admin only | Массовая генерация для всех без thumbnail'а |
| `POST` | `/api/admin/upload-poster` | Admin only | Ручная загрузка poster-изображения |
| `DELETE` | `/api/admin/thumbnail` | Admin only | Удаляет thumbnail и устанавливает NULL |

### 8. Интеграция с Supabase

**Server client:** `await createClient()` (service role) для доступа к Storage и обновления `thumbnail_url`.  
**RLS:** Дополнительная политика для `post_media` — admin может обновлять `thumbnail_url`:

```sql
-- Если ещё не существует под UPDATE политикой admin_all
-- Проверить что admin_all уже покрывает все поля
```

**Storage RLS:** Admin может писать в `post_media/thumbnails/`, public может читать.

---

## Пользовательские истории

### Story 8.1: Автоматическая генерация thumbnail'а при сохранении объекта

**As a** автор,  
**I want** чтобы система автоматически создавала poster из первого кадра моего видео,  
**So that** в ленте отображается привлекательный предпросмотр, а не пустой кадр.

**Критерии приёмки:**

**Given** автор создаёт новый объект с видео без установленного poster'а  
**When** нажимает "Objavi"  
**Then** объект сохраняется менее чем за 3 секунды  
**And** система в фоне из первого кадра видео генерирует изображение 640×360 px  
**And** изображение загружается в Supabase Storage по пути `post_media/thumbnails/{id}_thumb.jpg`  
**And** поле `thumbnail_url` в `post_media` обновляется публичным URL  
**And** когда объект появляется в ленте, для видео отображается сгенерированный poster

**Given** автор редактирует существующий объект и добавляет новое видео  
**When** сохраняет изменения  
**Then** запускается тот же механизм генерации thumbnail'а для новых видео  
**And** существующие thumbnail'ы не изменяются

---

### Story 8.2: Ручная замена poster'а в редакторе

**As a** автор,  
**I want** чтобы я мог для каждого видео в объекте вручную выбрать другое изображение как poster,  
**So that** у меня есть полный контроль над предпросмотром объекта в ленте.

**Критерии приёмки:**

**Given** автор находится в редакторе и в объекте есть хотя бы одно видео  
**When** нажимает на иконку меню рядом с предпросмотром видео и выбирает "Spremeni poster"  
**Then** открывается file picker для загрузки изображения (JPG/PNG, макс. 2 MB)  
**And** после успешной загрузки `thumbnail_url` обновляется на новое изображение  
**And** в предпросмотре редактора сразу отображается новое изображение с меткой "Ročni poster"

**Given** автор выбрал изображение, которое не JPG или PNG  
**When** подтверждает выбор  
**Then** система отклоняет загрузку и показывает ошибку "Dovoljeni formati: JPG, PNG"  
**And** старый poster остаётся без изменений

**Given** автор хочет удалить ручной выбор poster'а  
**When** нажимает "Odstrani poster"  
**Then** `thumbnail_url` устанавливается в NULL  
**And** в ленте для этого видео используется fallback (первый кадр или стандартная иконка)

---

### Story 8.3: Ретроактивная генерация thumbnail'ов для существующих объектов

**As a** администратор,  
**I want** чтобы я мог запустить массовую генерацию недостающих poster'ов для всех существующих видео-объектов,  
**So that** мне не приходится вручную открывать каждый объект и исправлять poster'ы.

**Критерии приёмки:**

**Given** в базе существует 50+ видео без `thumbnail_url` (например, после Telegram миграции)  
**When** admin открывает admin panel → Orodja → "Generiraj manjkajoče postere" и нажимает "Zaženi zdaj"  
**Then** отображается progress bar и система начинает обрабатывать видео  
**And** обрабатывается максимум 5 видео одновременно  
**And** каждое успешно обработанное видео получает `thumbnail_url`  
**And** в конце отображается отчёт: "45/50 uspešno, 5 napak" со списком ID неудачных

**Given** admin хочет запустить команду ещё раз  
**When** нажимает "Zaženi zdaj"  
**Then** пропускаются все видео, которые уже имеют `thumbnail_url`  
**And** обрабатываются только необработанные

**Given** во время выполнения возникает ошибка при одном видео (например, повреждённый файл)  
**When** ошибка возникает  
**Then** обработка не прерывается  
**And** ошибка записывается в отчёт  
**And** продолжается со следующим видео

---

### Story 8.4: Повторная генерация и удаление thumbnail'а

**As a** автор,  
**I want** чтобы я мог для конкретного видео повторно сгенерировать poster или удалить его,  
**So that** я могу исправить плохо выбранный первый кадр или избавиться от нежелательного изображения.

**Критерии приёмки:**

**Given** видео уже имеет сгенерированный или ручной poster  
**When** автор в редакторе нажимает "Znova ustvari poster"  
**Then** старый thumbnail удаляется из Storage  
**And** генерируется новый thumbnail из текущего видео  
**And** `thumbnail_url` обновляется

**Given** автор нажимает "Odstrani poster"  
**When** подтверждает действие  
**Then** thumbnail удаляется из Storage (если не используется где-то ещё)  
**And** `thumbnail_url` устанавливается в NULL  
**And** в предпросмотре отображается fallback

---

## FR Coverage Map

| FR | Story | Статус |
|---|---|---|
| FR8.1 | Story 8.1 | [M] Автоматическая генерация при сохранении |
| FR8.2 | Story 8.2 | [M] Отображение poster'а в редакторе |
| FR8.3 | Story 8.2 | [S] Ручная замена poster'а |
| FR8.4 | Story 8.3 | [M] Ретроактивная обработка |
| FR8.5 | Story 8.1 | [M] Отображение в ленте/галереях |
| FR8.6 | Story 8.4 | [S] Удаление при удалении видео |
| FR8.7 | Story 8.4 | [S] Повторная генерация thumbnail'а |

## NFR Coverage Map

| NFR | Покрытие | Как |
|---|---|---|
| NFR8.1 | Story 8.1 | Асинхронная генерация, не ждёт HTTP response |
| NFR8.2 | Story 8.1 | ffmpeg с настройкой качества и разрешения |
| NFR8.3 | Story 8.3 | Batch с 5-worker'ами, error handling, delay 200ms |
| NFR8.4 | Story 8.2 | Валидация MIME-типа и размера на сервере |
| NFR8.5 | Story 8.3, 8.4 | Проверка `thumbnail_url IS NULL` перед генерацией; overwrite при повторной |
| NFR8.6 | Story 8.2 | `aria-label`, keyboard navigation, 44px touch target |

---

## Критерии готовности (Definition of Done)

- [ ] Все видео без `thumbnail_url` автоматически обрабатываются при следующем сохранении объекта.
- [ ] Editor отображает poster'ы для видео с возможностью ручной замены.
- [ ] Admin может запустить массовую генерацию и получить отчёт.
- [ ] `LazyMediaWrapper` использует `thumbnail_url` для всех видео.
- [ ] Старые thumbnail'ы удаляются из Storage при удалении видео или повторной генерации.
- [ ] Все NFR выполнены (время, качество, идемпотентность).
- [ ] E2E тесты для upload видео + генерации thumbnail'а.
- [ ] Unit тесты для `generateThumbnail` utility.

---

## Открытые вопросы (Open Questions)

1. **✅ ЗАКРЫТО — ffmpeg.wasm локация:** Vercel Function не хватает RAM для ffmpeg.wasm при bulk/одновременных вызовах. Решение: Canvas (client-side) для workflow автора + Supabase Edge Function для bulk/fallback. Альтернатива: Hetzner-deployed service (проект уже имеет `hetzner-deploy/`).
2. **Telegram миграция:** Имеют ли видео из Telegram уже прикреплённые thumbnail'ы? Если нет, Story 8.3 будет первым шагом после миграции.
3. **Storage cleanup:** Хотим ли периодическую очистку осиротевших thumbnail'ов (cron job), или достаточно CASCADE при удалении?
