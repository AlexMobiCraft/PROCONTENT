---
baseline_commit: 56952b35109b54ff17d671b0636fffe0d1ba4054
---

# Story 8.1: Avtomatsko generiranje thumbnaila ob shranjevanju objave

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

Как автор,
я хочу, чтобы система автоматически создавала poster (thumbnail) из первого кадра моего видео,
чтобы в ленте отображался привлекательный превью вместо пустого или чёрного кадра.

## Acceptance Criteria

**Given** автор создаёт новую публикацию с видео без установленного poster  
**When** нажимает "Objavi"  
**Then** публикация сохраняется менее чем за 3 секунды  
**And** система в фоне из первого кадра видео (currentTime = 0.1s) создаёт изображение 640×360 px (JPEG, качество 85 %)  
**And** изображение загружается в Supabase Storage по пути `post_media/thumbnails/{post_media_id}_thumb.jpg`  
**And** поле `thumbnail_url` в `post_media` обновляется публичным URL  
**And** когда публикация появляется в ленте, для видео отображается созданный poster

**Given** автор редактирует существующую публикацию и добавляет новое видео  
**When** сохраняет изменения  
**Then** запускается тот же механизм генерации thumbnail для новых видео  
**And** существующие thumbnail не изменяются

**Given** видео уже имеет вручную установленный poster (thumbnail_url не NULL)  
**When** автор сохраняет публикацию  
**Then** автоматическая генерация пропускается — ручной выбор имеет приоритет

**Given** Canvas-генерация на стороне клиента не удалась (CORS, неподдерживаемый формат)  
**When** отправляется запрос на серверный fallback  
**Then** используется `POST /api/admin/generate-thumbnail-fallback` для генерации thumbnail  
**And** результат сохраняется так же, как при успешной Canvas-генерации

## Tasks / Subtasks

- [x] Task 1: Canvas-генерация на стороне клиента (AC: 1, 2, 4)
  - [x] Subtask 1.1: Создать `src/lib/media/generateVideoThumbnail.ts` — функция, принимающая `File` или `URL`, создающая `<video>` элемент, seekTo(0.1), рисующая на `<canvas>`, возвращающая `Blob` (image/jpeg, 0.85)
  - [x] Subtask 1.2: Создать `src/lib/media/uploadThumbnail.ts` — функция, принимающая `Blob` и `post_media_id`, загружающая в Storage bucket `post_media/thumbnails/{id}_thumb.jpg`, возвращающая public URL
  - [x] Subtask 1.3: Создать `src/lib/media/updateThumbnailUrl.ts` — функция, обновляющая `thumbnail_url` в `post_media` через Supabase client
  - [x] Subtask 1.4: Создать `src/features/editor/components/VideoThumbnailGenerator.tsx` — Smart container, управляющий статусом генерации (idle | generating | success | error) и координирующий вышеперечисленные шаги
- [x] Task 2: Интеграция в MediaUploader workflow (AC: 1, 2)
  - [x] Subtask 2.1: Расширить `MediaSortableItem.tsx` (или создать `MediaItemPreview.tsx` как Dumb UI) — отображает poster с overlay-иконкой видео и индикатором загрузки
  - [x] Subtask 2.2: В `MediaUploader.tsx` после добавления видео-файла запускать `VideoThumbnailGenerator` для асинхронной генерации poster
  - [x] Subtask 2.3: Обеспечить, чтобы `preview_url` для видео (ObjectURL) не перекрывался poster — poster отображается отдельно
- [x] Task 3: Server fallback API (AC: 4)
  - [x] Subtask 3.1: Создать `src/app/api/admin/generate-thumbnail-fallback/route.ts` — Route Handler, принимающий `{videoUrl, postMediaId}`, скачивающий видео, генерирующий thumbnail (используя `ffmpeg.wasm` или внешний сервис), загружающий в Storage — ⚠️ извлечение кадра отложено (вариант "skeleton без зависимости"); auth/валидация/SSRF/контракт готовы, возвращает 501
  - [x] Subtask 3.2: Проверить admin-аутентификацию в fallback endpoint
- [x] Task 4: Интеграция с сохранением публикации (AC: 1, 2)
  - [x] Subtask 4.1: В PostForm / API-вызове для сохранения проверить, что все видео-записи в `post_media` имеют `thumbnail_url` перед отправкой финального PUT/POST — реализовано как загрузка thumbnail сразу после insert post_media (post_media_id появляется только после insert), best-effort
  - [x] Subtask 4.2: Если генерация ещё идёт при клике "Objavi", показать предупреждение "Generiranje posterjev v teku..." или дождаться завершения
- [x] Task 5: Обновление LazyMediaWrapper для отображения thumbnail (AC: 1)
  - [x] Subtask 5.1: Проверить, что `LazyMediaWrapper.tsx` корректно использует `thumbnail_url` для video poster (уже частично реализовано — проверить fallback на первый кадр, если `thumbnail_url` отсутствует) — подтверждено: poster=thumbnail_url, fallback currentTime=0.001; покрыто тестами
  - [x] Subtask 5.2: Проверить, что `LazyMediaWrapper.tsx` не отображает пустой/чёрный предпросмотр — подтверждено: для видео всегда рендерится `<video>` с первым кадром
- [x] Task 6: Миграция базы и настройки Storage
  - [x] Subtask 6.1: Создать миграцию `031_add_thumbnail_index.sql` — индекс для быстрого поиска видео-записей без thumbnail — создан как `045_add_thumbnail_index.sql` (номер 031 уже занят)
  - [x] Subtask 6.2: Проверить/настроить Storage RLS политики для bucket `post_media/thumbnails/` (admin может писать, public может читать) — добавлена UPDATE-политика для upsert; INSERT/public SELECT уже были (022), запись thumbnail_url admin-gated на уровне БД (016)
- [x] Task 7: Тесты
  - [x] Subtask 7.1: Unit-тесты для `generateVideoThumbnail.ts` (mock video element, canvas)
  - [x] Subtask 7.2: E2E-тест: загрузка видео в редактор → проверить, что отображается poster в превью — реализовано как интеграционный тест (Vitest + Testing Library), т.к. Playwright в проекте не настроен (потребовал бы новой зависимости)
  - [x] Subtask 7.3: Интеграционный тест для fallback API

### Review Findings

- [x] [Review][Defer] Server fallback не выполняет AC4 — deferred: fallback требует отдельного технического решения и будет вынесен в будущую story. AC4 требует, чтобы `POST /api/admin/generate-thumbnail-fallback` генерировал thumbnail и сохранял результат так же, как Canvas-путь. Текущий route после auth/валидации всегда возвращает `501`, а story одновременно отмечает AC4 как частично покрытый и статус `review`.
- [x] [Review][Patch] Сохранение публикации может блокироваться thumbnail-пайплайном дольше 3 секунд [src/features/admin/components/PostForm.tsx:300]
- [x] [Review][Patch] Storage UPDATE policy разрешает всем authenticated пользователям перезаписывать объекты bucket `post_media` [supabase/migrations/045_add_thumbnail_index.sql:22]
- [x] [Review][Patch] Thumbnail-файлы не удаляются при удалении поста/медиа и могут оставаться orphaned в Storage [src/features/admin/api/posts.ts:372]
- [x] [Review][Patch] Новые source-файлы содержат большое количество комментариев/JSDoc вопреки правилу проекта `No comments unless explicitly requested` [src/lib/media/generateVideoThumbnail.ts:1]
- [x] [Review][Patch] Сохранение всё ещё ждёт thumbnail-pipeline и fallback fetch без timeout, что может нарушить бюджет `<3 seconds`/NFR8.1 [src/features/admin/api/posts.ts:206]
- [x] [Review][Patch] Submit без готового `thumbnail_blob` может уйти в `501` fallback и показать success без созданного poster [src/features/admin/components/PostForm.tsx:299]
- [x] [Review][Patch] Параллельные thumbnail callbacks могут перетереть результаты друг друга через stale `itemsRef.current` [src/features/admin/components/MediaUploader.tsx:75]
- [x] [Review][Patch] Storage RLS всё ещё разрешает non-admin `authenticated` создавать/удалять thumbnail objects через старые broad policies [supabase/migrations/022_create_post_media_bucket.sql:11]
- [x] [Review][Patch] Если upload thumbnail succeeds, а `updateThumbnailUrl` fails, новый thumbnail остаётся orphaned в Storage [src/features/admin/api/postThumbnails.ts:59]
- [x] [Review][Patch] `buildVideoThumbnailTasks` silently drops video thumbnail work when inserted `post_media` row is missing/unmatched [src/features/admin/api/postThumbnails.ts:40]
- [x] [Review][Patch] Очень короткие видео seek'аются в exact duration и могут дать blank/timeout poster [src/lib/media/generateVideoThumbnail.ts:105]
- [x] [Review][Patch] Новые/изменённые файлы всё ещё добавляют comments/JSDoc вопреки repo rule `No comments unless explicitly requested` [src/features/admin/types.ts:53]

## Dev Notes

### Архитектурный контекст и ограничения

- **Stack:** Next.js 16.1.6 (App Router), TypeScript 5, Tailwind CSS 4, Supabase (Auth, DB, Storage), Zustand 5.
- **Структура:** Feature-based архитектура. Вся бизнес-логика в `src/features/[feature]/`. Базовый UI в `src/components/ui/`.
- **Smart/Dumb:** Smart Containers (например, `VideoThumbnailGenerator`) управляют состоянием и вызывают API. Dumb UI (например, `MediaItemPreview`) получает только props.
- **Snake_case:** Все поля из базы используются напрямую в `snake_case`. Не создавать mapper'ы в `camelCase`.
- **Next.js 16 специфика:** `src/proxy.ts` вместо `middleware.ts`. Proxy ДОЛЖЕН игнорировать `/auth/confirm`.
- **Storage:** Используется bucket `post_media` (не `gallery-media` или `inline-images`). Thumbnail'ы сохраняются в подпапку `thumbnails/`.
- **LazyMediaWrapper:** Уже использует `thumbnail_url` для video poster. Если отсутствует, fallback на первый кадр (currentTime = 0.001). Проверить `@/components/media/LazyMediaWrapper.tsx:44-52` и `@/components/media/LazyMediaWrapper.tsx:76-85`.

### Ключевые реализационные моменты

1. **Canvas-генерация — primary path.** Это означает, что генерация происходит в браузере сразу после загрузки видео (ещё до клика на "Objavi"). Это обеспечивает мгновенный визуальный feedback и устраняет необходимость в асинхронных job'ах в workflow автора.
2. **Cross-origin:** Video-элемент ДОЛЖЕН иметь `crossOrigin="anonymous"`, чтобы Canvas не получил "tainted" состояние. Проверить CORS-настройки на Supabase Storage.
3. **Качество:** `canvas.toBlob('image/jpeg', 0.85)` — целевой размер файла ≤ 150 KB. Если blob слишком большой, перед загрузкой уменьшить размеры до 640×360.
4. **Асинхронность:** Генерация thumbnail НЕ ДОЛЖНА блокировать сохранение публикации. Если пользователь кликнет "Objavi" до завершения генерации, либо дождаться завершения, либо сохранить публикацию без thumbnail и сгенерировать в фоне.
5. **Идемпотентность:** Если `thumbnail_url` уже существует, генерация пропускается. Если генерация повторяется (например, повторное сохранение), старый thumbnail перезаписывается (overwrite).

### Существующие компоненты для расширения

- `@/src/components/media/LazyMediaWrapper.tsx` — уже поддерживает `thumbnail_url` для video poster. Проверить fallback-логику.
- `@/src/features/admin/components/MediaUploader.tsx` — управляет загрузкой медиа, drag-and-drop, сортировкой. Здесь добавляется trigger для генерации.
- `@/src/features/admin/components/MediaSortableItem.tsx` — отображение отдельного медиа в списке. Расширить poster-превью.
- `@/src/features/admin/types.ts` — типы `MediaItem`, `NewMediaItem`, `ExistingMediaItem`. `ExistingMediaItem` уже имеет `thumbnail_url: string | null`.

### API и Storage

- **Storage path:** `post_media/thumbnails/{post_media_id}_thumb.jpg`
- **Client upload:** Использовать Supabase client `storage.from('post_media').upload(path, blob, { contentType: 'image/jpeg', upsert: true })`
- **Public URL:** `storage.from('post_media').getPublicUrl(path)`
- **Server fallback:** `POST /api/admin/generate-thumbnail-fallback` — проверить admin-аутентификацию с `await createClient()` + `getUser()` + проверить `role === 'admin'`

### Testing Notes

- **Unit-тесты:** Mock `HTMLVideoElement` и `HTMLCanvasElement`. Проверить, что `generateVideoThumbnail` возвращает Blob с `type === 'image/jpeg'`.
- **E2E-тесты:** Playwright — загрузка MP4 в редактор, проверить, что в превью отображается изображение вместо чёрного квадрата.
- **API-тесты:** Проверить admin-аутентификацию на fallback endpoint. Проверить, что неавторизованный вызов возвращает `401`.

### Performance Notes

- Canvas-генерация занимает ~200-500ms на среднем мобильном телефоне.
- Использовать `requestAnimationFrame` для seek-операции, чтобы избежать flash.
- `MAX_VIDEO_SIZE = 100 MB` — очень большие видео-файлы могут вызвать проблемы с Canvas. Fallback API покрывает эти крайние случаи.

### UI / Slovenian Language

Vsi uporabniško vidni teksti v UI morajo biti v slovenščini:
- "Generiranje posterja..." (indikator nalaganja)
- "Poster je bil ustvarjen" (toast ob uspehu)
- "Napaka pri ustvarjanju posterja. Poskusite znova." (toast ob napaki)

### Security Notes

- Vsi API endpointi v `/api/admin/*` MORAJO preveriti admin avtentikacijo.
- Client-side upload v Storage zahteva pravilne RLS politike (admin write, public read).
- Preveri MIME tip prejšetega bloba (`image/jpeg`) pred uploadom.

### References

- [Source: _bmad-output/planning-artifacts/prd-video-thumbnails.md#FR8.1]
- [Source: _bmad-output/planning-artifacts/prd-video-thumbnails.md#NFR8.1]
- [Source: _bmad-output/planning-artifacts/prd-video-thumbnails.md#NFR8.2]
- [Source: _bmad-output/planning-artifacts/architecture.md#Storage Bucket Architecture]
- [Source: _bmad-output/planning-artifacts/architecture.md#Smart Container / Dumb UI]
- [Source: _bmad-output/project-context.md#Critical Implementation Rules]
- [Source: src/components/media/LazyMediaWrapper.tsx]
- [Source: src/features/admin/components/MediaUploader.tsx]
- [Source: src/features/admin/components/MediaSortableItem.tsx]
- [Source: src/features/admin/types.ts]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Amelia, dev-story workflow)

### Debug Log References

- `npm run typecheck` — чисто
- `npx eslint` (файлы story) — чисто (1 обоснованный `eslint-disable react-hooks/refs` в MediaUploader для latest-value ref)
- `npx vitest run` — 97 файлов, 1321 тест, все зелёные
- После разрешения находок ревью: `npm run typecheck` чисто, `npx eslint` (10 файлов) чисто,
  `npx vitest run` — 97 файлов, 1326 тестов, все зелёные

### Completion Notes List

**Архитектурное решение (важно):** Путь thumbnail `thumbnails/{post_media_id}_thumb.jpg`
требует `post_media_id`, которого нет до вставки записи в БД. Поэтому реализован гибрид:
- **Add-time (браузер):** Canvas-генерация blob сразу при добавлении видео в форму
  (мгновенный визуальный feedback, poster в превью). Blob хранится в `NewMediaItem.thumbnail_blob`.
- **Save-time (posts.ts):** после insert `post_media` (с `.select('id, url')`) blob загружается
  в Storage по реальному id и `thumbnail_url` обновляется. Best-effort (не блокирует сохранение).

**Решение пользователя по Task 3 (серверный fallback, AC 4):** выбран вариант "skeleton без
новой зависимости". Route `/api/admin/generate-thumbnail-fallback` реализован с полноценной
admin-авторизацией, валидацией входа и SSRF-защитой, но серверное извлечение кадра возвращает
**501** (движок ffmpeg.wasm/системный ffmpeg/внешний сервис подключается позже). Клиентский
Canvas-путь покрывает практически все реальные случаи; при отсутствии blob save-time код
вызывает fallback (получает 501 → логируется как best-effort). **AC 4 покрыт частично** —
вызов fallback есть, серверная генерация отложена по согласованию.

**Прочее:**
- Миграция создана как `045_...` (черновой `031` уже занят `031_fix_profiles_select_rls.sql`).
- Task 5 (LazyMediaWrapper) — изменения кода не потребовались: poster из `thumbnail_url` и
  fallback на первый кадр (`currentTime=0.001`) уже реализованы; подтверждено 33 тестами.
- Task 7.2 (E2E) реализован как интеграционный тест Vitest+Testing Library (Playwright в проекте
  не настроен; добавление = новая зависимость).
- ✅ AC 1, 2, 3 — реализованы полностью. ⚠️ AC 4 — частично (см. выше).
- Миграцию `045` нужно применить к БД на этапе деплоя (DDL не применялся к боевой БД).

**Разрешение находок код-ревью (2026-06-08):** 4 [Review][Patch] пункта закрыты.
- ✅ [Med] Finding 1 — убрано блокирующее 10-сек ожидание генерации в `PostForm.onSubmit`;
  заменено на неблокирующее предупреждение «Generiranje posterjev v teku...» (Task 4.2
  явно разрешает альтернативу «показать предупреждение»). Сохранение больше не превышает
  бюджет <3 сек из-за thumbnail-пайплайна. Покрыто тестом PostForm.
- ✅ [Med] Finding 2 — Storage UPDATE-политика в `045` ограничена ролью admin
  (`EXISTS profiles.role='admin'`, паттерн из миграции 016); раньше любой authenticated
  мог перезаписывать объекты bucket `post_media`. Миграция идемпотентна и ещё не
  применялась к боевой БД, поэтому отредактирована на месте.
- ✅ [Med] Finding 3 — `updatePost` (removedItems) и `deletePost` теперь удаляют
  thumbnail-файлы из Storage вместе с основным медиа (через `removeStorageFiles`,
  публичный URL thumbnail парсится тем же маркером bucket). Покрыто тестами posts.test.ts.
- ✅ [Low] Finding 4 — сокращены избыточные JSDoc/комментарии в новых файлах
  (`generateVideoThumbnail.ts`, `uploadThumbnail.ts`, `updateThumbnailUrl.ts`,
  `postThumbnails.ts`, `VideoThumbnailGenerator.tsx`, `MediaItemPreview.tsx`, fallback route)
  и Story-теги в изменённых файлах; оставлены только неочевидные пояснения (CORS,
  обоснования `eslint-disable`). Линт и typecheck чисты.

**Разрешение находок код-ревью — Раунд 2 (2026-06-08):** 8 [Review][Patch] пунктов закрыты.
- ✅ Finding 1 — `applyNewVideoThumbnails` теперь ограничен бюджетом (`Promise.race`,
  `THUMBNAIL_PIPELINE_BUDGET_MS=2500`), а `requestThumbnailFallback` использует
  `AbortController`+`setTimeout` (`FALLBACK_FETCH_TIMEOUT_MS=2000`). Сохранение больше не
  может зависнуть на upload/fetch → бюджет <3s/NFR8.1 соблюдён. Тест бюджета с fake timers.
- ✅ Finding 2 — серверный fallback вызывается ТОЛЬКО при `thumbnail_status==='error'`
  (genuine Canvas failure, AC4). Для `'generating'`/`'idle'` без blob — best-effort skip
  (лента отрисует первый кадр через LazyMediaWrapper, пользователь уведомлён `toast.info`).
  Submit больше не уходит в бесполезный 501. Тест на пропуск fallback для `generating`.
- ✅ Finding 3 — гонка параллельных thumbnail-колбэков устранена: `updateNewItem` синхронно
  продвигает `itemsRef.current = next` перед `onChange`, поэтому второй колбэк в том же тике
  видит первый патч и не перетирает его. Детерминированный red-green тест (MediaUploaderRace).
- ✅ Finding 4 — миграция `046_restrict_post_media_storage_admin.sql`: broad INSERT/DELETE
  политики из `022` заменены на admin-gated (`EXISTS profiles.role='admin'`, паттерн 016/045).
  Раньше любой `authenticated` мог создавать/удалять объекты bucket `post_media`. Не применялась
  к боевой БД (применить на деплое).
- ✅ Finding 5 — при сбое `updateThumbnailUrl` после успешного `uploadThumbnail` загруженный
  thumbnail удаляется из Storage (`removeStorageFiles`), чтобы не осиротел. Покрыто тестом.
- ✅ Finding 6 — `buildVideoThumbnailTasks` логирует `console.warn`, когда у видео нет
  сопоставленной inserted-строки `post_media` (раньше тихо пропускал). Покрыто тестом.
- ✅ Finding 7 — `generateVideoThumbnail` сикает на `min(seekTime, duration/2)` вместо
  exact duration → короткие видео не дают blank/timeout poster. Покрыто тестом (duration=0.05).
- ✅ Finding 8 — убраны избыточные JSDoc/комментарии в файлах Story 8.1 (types.ts,
  VideoThumbnailGenerator, MediaUploader, PostForm, uploadThumbnail, fallback route) согласно
  правилу AGENTS.md «No comments unless explicitly requested». Оставлены функциональные
  `eslint-disable` и критичные неочевидные пояснения (CORS-taint, SSRF). Линт/typecheck чисты.

### File List

**Новые файлы:**
- `src/lib/media/generateVideoThumbnail.ts`
- `src/lib/media/uploadThumbnail.ts`
- `src/lib/media/updateThumbnailUrl.ts`
- `src/features/editor/components/VideoThumbnailGenerator.tsx`
- `src/features/admin/components/MediaItemPreview.tsx`
- `src/features/admin/api/postThumbnails.ts`
- `src/app/api/admin/generate-thumbnail-fallback/route.ts`
- `supabase/migrations/045_add_thumbnail_index.sql`
- `tests/unit/lib/media/generateVideoThumbnail.test.ts`
- `tests/unit/lib/media/uploadThumbnail.test.ts`
- `tests/unit/lib/media/updateThumbnailUrl.test.ts`
- `tests/unit/features/admin/components/MediaItemPreview.test.tsx`
- `tests/unit/features/admin/components/MediaUploaderThumbnail.test.tsx`
- `tests/unit/features/admin/api/postThumbnails.test.ts`
- `tests/unit/features/admin/api/posts.thumbnails.test.ts`
- `tests/unit/app/api/admin/generate-thumbnail-fallback/route.test.ts`
- `supabase/migrations/046_restrict_post_media_storage_admin.sql` (CR Раунд 2, Finding 4)
- `tests/unit/features/admin/components/MediaUploaderRace.test.tsx` (CR Раунд 2, Finding 3)

**Изменённые файлы:**
- `src/features/admin/types.ts` — `ThumbnailStatus`, поля thumbnail в `NewMediaItem`
- `src/features/admin/components/MediaUploader.tsx` — триггер генерации, колбэки, revoke
- `src/features/admin/components/MediaSortableItem.tsx` — использует `MediaItemPreview`
- `src/features/admin/components/PostForm.tsx` — неблокирующее предупреждение генерации, трекинг poster ObjectURL
- `src/features/admin/api/posts.ts` — `.select('id, url')` + применение thumbnail; удаление orphaned thumbnail при delete/remove
- `tests/unit/features/admin/api/posts.test.ts` — моки `.select` после insert post_media; тесты удаления thumbnail (Finding 3)
- `tests/unit/features/admin/components/PostForm.test.tsx` — тест неблокирующего сабмита при генерации (Finding 1)

**Изменённые файлы (CR Раунд 2):**
- `src/features/admin/api/postThumbnails.ts` — bounded pipeline + AbortController fallback (F1),
  fallback только при error (F2), orphan cleanup при сбое update (F5), warn при пропуске (F6)
- `src/features/admin/components/MediaUploader.tsx` — синхронное продвижение `itemsRef.current` (F3)
- `src/lib/media/generateVideoThumbnail.ts` — seek `min(seekTime, duration/2)` (F7)
- `src/features/admin/types.ts`, `src/features/editor/components/VideoThumbnailGenerator.tsx`,
  `src/features/admin/components/PostForm.tsx`, `src/lib/media/uploadThumbnail.ts`,
  `src/app/api/admin/generate-thumbnail-fallback/route.ts`, `src/features/admin/api/posts.ts` — чистка комментариев (F8)
- `tests/unit/features/admin/api/postThumbnails.test.ts` — тесты F1/F2/F5/F6
- `tests/unit/lib/media/generateVideoThumbnail.test.ts` — тест F7 (короткое видео)

### Change Log

- 2026-06-08: Реализована Story 8.1 — автоматическая Canvas-генерация thumbnail видео при
  сохранении (Tasks 1–7). Серверный fallback — skeleton (501) по согласованию. 36 новых тестов.
- 2026-06-08: Разрешены находки код-ревью — 4 [Patch] items (неблокирующий сабмит,
  admin-only Storage UPDATE policy, удаление orphaned thumbnail, сокращение комментариев).
  +5 новых тестов (всего 1326 зелёных), typecheck/eslint чисты. Status → review.
- 2026-06-08: Разрешены находки код-ревью Раунд 2 — 8 [Patch] items (bounded thumbnail
  pipeline + AbortController fallback, fallback только при Canvas-error, гонка thumbnail
  callbacks, admin-only Storage INSERT/DELETE миграция 046, cleanup orphaned thumbnail при
  сбое update, warn при пропуске видео, seek коротких видео, чистка комментариев).
  +6 новых тестов (всего 1331 зелёный), typecheck/eslint чисты. Status → review.
