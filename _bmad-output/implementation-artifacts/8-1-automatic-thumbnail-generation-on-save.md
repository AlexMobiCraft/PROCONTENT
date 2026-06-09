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
**Then** если генерация poster ещё идёт, сохранение дожидается её завершения и включает готовый poster в публикацию (приоритет — наличие poster, а не скорость; требование `<3 сек` снято решением пользователя)  
**And** если генерация завершилась ошибкой или poster не удалось создать в отведённое время (таймаут), публикация сохраняется **без poster**, а пользователю показывается уведомление, что poster не был создан автоматически и его можно добавить вручную позже (Story 8.2)  
**And** система из первого кадра видео (currentTime = 0.1s) создаёт изображение 640×360 px (JPEG, качество 85 %)  
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

**Отложенный scope:** реальная server-side генерация thumbnail через `POST /api/admin/generate-thumbnail-fallback` не входит в Story 8.1. В текущей story endpoint является skeleton-заделом с auth/admin/body/SSRF validation и временным `501`; извлечение кадра, upload thumbnail и update `post_media.thumbnail_url` будут вынесены в отдельную будущую story.

## Tasks / Subtasks

- [x] Task 1: Canvas-генерация на стороне клиента (AC: 1, 2)
  - [x] Subtask 1.1: Создать `src/lib/media/generateVideoThumbnail.ts` — функция, принимающая `File` или `URL`, создающая `<video>` элемент, seekTo(0.1), рисующая на `<canvas>`, возвращающая `Blob` (image/jpeg, 0.85)
  - [x] Subtask 1.2: Создать `src/lib/media/uploadThumbnail.ts` — функция, принимающая `Blob` и `post_media_id`, загружающая в Storage bucket `post_media/thumbnails/{id}_thumb.jpg`, возвращающая public URL
  - [x] Subtask 1.3: Создать `src/lib/media/updateThumbnailUrl.ts` — функция, обновляющая `thumbnail_url` в `post_media` через Supabase client
  - [x] Subtask 1.4: Создать `src/features/editor/components/VideoThumbnailGenerator.tsx` — Smart container, управляющий статусом генерации (idle | generating | success | error) и координирующий вышеперечисленные шаги
- [x] Task 2: Интеграция в MediaUploader workflow (AC: 1, 2)
  - [x] Subtask 2.1: Расширить `MediaSortableItem.tsx` (или создать `MediaItemPreview.tsx` как Dumb UI) — отображает poster с overlay-иконкой видео и индикатором загрузки
  - [x] Subtask 2.2: В `MediaUploader.tsx` после добавления видео-файла запускать `VideoThumbnailGenerator` для асинхронной генерации poster
  - [x] Subtask 2.3: Обеспечить, чтобы `preview_url` для видео (ObjectURL) не перекрывался poster — poster отображается отдельно
- [x] Task 3: Skeleton server fallback API (реальная генерация отложена)
  - [x] Subtask 3.1: Создать `src/app/api/admin/generate-thumbnail-fallback/route.ts` — Route Handler, принимающий `{videoUrl, postMediaId}` и выполняющий auth/admin/body/SSRF validation; реальное извлечение кадра, upload thumbnail и update `thumbnail_url` отложены в отдельную будущую story, текущий skeleton возвращает 501
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
  - [x] Subtask 7.3: Интеграционный тест для skeleton fallback API

### Review Findings

- [x] [Review][Defer] Server fallback generation вынесен из Story 8.1 — fallback требует отдельного технического решения и будет оформлен будущей story. В Story 8.1 текущий `POST /api/admin/generate-thumbnail-fallback` является skeleton endpoint: auth/валидация/SSRF готовы, реальное извлечение кадра/upload/update отложены, временный `501` ожидаем.
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
- [x] [Review][Patch] Submit while thumbnail is `idle`/`generating` can permanently skip poster [src/features/admin/components/PostForm.tsx:298]
- [x] [Review][Patch] Thumbnail pipeline timeout returns while upload/update tasks keep running without cancellation or durable retry [src/features/admin/api/postThumbnails.ts:96]
- [x] [Review][Patch] `updateThumbnailUrl` treats zero-row updates as success, leaving uploaded thumbnails orphaned [src/lib/media/updateThumbnailUrl.ts:9]
- [x] [Review][Patch] New/changed files still add comments despite repo rule `No comments unless explicitly requested` [src/features/admin/api/postThumbnails.ts:76]
- [x] [Review][Patch] Submit должен ждать завершения pending thumbnail перед сохранением [src/features/admin/components/PostForm.tsx:310] — решение пользователя: блокировать до завершения генерации, даже если это может превысить `<3s`; текущий 2500 ms timeout может сохранить `finalMedia` без `thumbnail_blob`, а `runThumbnailTask` обрабатывает только `thumbnail_blob` или `thumbnail_status === 'error'`.
- [x] [Review][Patch] Fallback endpoint падает 500 на JSON body `null` вместо 400 [src/app/api/admin/generate-thumbnail-fallback/route.ts:31]
- [x] [Review][Patch] Thumbnail callback может вернуть удалённый/reordered media item из stale `itemsRef.current` [src/features/admin/components/MediaUploader.tsx:75]
- [x] [Review][Patch] `PostForm` может прочитать stale `mediaItemsRef.current` до commit последнего `onChange` [src/features/admin/components/PostForm.tsx:213]
- [x] [Review][Patch] Video fallback preview может остаться blank/black из-за `preload="none"` без poster [src/features/admin/components/MediaItemPreview.tsx:34]
- [x] [Review][Decision] Контракт save/thumbnail pipeline конфликтует: `<3s` vs 100% durable poster — решение пользователя: приоритет у сохранения `<3s`; durable thumbnail должен быть оформлен как background/deferred work с явным статусом/повтором, а не блокировать submit на 20 секунд. PRD/AC одновременно требуют, чтобы сохранение занимало ≤3 секунды независимо от генерации thumbnail, и чтобы 100% новых видео при публикации получали `thumbnail_url`. Текущий код ждёт client-generation до 20 секунд в `PostForm`, но save-time pipeline всё равно возвращается после бюджета 2500 ms и может оставить опубликованное видео без `thumbnail_url`.
- [x] [Review][Patch] Submit может сохранить `idle`/timed-out video без poster [src/features/admin/components/PostForm.tsx:312] — `waitForCondition` возвращает `void` и после таймаута код не перепроверяет `hasGeneratingThumbnail`; кроме того, новое видео со статусом `idle` не блокируется и в save-time pipeline будет пропущено без `thumbnail_blob` и без fallback.
- [x] [Review][Patch] Storage cleanup удаляет файлы даже если DB delete старых media rows не удался [src/features/admin/api/posts.ts:377] — после `deleteError` код только логирует warning и всё равно вызывает `removeStorageFiles`, что может удалить Storage-объекты при сохранённых DB-ссылках.
- [x] [Review][Patch] In-flight browser thumbnail generation не отменяется при удалении/unmount видео [src/features/editor/components/VideoThumbnailGenerator.tsx:39] — cleanup выставляет `active=false`, но `generateVideoThumbnail(file)` продолжает decode/seek/canvas до успеха или 15s timeout.
- [x] [Review][Patch] Canvas thumbnail растягивает не-16:9 видео в 640x360 вместо сохранения aspect ratio [src/lib/media/generateVideoThumbnail.ts:83] — `ctx.drawImage(video, 0, 0, width, height)` деформирует portrait/square/ultrawide видео; нужен cover/contain crop без искажения.
- [x] [Review][Patch] Story-scope comments остались вопреки правилу `No comments unless explicitly requested` [supabase/migrations/045_add_thumbnail_index.sql:1] — миграция 045 и изменённые story-scope участки всё ещё содержат prose-комментарии, добавленные в рамках этой story.
- [x] [Review][Decision] Контракт Story 8.1 всё ещё конфликтует: `<3s` save vs durable poster — решение пользователя: приоритет poster. `<3s` больше не является обязательным контрактом для этой story; submit должен ждать готовый poster или терминальную ошибку, а не молча сохранять pending video.
- [x] [Review][Patch] Закрепить выбранный контракт `приоритет poster` в Story 8.1 и убрать/заменить противоречивое требование `<3s` [8-1-automatic-thumbnail-generation-on-save.md:21] — AC и Dev Notes #4 переписаны: `<3 сек` снято. По уточнению пользователя выбран graceful degradation: submit дожидается генерации, при успехе включает poster, при ошибке/таймауте сохраняет публикацию без poster и информирует пользователя о возможности добавить poster вручную позже (Story 8.2).
- [x] [Review][Patch] Timeout ожидания thumbnail может продолжить submit с pending video без poster [src/features/admin/components/PostForm.tsx:313] — по уточнению пользователя сохранение видео без poster допустимо, но не молча: при ошибке/таймауте генерации (`hasVideoWithoutPoster`) публикация сохраняется без poster и показывается `toast.warning` (`POSTER_NOT_GENERATED_MESSAGE`) с пояснением о ручном добавлении позже. Submit больше не блокируется навсегда и не сохраняет видео без уведомления.
- [x] [Review][Patch] Late success удалённого video может утечь `thumbnail_preview_url` ObjectURL [src/features/editor/components/VideoThumbnailGenerator.tsx:31] — создание ObjectURL перенесено из генератора в `MediaUploader.handleThumbSuccess` под guard `exists`; поздний success удалённого item больше не создаёт осиротевший URL.
- [x] [Review][Patch] В diff Story 8.1 попали несвязанные `MediaLightbox` изменения с новыми prose-комментариями [src/components/media/MediaLightbox.tsx:94] — НЕ код Story 8.1: изменения принадлежат отдельному коммиту `c49c7304` (мобильный фикс свайпа lightbox), уже влитому в `main` (`git log main..HEAD -- MediaLightbox.tsx` пуст). В diff относительно `baseline_commit` они попали лишь потому, что baseline захвачен до merge main. Откат/правка здесь создали бы расхождение с `main` и отменили легитимный фикс — оставлено без изменений.
- [x] [Review][Decision] Server fallback не выполняет AC4 — решение пользователя: вариант 2, real fallback generation вынесен в отложенную будущую story. Story/AC/Tasks скорректированы: текущий `src/app/api/admin/generate-thumbnail-fallback/route.ts` считается skeleton-заделом с auth/admin/body/SSRF validation и временным `501`, а реальное server-side извлечение кадра, upload thumbnail и update `thumbnail_url` больше не заявлены как покрытие Story 8.1.
- [x] [Review][Patch] Save может показать success, хотя `thumbnail_url` фактически не сохранён [src/features/admin/components/PostForm.tsx:333] — save-time pipeline теперь возвращает фактический результат персистентности (`ThumbnailPipelineResult.allPersisted`), проброшенный в `PostForm` через колбэк `onThumbnailResult`. Toast выбирается по реальному результату: если хотя бы один blob-poster не сохранён в БД — показывается `toast.warning` (`POSTER_NOT_GENERATED_MESSAGE`), а не ложный `toast.success`.
- [x] [Review][Patch] Timeout save-time thumbnail pipeline не возвращает результат и не учитывает зависший Storage upload [src/features/admin/api/postThumbnails.ts:98] — `applyNewVideoThumbnails` теперь возвращает `{ expected, persisted, allPersisted }`. Зависший `uploadThumbnail` по истечении бюджета не попадает в `persistedIds` (task не успевает завершиться до abort) → корректно считается НЕ persisted (`allPersisted=false`), а не молча проглатывается.
- [x] [Review][Patch] Повторный thumbnail success для одного item может утечь старый ObjectURL [src/features/admin/components/MediaUploader.tsx:102] — `handleThumbSuccess` перед `createObjectURL` находит текущий item и отзывает прежний `thumbnail_preview_url` (если был), устраняя утечку при повторной генерации.
- [x] [Review][Patch] `waitForCondition` может выйти позже заданного timeout [src/lib/waitForCondition.ts:1] — последний сон ограничен остатком до дедлайна (`Math.min(intervalMs, deadline - Date.now())`), поэтому функция не перепрыгивает таймаут на целый интервал.
- [x] [Review][Patch] Story-scope изменения добавляют prose-комментарии вопреки AGENTS.md [src/features/admin/components/MediaSortableItem.tsx:72] — удалён story-scope комментарий `{/* Thumbnail / poster preview */}` (добавлен этой story). Pre-existing комментарии вне scope Story 8.1 не трогались.

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
4. **Приоритет poster + graceful degradation (решение пользователя):** генерация thumbnail имеет приоритет над скоростью сохранения. Если пользователь кликнет "Objavi" до завершения генерации, submit дожидается её завершения. При успехе готовый poster включается в публикацию. Если генерация завершилась ошибкой или не успела (таймаут), публикация сохраняется БЕЗ poster, а пользователю показывается уведомление (toast), что poster не создан автоматически и его можно добавить вручную позже (Story 8.2). Submit не блокируется навсегда. Требование `<3 сек` снято для этой story.
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
- CR Раунд 3: `npm run typecheck` чисто, `npx eslint` (8 файлов) чисто,
  `npx vitest run` — 99 файлов, 1336 тестов, все зелёные
- CR Раунд 4: `npm run typecheck` чисто, `npx eslint` (9 файлов) чисто,
  `npx vitest run` — 99 файлов, 1340 тестов, все зелёные
- CR Раунд 5: `npm run typecheck` чисто, `npx eslint` (8 файлов) чисто,
  `npx vitest run` — 100 файлов, 1349 тестов, все зелёные
- CR Раунд 6 (Full CR): `npm run typecheck` чисто, `npx eslint` (6 файлов) чисто,
  `npx vitest run` — 101 файл, 1351 тест, все зелёные
- CR Раунд 7: `npm run typecheck` чисто, `npx eslint` (10 файлов) чисто,
  `npx vitest run` — 101 файл, 1356 тестов, все зелёные

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
  (сбой Canvas-генерации; позднее real fallback generation вынесен из Story 8.1). Для `'generating'`/`'idle'` без blob — best-effort skip
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

**Разрешение находок код-ревью — Раунд 3 (2026-06-08):** 4 [Review][Patch] пункта закрыты.
- ✅ Finding A — submit при ещё идущей генерации больше не теряет poster. `PostForm.onSubmit`
  при `thumbnail_status==='generating'` показывает `toast.info` и ограниченно ждёт завершения
  генерации через новую утилиту `waitForCondition(predicate, { timeoutMs: 2500 })`. Если
  генерация успевает завершиться в пределах бюджета — blob попадает в сохранение (poster не
  теряется); иначе ожидание прекращается по таймауту (бюджет <3s/NFR8.1 соблюдён, лента
  отрисует первый кадр). Детерминированный тест PostForm (генерация завершается во время
  ожидания → blob в gallery) + 3 unit-теста `waitForCondition` (немедленно/по событию/по таймауту).
- ✅ Finding B — `applyNewVideoThumbnails` создаёт `AbortController`; при истечении бюджета
  таймер вызывает `controller.abort()`, отменяя незавершённые задачи. `runThumbnailTask`
  кооперативно проверяет `signal.aborted` до и после upload (при отмене после upload —
  чистит orphaned thumbnail), а `requestThumbnailFallback` комбинирует внешний signal со
  своим timeout, поэтому fallback fetch реально прерывается. Тест с fake timers: при
  истечении бюджета `signal.aborted === true`.
- ✅ Finding C — `updateThumbnailUrl` добавляет `.select('id')` и бросает ошибку при 0
  обновлённых строк (RLS/несуществующий id). Теперь `runThumbnailTask` ловит это и удаляет
  осиротевший thumbnail из Storage. Тест на zero-row → throw.
- ✅ Finding D — удалены оставшиеся prose-комментарии, добавленные Story 8.1
  (`postThumbnails.ts`, `generateVideoThumbnail.ts` CORS/seek/rAF, fallback route SSRF/501,
  `MediaUploader.tsx`, `MediaSortableItem.tsx`) согласно правилу AGENTS.md «No comments
  unless explicitly requested». Оставлены только функциональные `eslint-disable` директивы
  и pre-existing комментарии вне scope Story 8.1. Линт/typecheck чисты.

**Разрешение находок код-ревью — Раунд 4 (2026-06-08):** 5 [Review][Patch] пунктов закрыты.
- ✅ Finding 1 — submit теперь **блокируется до завершения генерации poster** (решение
  пользователя), даже если это превышает `<3s`. Cap ожидания `POSTER_GENERATION_WAIT_MS`
  привязан к таймауту генератора: `VIDEO_LOAD_TIMEOUT + 5_000` (20 с) вместо прежних 2500 мс.
  Так как `generateVideoThumbnail` гарантированно завершается (success/error) за ≤15 с
  (`VIDEO_LOAD_TIMEOUT`), ожидание ограничено, а `finalMedia` больше не сохраняется со
  статусом `generating` без `thumbnail_blob`. `VIDEO_LOAD_TIMEOUT` экспортирован из
  `generateVideoThumbnail.ts`. Тест PostForm (real timers): после 2800 мс генерация ещё идёт →
  `createPost` не вызван; после завершения → вызван с `thumbnail_blob`.
- ✅ Finding 2 — fallback route больше не падает 500 на JSON body `null` (или не-объекте):
  после `request.json()` добавлена проверка `typeof body !== 'object' || body === null` → `400`.
  Деструктуризация полей вынесена после guard. Тесты route: `null` body → 400, строка → 400.
- ✅ Finding 3 — поздний thumbnail callback больше не воскрешает удалённый и не откатывает
  reordered элемент из stale `itemsRef.current`. Введён `commit(next)`, синхронно
  продвигающий `itemsRef.current` во всех мутациях (`handleRemove`, `handleSetCover`,
  `handleDragEnd`, `processFiles`), а `updateNewItem` сначала проверяет наличие ключа
  (`exists`) и при отсутствии — выходит без `onChange`. Детерминированный тест
  (MediaUploaderRace): удаление k1 + поздний `onSuccess('k1')` в одном `act()` → k1 не
  воскресает.
- ✅ Finding 4 — `PostForm.handleMediaChange` синхронно обновляет `mediaItemsRef.current = nextItems`
  перед `setMediaItems`, поэтому `onSubmit` (включая чтение `finalMedia` после ожидания
  генерации) всегда видит последний `onChange`, а не значение прошлого рендера. Покрыто
  тестами захвата blob (Finding A + Finding 1).
- ✅ Finding 5 — fallback-превью видео без poster больше не остаётся чёрным/пустым:
  `MediaItemPreview` рендерит `<video>` с `preload="metadata"`, `playsInline` и медиа-фрагментом
  `#t=0.1` в `src`, что заставляет браузер показать первый кадр. Тест MediaItemPreview обновлён.

**Разрешение находок код-ревью — Раунд 5 (2026-06-08):** 5 [Review][Patch] пунктов закрыты.
- ✅ Finding 1 — submit больше не может сохранить `idle`/timed-out видео без poster.
  Предикат `hasGeneratingThumbnail` заменён на `hasPendingThumbnail` (статус НЕ `success`
  и НЕ `error` → `idle`/`generating`/`undefined` считаются «в работе»). Теперь видео со
  статусом `idle` (генератор ещё не смонтировался) тоже блокирует submit и ожидается до
  терминального состояния. Так как `VideoThumbnailGenerator` монтируется для любого видео
  не в `success`/`error`, ожидание гарантированно ограничено `VIDEO_LOAD_TIMEOUT`. Тест
  PostForm (idle-видео блокирует → blob после завершения).
- ✅ Finding 2 — `updatePost` удаляет файлы из Storage ТОЛЬКО при успешном DB delete
  старых media-rows. Раньше при `deleteError` код логировал warning и всё равно вызывал
  `removeStorageFiles`, что осиротило бы DB-ссылки (rows остаются, файлы удалены). Storage
  cleanup перенесён в `else`-ветку. Тест posts.test (DB delete fails → `removeStorageFiles`
  не вызван).
- ✅ Finding 3 — браузерная генерация thumbnail отменяется при удалении/unmount видео.
  `generateVideoThumbnail` принимает `options.signal: AbortSignal`: при `abort` (или уже
  aborted) промис немедленно отклоняется `ThumbnailGenerationError`, listener снимается в
  `fail`/`succeed`, `finally → cleanup()` очищает `<video>`. `VideoThumbnailGenerator`
  создаёт `AbortController`, передаёт `signal` и вызывает `controller.abort()` в cleanup;
  колбэки `onSuccess`/`onError` гейтятся `signal.aborted`. Тесты: abort → reject (×2),
  unmount → `signal.aborted` + нет колбэков (×2 в новом файле теста компонента).
- ✅ Finding 4 — Canvas-генерация сохраняет aspect ratio (center-crop «cover») вместо
  растягивания. `drawFrame` вычисляет source-rect по `video.videoWidth/videoHeight`: при
  несовпадении соотношения сторон обрезает по ширине или высоте по центру и рисует
  9-аргументным `drawImage(video, sx, sy, sw, sh, 0, 0, 640, 360)`. Fallback на полный кадр,
  если `videoWidth/Height` недоступны (0). Тесты: 16:9 → без кропа; portrait 360×640 →
  вертикальный center-crop без искажения.
- ✅ Finding 5 — story-scope prose-комментарии убраны из миграций `045`/`046`: многословные
  пояснительные блоки и декоративные `──` разделители заменены на лаконичный заголовок
  (стиль миграции `022`). Source-файлы Story 8.1 уже чисты (остались только функциональные
  `eslint-disable` и pre-existing комментарии вне scope story). Линт/typecheck чисты.

**Разрешение находок код-ревью — Раунд 6 (Full CR, 2026-06-09):** 4 [Review][Patch] пункта закрыты.
- ✅ Finding 1 — контракт закреплён в Story 8.1: AC (раздел Acceptance Criteria) и Dev Notes #4
  переписаны. Противоречивое требование «сохранение `<3 сек`» снято. **Уточнение пользователя
  (graceful degradation):** submit дожидается генерации; при успехе poster включается в публикацию;
  при ошибке генерации или таймауте публикация сохраняется БЕЗ poster, а пользователю показывается
  уведомление, что poster не создан автоматически и его можно добавить вручную позже (Story 8.2).
- ✅ Finding 2 — submit больше не блокируется навсегда и не сохраняет видео без уведомления. В
  `PostForm.onSubmit` сохранена блокирующая фаза ожидания идущей генерации (`waitForCondition` +
  `toast.info`), но после неё вычисляется `hasVideoWithoutPoster(finalMedia)` (новый видео-item со
  статусом ≠ `success`, т.е. `error`/`idle`/`generating` после таймаута). Если poster не создан —
  публикация всё равно сохраняется, а вместо `toast.success` показывается `toast.warning`
  (`POSTER_NOT_GENERATED_MESSAGE`: «Poster ni bil samodejno ustvarjen. Objava je shranjena brez njega
  — dodate ga lahko ročno pozneje.»). Новый файл `PostForm.posterTimeout.test.tsx` (мок
  `waitForCondition` на немедленный возврат): generating-видео после таймаута → `createPost` вызван +
  информативный `toast.warning`, `toast.success` не вызван; аналогичный тест для статуса `error`.
- ✅ Finding 3 — устранена утечка `thumbnail_preview_url` ObjectURL для поздно завершившейся
  генерации удалённого видео. Создание ObjectURL перенесено из `VideoThumbnailGenerator` в
  `MediaUploader.handleThumbSuccess`, где оно выполняется только под guard `exists` (item ещё в
  `itemsRef.current`). Сигнатура `onSuccess` упрощена до `(key, blob)` — генератор больше не создаёт
  URL. Если video удалён к моменту late-success, URL не создаётся вовсе → нет осиротевшего blob:.
  Тесты: генератор не вызывает `createObjectURL` и зовёт `onSuccess('k1', blob)`; поздний
  `onSuccess` удалённого item не вызывает `createObjectURL` (MediaUploaderRace).
- ✅ Finding 4 — `MediaLightbox` prose-комментарии НЕ относятся к Story 8.1. Расследование:
  изменения файла принадлежат отдельному коммиту `c49c7304` («fix(lightbox): исправить свайп на
  мобильном — touch-none, video-guard, pointer capture»), уже влитому в `main` (`git log main..HEAD
  -- src/components/media/MediaLightbox.tsx` пуст; `c49c7304` — общий предок `main` и HEAD). В diff
  относительно `baseline_commit` они попали лишь потому, что baseline зафиксирован до merge main в
  ветку. Откат/правка комментариев на этой ветке отменили бы легитимный merged-фикс и создали
  расхождение с `main`. Файл оставлен без изменений; вывод задокументирован.

**Разрешение находок код-ревью — Раунд 7 (2026-06-09):** 5 [Review][Patch] пунктов закрыты.
- ✅ Finding 1 — `toast.success` больше не показывается, если `thumbnail_url` фактически не сохранён.
  `applyNewVideoThumbnails` теперь возвращает `ThumbnailPipelineResult` (`{ expected, persisted,
  allPersisted }`), а `createPost`/`updatePost` пробрасывают его в `PostForm` через новый колбэк
  `onThumbnailResult` (контракт возврата `string`/`void` сохранён — на нём завязаны тесты posts).
  В `onSubmit` `posterMissingClient` (видео без blob) комбинируется с `thumbnailPersistFailed`
  (save-time персистентность не удалась) → при любом из них `toast.warning`, иначе `toast.success`.
  Тесты PostForm: persist-fail при готовом poster → `toast.warning`; `allPersisted=true` → `toast.success`.
- ✅ Finding 2 — save-time pipeline возвращает результат и учитывает зависший Storage upload.
  `runThumbnailTask` возвращает `{ postMediaId, persisted }`; задачи, не успевшие завершиться до
  `controller.abort()` по бюджету (в т.ч. зависший `uploadThumbnail`), не попадают в `persistedIds`,
  поэтому `allPersisted=false`. Тесты postThumbnails: happy-path → `persisted:1/allPersisted:true`;
  зависший upload по бюджету → `persisted:0/allPersisted:false`; update-fail → `allPersisted:false`;
  fallback-only (нет blob) → `expected:0/allPersisted:true` + сигнал прерван.
- ✅ Finding 3 — повторный thumbnail success больше не утекает старый ObjectURL.
  `handleThumbSuccess` перед `createObjectURL` отзывает прежний `thumbnail_preview_url` текущего item.
  Тест MediaUploaderRace: повторный `onSuccess('k1', blob2)` вызывает `revokeObjectURL('blob:first')`.
- ✅ Finding 4 — `waitForCondition` не перепрыгивает заданный timeout. Последний сон ограничен
  `Math.min(intervalMs, deadline - Date.now())`. Тест: с `timeoutMs:250, intervalMs:100` промис
  разрешается ровно к 250 мс (а не к 300 мс, как со старым полным интервалом).
- ✅ Finding 5 — удалён единственный story-scope prose-комментарий `{/* Thumbnail / poster preview */}`
  в `MediaSortableItem.tsx`. Pre-existing комментарии (до baseline) вне scope Story 8.1 не изменялись.

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

**Новые файлы (CR Раунд 3):**
- `src/lib/waitForCondition.ts` (Finding A — ограниченное по времени ожидание условия)
- `tests/unit/lib/waitForCondition.test.ts` (Finding A — 3 unit-теста)

**Изменённые файлы (CR Раунд 3):**
- `src/features/admin/components/PostForm.tsx` — ожидание завершения генерации перед
  сохранением через `waitForCondition` (Finding A); удалены prose-комментарии (Finding D)
- `src/features/admin/api/postThumbnails.ts` — `AbortController` + отмена незавершённых
  задач при истечении бюджета, кооперативные `signal.aborted` проверки (Finding B);
  удалены prose-комментарии (Finding D)
- `src/lib/media/updateThumbnailUrl.ts` — `.select('id')` + throw при 0 строк (Finding C)
- `src/lib/media/generateVideoThumbnail.ts`,
  `src/app/api/admin/generate-thumbnail-fallback/route.ts`,
  `src/features/admin/components/MediaUploader.tsx`,
  `src/features/admin/components/MediaSortableItem.tsx` — удалены prose-комментарии (Finding D)
- `tests/unit/lib/media/updateThumbnailUrl.test.ts` — тест zero-row (Finding C)
- `tests/unit/features/admin/api/postThumbnails.test.ts` — тест отмены fallback по бюджету (Finding B)
- `tests/unit/features/admin/components/PostForm.test.tsx` — тест ожидания генерации + захвата blob (Finding A)

**Новые файлы (CR Раунд 5):**
- `tests/unit/features/editor/components/VideoThumbnailGenerator.test.tsx` (Finding 3 — abort при unmount, 3 теста)

**Изменённые файлы (CR Раунд 5):**
- `src/features/admin/components/PostForm.tsx` — `hasGeneratingThumbnail` → `hasPendingThumbnail` (idle/generating блокируют submit, Finding 1)
- `src/features/admin/api/posts.ts` — Storage cleanup только при успешном DB delete (Finding 2)
- `src/lib/media/generateVideoThumbnail.ts` — `options.signal: AbortSignal` (Finding 3) + cover-crop с сохранением aspect ratio (Finding 4)
- `src/features/editor/components/VideoThumbnailGenerator.tsx` — `AbortController` + abort при unmount, гейт колбэков по `signal.aborted` (Finding 3)
- `supabase/migrations/045_add_thumbnail_index.sql`, `supabase/migrations/046_restrict_post_media_storage_admin.sql` — лаконичные заголовки вместо prose-блоков (Finding 5)
- `tests/unit/lib/media/generateVideoThumbnail.test.ts` — cover-crop 16:9/portrait + abort/already-aborted (Findings 3, 4)
- `tests/unit/features/admin/components/PostForm.test.tsx` — idle-видео блокирует submit (Finding 1)
- `tests/unit/features/admin/api/posts.test.ts` — DB delete fail → нет Storage cleanup (Finding 2)

**Изменённые файлы (CR Раунд 4):**
- `src/lib/media/generateVideoThumbnail.ts` — экспорт `VIDEO_LOAD_TIMEOUT` (Finding 1)
- `src/features/admin/components/PostForm.tsx` — блокирующее ожидание генерации
  (`POSTER_GENERATION_WAIT_MS = VIDEO_LOAD_TIMEOUT + 5_000`, Finding 1); синхронное
  обновление `mediaItemsRef.current` в `handleMediaChange` (Finding 4)
- `src/app/api/admin/generate-thumbnail-fallback/route.ts` — guard `null`/не-объект body → 400 (Finding 2)
- `src/features/admin/components/MediaUploader.tsx` — `commit()` синхронит `itemsRef` во всех
  мутациях + guard на существование ключа в `updateNewItem` (Finding 3)
- `src/features/admin/components/MediaItemPreview.tsx` — fallback `<video>` с `preload="metadata"`,
  `playsInline` и `#t=0.1` (Finding 5)
- `tests/unit/features/admin/components/PostForm.test.tsx` — тест блокирующего ожидания >2500ms (Finding 1)
- `tests/unit/app/api/admin/generate-thumbnail-fallback/route.test.ts` — тесты `null`/не-объект body (Finding 2)
- `tests/unit/features/admin/components/MediaUploaderRace.test.tsx` — тест против воскрешения удалённого item (Finding 3)
- `tests/unit/features/admin/components/MediaItemPreview.test.tsx` — обновлён тест fallback-видео (Finding 5)

**Новые файлы (CR Раунд 6):**
- `tests/unit/features/admin/components/PostForm.posterTimeout.test.tsx` (Finding 2 — прерывание submit при не готовом poster)

**Изменённые файлы (CR Раунд 6):**
- `src/features/admin/components/PostForm.tsx` — повторная проверка `hasPendingThumbnail` после
  ожидания, `toast.error`+`return` если poster не готов (Finding 2)
- `src/features/editor/components/VideoThumbnailGenerator.tsx` — `onSuccess(key, blob)` без создания
  ObjectURL (Finding 3)
- `src/features/admin/components/MediaUploader.tsx` — `handleThumbSuccess` создаёт ObjectURL под
  guard `exists` (Finding 3)
- `tests/unit/features/editor/components/VideoThumbnailGenerator.test.tsx` — onSuccess без previewUrl,
  генератор не создаёт ObjectURL (Finding 3)
- `tests/unit/features/admin/components/MediaUploaderRace.test.tsx` — сигнатура `(key, blob)` +
  тест отсутствия утечки ObjectURL для удалённого item (Finding 3)
- `_bmad-output/implementation-artifacts/8-1-automatic-thumbnail-generation-on-save.md` — AC и
  Dev Notes #4: контракт `приоритет poster`, снято `<3 сек` (Finding 1)

**Изменённые файлы (CR Раунд 7):**
- `src/features/admin/api/postThumbnails.ts` — `applyNewVideoThumbnails` возвращает
  `ThumbnailPipelineResult`; `runThumbnailTask` возвращает `{ postMediaId, persisted }` (Findings 1, 2)
- `src/features/admin/api/posts.ts` — `onThumbnailResult` колбэк в `CreatePostInput`/`UpdatePostInput`,
  проброс результата pipeline из `createPost`/`updatePost` (Findings 1, 2)
- `src/features/admin/components/PostForm.tsx` — toast по фактической персистентности
  (`thumbnailPersistFailed` + `posterMissingClient`) через `onThumbnailResult` (Finding 1)
- `src/features/admin/components/MediaUploader.tsx` — `handleThumbSuccess` отзывает прежний
  `thumbnail_preview_url` перед созданием нового (Finding 3)
- `src/lib/waitForCondition.ts` — последний сон ограничен остатком до дедлайна (Finding 4)
- `src/features/admin/components/MediaSortableItem.tsx` — удалён story-scope комментарий (Finding 5)
- `tests/unit/features/admin/api/postThumbnails.test.ts` — проверки `ThumbnailPipelineResult`
  (happy/hung-upload/update-fail/fallback-only) (Findings 1, 2)
- `tests/unit/features/admin/components/PostForm.test.tsx` — toast по persist-результату (Finding 1)
- `tests/unit/features/admin/components/MediaUploaderRace.test.tsx` — повторный success отзывает URL (Finding 3)
- `tests/unit/lib/waitForCondition.test.ts` — нет overshoot за дедлайн (Finding 4)

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
- 2026-06-08: Разрешены находки код-ревью Раунд 3 — 4 [Patch] items (ограниченное ожидание
  генерации poster перед сохранением, отмена незавершённого thumbnail-пайплайна по бюджету
  через AbortController, throw при 0 обновлённых строк в `updateThumbnailUrl`, удаление
  оставшихся prose-комментариев Story 8.1). +5 новых тестов (всего 1336 зелёных),
  typecheck/eslint чисты. Status → review.
- 2026-06-08: Разрешены находки код-ревью Раунд 4 — 5 [Patch] items (блокирующее ожидание
  завершения генерации poster перед сохранением по решению пользователя, fallback route
  guard `null`/не-объект body → 400, защита от воскрешения удалённого/reordered media item
  из stale ref через `commit()`+guard, синхронный `mediaItemsRef` в `handleMediaChange`,
  fallback-превью видео с `preload="metadata"`+`#t=0.1`). +4 новых теста (всего 1340 зелёных),
  typecheck/eslint чисты. Status → review.
- 2026-06-08: Разрешены находки код-ревью Раунд 5 — 5 [Patch] items (idle/timed-out видео
  больше не сохраняется без poster через `hasPendingThumbnail`, Storage cleanup только при
  успешном DB delete, отмена браузерной генерации при unmount через `AbortSignal`,
  cover-crop с сохранением aspect ratio для не-16:9 видео, чистка prose-комментариев в
  миграциях 045/046). +9 новых тестов (всего 1349 зелёных), typecheck/eslint чисты.
  Status → review.
- 2026-06-09: Разрешены находки код-ревью Раунд 6 (Full CR) — 4 [Patch] items (контракт
  закреплён в AC/Dev Notes, снято `<3 сек`; по уточнению пользователя — graceful degradation:
  при ошибке/таймауте генерации публикация сохраняется без poster + информативный `toast.warning`
  о ручном добавлении позже, submit не блокируется навсегда; устранена утечка ObjectURL для
  late-success удалённого видео через перенос создания URL под guard `exists`; MediaLightbox
  prose-комментарии признаны вне scope Story 8.1 — отдельный merged-в-main коммит `c49c7304`).
  +3 новых теста (всего 1352 зелёных), typecheck/eslint чисты. Status → review.
- 2026-06-09: Decision по server fallback закрыт вариантом 2 — real fallback generation вынесен
  в отложенную будущую story. AC/Tasks обновлены: fallback endpoint остаётся skeleton-заделом с
  auth/admin/body/SSRF validation и временным `501`; извлечение кадра, upload thumbnail и update
  `thumbnail_url` больше не заявлены как покрытие Story 8.1. Status остаётся in-progress из-за
  5 открытых [Patch] findings.
- 2026-06-09: Разрешены находки код-ревью Раунд 7 — 5 [Patch] items (save-time pipeline возвращает
  фактический результат персистентности `ThumbnailPipelineResult` и пробрасывает его в PostForm через
  `onThumbnailResult` → честный toast success/warning; зависший Storage upload по бюджету корректно
  считается НЕ persisted; `handleThumbSuccess` отзывает прежний ObjectURL при повторном success;
  `waitForCondition` не перепрыгивает timeout на целый интервал; удалён story-scope комментарий в
  MediaSortableItem). +5 новых тестов (всего 1356 зелёных), typecheck/eslint чисты. Status → review.
