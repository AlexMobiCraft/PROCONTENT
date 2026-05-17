# Story 8.1: Avtomatsko generiranje thumbnaila ob shranjevanju objave

Status: ready-for-dev

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

- [ ] Task 1: Canvas-генерация на стороне клиента (AC: 1, 2, 4)
  - [ ] Subtask 1.1: Создать `src/lib/media/generateVideoThumbnail.ts` — функция, принимающая `File` или `URL`, создающая `<video>` элемент, seekTo(0.1), рисующая на `<canvas>`, возвращающая `Blob` (image/jpeg, 0.85)
  - [ ] Subtask 1.2: Создать `src/lib/media/uploadThumbnail.ts` — функция, принимающая `Blob` и `post_media_id`, загружающая в Storage bucket `post_media/thumbnails/{id}_thumb.jpg`, возвращающая public URL
  - [ ] Subtask 1.3: Создать `src/lib/media/updateThumbnailUrl.ts` — функция, обновляющая `thumbnail_url` в `post_media` через Supabase client
  - [ ] Subtask 1.4: Создать `src/features/editor/components/VideoThumbnailGenerator.tsx` — Smart container, управляющий статусом генерации (idle | generating | success | error) и координирующий вышеперечисленные шаги
- [ ] Task 2: Интеграция в MediaUploader workflow (AC: 1, 2)
  - [ ] Subtask 2.1: Расширить `MediaSortableItem.tsx` (или создать `MediaItemPreview.tsx` как Dumb UI) — отображает poster с overlay-иконкой видео и индикатором загрузки
  - [ ] Subtask 2.2: В `MediaUploader.tsx` после добавления видео-файла запускать `VideoThumbnailGenerator` для асинхронной генерации poster
  - [ ] Subtask 2.3: Обеспечить, чтобы `preview_url` для видео (ObjectURL) не перекрывался poster — poster отображается отдельно
- [ ] Task 3: Server fallback API (AC: 4)
  - [ ] Subtask 3.1: Создать `src/app/api/admin/generate-thumbnail-fallback/route.ts` — Route Handler, принимающий `{videoUrl, postMediaId}`, скачивающий видео, генерирующий thumbnail (используя `ffmpeg.wasm` или внешний сервис), загружающий в Storage
  - [ ] Subtask 3.2: Проверить admin-аутентификацию в fallback endpoint
- [ ] Task 4: Интеграция с сохранением публикации (AC: 1, 2)
  - [ ] Subtask 4.1: В PostForm / API-вызове для сохранения проверить, что все видео-записи в `post_media` имеют `thumbnail_url` перед отправкой финального PUT/POST
  - [ ] Subtask 4.2: Если генерация ещё идёт при клике "Objavi", показать предупреждение "Generiranje posterjev v teku..." или дождаться завершения
- [ ] Task 5: Обновление LazyMediaWrapper для отображения thumbnail (AC: 1)
  - [ ] Subtask 5.1: Проверить, что `LazyMediaWrapper.tsx` корректно использует `thumbnail_url` для video poster (уже частично реализовано — проверить fallback на первый кадр, если `thumbnail_url` отсутствует)
  - [ ] Subtask 5.2: Проверить, что `LazyMediaWrapper.tsx` не отображает пустой/чёрный предпросмотр
- [ ] Task 6: Миграция базы и настройки Storage
  - [ ] Subtask 6.1: Создать миграцию `031_add_thumbnail_index.sql` — индекс для быстрого поиска видео-записей без thumbnail
  - [ ] Subtask 6.2: Проверить/настроить Storage RLS политики для bucket `post_media/thumbnails/` (admin может писать, public может читать)
- [ ] Task 7: Тесты
  - [ ] Subtask 7.1: Unit-тесты для `generateVideoThumbnail.ts` (mock video element, canvas)
  - [ ] Subtask 7.2: E2E-тест: загрузка видео в редактор → проверить, что отображается poster в превью
  - [ ] Subtask 7.3: Интеграционный тест для fallback API

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

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
