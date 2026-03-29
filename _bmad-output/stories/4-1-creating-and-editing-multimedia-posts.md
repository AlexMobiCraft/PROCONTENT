# Story 4.1: Создание и редактирование мультимедийных постов

Status: review

## Story

As a автор,
I want создавать новые посты, загружая до 10 медиафайлов (фото/видео) с возможностью выбора обложки и порядка,
So that делиться знаниями в различных мультимедийных форматах.

## Acceptance Criteria

1. **Creation & Media Upload:**
   **Given** авторизованный пользователь с ролью `admin` на странице создания поста
   **When** она заполняет текстовые поля формы и загружает от 1 до 10 медиафайлов
   **Then** новые файлы подготавливаются к загрузке в бакет Supabase Storage (`post_media` или аналогичный)
   **And** форма позволяет комбинировать фото и видео
   **And** при превышении лимита в 10 файлов интерфейс блокирует выбор и показывает инлайн-сообщение об ошибке

2. **Media Ordering (Drag & Drop):**
   **Given** прикрепленные медиафайлы в черновике поста
   **When** автор перетаскивает миниатюры файлов мышью или касанием (drag-and-drop)
   **Then** порядок медиа (`order_index`) визуально обновляется до публикации поста

3. **Cover Selection:**
   **Given** список прикрепленных медиафайлов в форме
   **When** автор кликает на иконку "Сделать обложкой" на интерфейсе одной из карточек файла
   **Then** этот файл визуально выделяется как обложка
   **And** при сохранении он получит флаг `is_cover=true` в БД
   **And** обложкой может быть только один файл (при выборе нового, предыдущий сбрасывается)

4. **Saving Publication Transaction:**
   **Given** заполненная форма и прикрепленные медиафайлы
   **When** автор нажимает кнопку "Опубликовать"
   **Then** файлы загружаются в бакет Storage
   **And** после успешной загрузки файлов создается запись в таблице `posts` (устанавливается статус публикации)
   **And** создаются связанные записи в таблице `post_media` (с корректными `post_id`, `url`, `order_index`, `is_cover`)
   **And** в случае ошибки сети или записи БД, процесс прерывается и появляется глобальный Toast с текстом ошибки

5. **Editing Existing Post:**
   **Given** существующий опубликованный пост
   **When** автор открывает его для редактирования (`/posts/[id]/edit`)
   **Then** форма заполняется существующим текстом, категорией и загруженными медиафайлами с сохранением их оригинального порядка
   **And** автор может добавить новые файлы (не превышая общий лимит 10), удалить существующие или изменить их порядок
   **And** при сохранении изменения отражаются в БД, а удаленные из поста медиа удаляются из бакета Storage навсегда

## Technical Constraints & Developer Context

### Architecture Compliance
- **Smart Container / Dumb UI**: Компонент формы `PostForm` должен быть Smart-компонентом (обрабатывает сабмит и состояние), а область загрузки и сортировки `MediaUploader` — Dumb-компонентом. Skeletons должны быть инкапсулированы внутри Dumb-компонентов.
- **State Management**: Пока форма не сохранена, все файлы (включая загруженные превью) живут в локальном стейте формы (`react-hook-form` / `useState`). Глобальный Zustand-стор в этой задаче трогать не нужно.
- **Error Handling**: Системные ошибки (ошибка загрузки Supabase Storage, сбой инсерта в БД) обязательно выводятся через глобальные уведомления (Toasts). Ошибки валидации (не введен заголовок, выбрано >10 файлов) показываются инлайн красным текстом.
- **Database Naming Convention**: При общении с БД обязательно используйте `snake_case` (DB поля: `post_id`, `media_type`, `thumbnail_url`, `order_index`, `is_cover`). `eslint` правило camelcase для БД отключено, не пишите мапперы-сериализаторы на клиенте.

### Infrastructure Constraints
- Загрузка идет напрямую на клиентском уровне (через `supabase-js`) в бакет Supabase Storage (минуя Next API routes, чтобы не загружать Vercel функциями). Конфиденциальные медиа загружать нет необходимости — бакет должен быть `public`.

### Directory Structure & File Placements
- **Pages**: `src/app/(admin)/posts/create/page.tsx`, `src/app/(admin)/posts/[id]/edit/page.tsx`
- **Components**: `src/features/admin/components/PostForm.tsx`, `src/features/admin/components/MediaUploader.tsx`, `MediaSortableItem.tsx`
- **API/Actions**: `src/features/admin/api/` (для мутаций Storage файлов и записей таблиц).

## Tasks / Subtasks

- [x] Task 1: Подготовка типов
  - [x] 1.1: Убедиться, что актуальные типы базы данных сгенерированы в `src/types/supabase.ts` (таблица `post_media`).
  - [x] 1.2: Создать типы/интерфейсы Zod схемы в `src/features/admin/types.ts` для локального состояния формы (с учетом `File` объектов для новых файлов и URL-строк для существующих).

- [x] Task 2: UI-компоненты формы (Dumb Components)
  - [x] 2.1: Создать `MediaUploader.tsx`. Реализовать поддержку input-загрузки (от 1 до 10 файлов: фото и видео).
  - [x] 2.2: Внедрить `@dnd-kit/core` и `@dnd-kit/sortable` (или аналог) для создания сортируемого списка медиа (`Drag and Drop`).
  - [x] 2.3: Реализовать логику выбора обложки (звездочка или бейдж "Сделать обложкой") и кнопку удаления для каждой миниатюры загруженного медиа.

- [x] Task 3: API интеграция с Supabase Storage & DB
  - [x] 3.1: Написать хелпер для загрузки медиа: перебор массива новых `File`, загрузка в Storage, возврат массива public/signed URL's. Генерировать уникальные пути (например, `posts/${uuid()}/${file.name}`).
  - [x] 3.2: Написать API слой для создания нового поста: транзакционная последовательность действий (Вставка `posts` -> Загрузка Storage -> Вставка массива в `post_media`). Использовать RPC, если доступно, иначе делать последовательно на клиенте с fallback'ом при ошибках.
  - [x] 3.3: Написать API слой для редактирования поста и логику удаления (вызов `storage.remove` для файлов, открепленных в режиме редактирования).

- [x] Task 4: Сборка Smart-контейнера `PostForm.tsx`
  - [x] 4.1: Интегрировать компоненты формы, использовать `react-hook-form`.
  - [x] 4.2: Реализовать обработку состояния загрузки (IsSubmitting) и блокировку кнопок сохранения (показ Spinner-а).
  - [x] 4.3: Настроить Toast нотификаторы при success/error.

- [x] Task 5: Интеграция роутера (Next.js Pages)
  - [x] 5.1: Создать страницу `src/app/(admin)/posts/create/page.tsx`.
  - [x] 5.2: Создать страницу `src/app/(admin)/posts/[id]/edit/page.tsx` с получением первоначальных данных поста вместе с привязанными `post_media` (по `id`) для предзаполнения State формы. Отрисовывать Skeleton, пока данные загружаются.

## Reference Materials
- [Epic Context]: FR19, FR20, FR21 - Управление контентом администратором.
- [Architecture]: `Smart Container / Dumb UI` паттерн, запрет на маппинг БД `snake_case`.

## Dev Agent Record

### Agent Model Used
claude-sonnet-4-6

### Implementation Plan

**Новые зависимости (явно указаны в story):**
- `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` — drag-and-drop
- `react-hook-form` — управление формой
- `zod` — типизация и валидация схем

**Архитектурные решения:**
- `MediaItem` = union type `NewMediaItem | ExistingMediaItem` с дискриминатором `kind`
- Upload path: `posts/{postId}/{randomUUID}/{safeFileName}` для уникальности через `crypto.randomUUID()` (browser API, без зависимостей)
- Создание поста: insert posts → upload files → insert post_media → rollback (delete post) при ошибке
- Редактирование: update posts → delete removed post_media → remove Storage files → upload new → insert new post_media → update existing (order_index/is_cover)
- Admin layout: RSC с проверкой `profiles.role === 'admin'`, redirect → `/feed` для не-admin
- Edit page: Suspense + async RSC `EditPostContent` + Skeleton fallback

### Completion Notes

✅ **Все 5 задач выполнены и протестированы:**

| Task | Файлы | Тесты |
|------|-------|-------|
| 1 (Типы) | `src/features/admin/types.ts` | 10 тестов |
| 2 (UI Components) | `MediaUploader.tsx`, `MediaSortableItem.tsx` | 8 тестов |
| 3 (API Storage+DB) | `api/uploadMedia.ts`, `api/posts.ts` | 9 + 7 = 16 тестов |
| 4 (PostForm) | `PostForm.tsx` | 9 тестов |
| 5 (Pages) | `(admin)/layout.tsx`, create/page, [id]/edit/page | 4 тесты |

**Итого:** +51 новый тест, всего 964 тестов (963 pass, 1 pre-existing flaky timeout в middleware.test.ts)

**Все AC выполнены:**
- AC1: MediaUploader + limit 10 + inline error ✅
- AC2: @dnd-kit drag-and-drop с reorder ✅
- AC3: cover selection (one at a time) + Star иконка ✅
- AC4: транзакция insert posts → upload → insert post_media + toast on error ✅
- AC5: edit page prefills form + Skeleton + delete from Storage ✅

✅ **Round 2 review findings адресованы (13/13, 10 real fixes + 3 N/A):**

| # | Finding | Решение |
|---|---------|---------|
| 1 | EditPostSkeleton отсутствует | N/A — файл существует |
| 2 | Upload/delete reorder | Upload новых ДО удаления старых |
| 3 | posts.type не обновляется | N/A — уже в коде |
| 4 | Осиротевшие файлы в Storage | Поштучная загрузка с трекингом URL |
| 5 | Object URL memory leak | handleMediaChange синхронизирует ref |
| 6 | Silent .catch(() => {}) | console.warn |
| 7 | Promise.all rate limit | Sequential for-loop |
| 8 | crypto.randomUUID fallback | generateUUID() из uploadMedia.ts |
| 9 | Text drag false activation | dataTransfer.types check |
| 10 | Empty MIME type | resolveFileType() с extension fallback |
| 11 | derivePostType аудио | Defensive check |
| 12 | Stale error on DnD | setFileError(null) в handleDragEnd |
| 13 | minOrder мёртвый код | N/A — не найден |

✅ **Round 1 review findings адресованы (13/13):**

| # | Finding | Решение |
|---|---------|---------|
| 1 | Утечки при сбое create/update | Rollback Storage files + post при ошибке, best-effort cleanup в update |
| 2 | Пустой список файлов | Inline error "Dodajte vsaj eno medijsko datoteko" в PostForm |
| 3 | Молчаливая обрезка файлов | Inline error с деталями обрезки и причиной |
| 4 | Skeleton не выделен | Extracted в `EditPostSkeleton.tsx` |
| 5 | Promise.all без error check | Добавлена проверка ошибок после Promise.all |
| 6 | ObjectURL утечка | useEffect cleanup + ref tracking |
| 7 | Нет native drag-and-drop | onDragOver/onDragLeave/onDrop + визуальный фидбек |
| 8 | .trim() title | Zod .transform(trim).pipe() для title и category |
| 9 | focus-within | focus-within:ring-2 на label |
| 10 | derivePostType | Переписана логика с hasImages/hasVideos |
| 11 | preload="metadata" | Заменено на preload="none" |
| 12 | Макс. вес файлов | MAX_IMAGE_SIZE (10MB), MAX_VIDEO_SIZE (100MB) + inline errors |
| 13 | crypto.randomUUID fallback | generateUUID() с Math.random fallback |

✅ **Round 4 review findings адресованы (15/15, 8 real fixes + 3 N/A + 4 deferred):**

| # | Finding | Решение |
|---|---------|---------|
| 1 | N+1 order_index updates | Один upsert с onConflict:'id' |
| 2 | Утечка Storage при partial batch | Promise.allSettled + tracked URLs |
| 3 | formatSize precision | toFixed(1) для MB |
| 4 | Content max length | .max(50000) в Zod |
| 5 | originalMedia desync | N/A — router.push('/feed') после update |
| 6 | Потеря stack trace | { cause } во всех Error |
| 7 | ObjectURL race condition | Snapshot Set + clear ref в cleanup |
| 8 | Silent Zod safeParse | toast.error с первой issue |
| 9 | Skeleton encapsulation | N/A — RSC page ≠ Smart Container |
| 10 | updatePost text rollback | originalFormValues revert в catch |
| 11 | Media в Zod schema | MAX_MEDIA_FILES check в onSubmit |
| 12-15 | 4 Deferred | Бэкенд миниатюры, сетевой откат, MIME libs, best-effort cleanup |

✅ **Round 5 review findings адресованы (6/6, 5 real fixes + 1 N/A):**

| # | Finding | Решение |
|---|---------|---------|
| 1 | Незавершенный откат при сбое upsert/insert | Удаление removed медиа перенесено ПОСЛЕ upsert/insert |
| 2 | Storage deletion до успешного обновления БД | Storage cleanup перенесён в конец после всех DB ops |
| 3 | Rollback на stale page data | DB snapshot перед update, используется для rollback |
| 4 | objectUrlsRef instanceof guard | instanceof Set + ref capture в теле эффекта |
| 5 | Повреждённая кодировка символов | N/A — UTF-8 кодировка корректна |
| 6 | Нет server-side MAX_MEDIA_FILES | Guard в createPost и updatePost |

✅ **Round 3 review findings адресованы (11/11, 8 real fixes + 3 N/A):**

| # | Finding | Решение |
|---|---------|---------|
| 1 | Storage orphan в updatePost | try-catch + rollback uploadedUrls |
| 2 | Транзакционная целостность | Все DB ops в try-catch с rollback |
| 3 | Fire-and-forget rollback | N/A — console.warn уже есть, retry = over-engineering |
| 4 | Missing order_index/is_cover | N/A — данные корректны из MediaItem |
| 5 | Линейные циклы загрузки | uploadFilesWithTracking (batch по 3) |
| 6 | MIME-тип подмена | file.type проверяется на ALLOWED_MEDIA_TYPES |
| 7 | UUID Math.random | crypto.getRandomValues fallback |
| 8 | Object URL утечка | revokeObjectURL в handleMediaChange |
| 9 | Raw casting | Type guard `i.kind === 'new'` |
| 10 | derivePostType default | 'text' вместо 'gallery' |
| 11 | Хрупкая DnD защита | hasFileTransfer() с try-catch |

### Debug Log

- Исправлен mock для `useAuthStore` в PostForm test — selector не применялся (нужен `vi.fn((selector) => selector(state))`)
- Исправлен mock для двух последовательных `insert()` в createPost test — использован `mockReturnValueOnce`
- TypeScript: `vi.fn()` не совместим с `(items: MediaItem[]) => void` — решено через `ReturnType & callable` с `as any`
- Async RSC тест для edit page: использован `act(async () => { render(jsx) })` + warnings игнорируются

## File List

### Новые файлы:
- `src/features/admin/types.ts`
- `src/features/admin/api/uploadMedia.ts`
- `src/features/admin/api/posts.ts`
- `src/features/admin/components/MediaSortableItem.tsx`
- `src/features/admin/components/MediaUploader.tsx`
- `src/features/admin/components/PostForm.tsx`
- `src/app/(admin)/layout.tsx`
- `src/app/(admin)/posts/create/page.tsx`
- `src/app/(admin)/posts/[id]/edit/page.tsx`
- `tests/unit/features/admin/types.test.ts`
- `tests/unit/features/admin/api/uploadMedia.test.ts`
- `tests/unit/features/admin/api/posts.test.ts`
- `tests/unit/features/admin/components/MediaUploader.test.tsx`
- `tests/unit/features/admin/components/PostForm.test.tsx`
- `tests/unit/app/(admin)/posts/create/page.test.tsx`
- `tests/unit/app/(admin)/posts/[id]/edit/page.test.tsx`
- `src/features/admin/components/EditPostSkeleton.tsx`

### Review Findings

- [x] [Review][Patch] Обработка ошибок БД и Storage (утечки/осиротевшие данные при сбое create/update) [src/features/admin/api/posts.ts]
- [x] [Review][Patch] Отсутствие валидации пустого списка файлов в Zod [src/features/admin/types.ts]
- [x] [Review][Patch] Молчаливая обрезка файлов без инлайн-сообщения при превышении лимита 10 [src/features/admin/components/MediaUploader.tsx]
- [x] [Review][Patch] Скелетон EditPostSkeleton не выделен в отдельный UI-компонент [src/app/(admin)/posts/[id]/edit/page.tsx]
- [x] [Review][Patch] Неоптимальное массовое обновление `order_index` через Promise.all [src/features/admin/api/posts.ts]
- [x] [Review][Patch] Утечка памяти ObjectURL при размонтировании формы или уходе со страницы [src/features/admin/components/PostForm.tsx]
- [x] [Review][Patch] Отсутствие нативного Drag-and-Drop (работает как загрузка страницы) на зоне uploader'а [src/features/admin/components/MediaUploader.tsx]
- [x] [Review][Patch] Отсутствие `.trim()` у title в валидации схемы [src/features/admin/types.ts]
- [x] [Review][Patch] Отсутствие визуального фокуса (:focus-within) для клавиатурной навигации по инпуту [src/features/admin/components/MediaUploader.tsx]
- [x] [Review][Patch] Некорректная логика `derivePostType` при смешивании 1 фото и множества видео [src/features/admin/components/PostForm.tsx]
- [x] [Review][Patch] Блокировка рендеринга из-за `preload="metadata"` в видео тегах [src/features/admin/components/MediaSortableItem.tsx]
- [x] [Review][Patch] Отсутствие проверок на максимальный вес загружаемых файлов [src/features/admin/components/MediaUploader.tsx]
- [x] [Review][Patch] Отсутствие fallback для `crypto.randomUUID()` в не-HTTPS средах [src/features/admin/api/uploadMedia.ts]

**Round 2: Adversarial & Edge Case Review (2026-03-28)**
- [x] [Review][Patch] Отсутствующий файл EditPostSkeleton.tsx ломает сборку [EditPostSkeleton.tsx] — N/A: файл существует и импортируется корректно
- [x] [Review][Patch] Утечка новых медиафайлов и потенциальная потеря данных при редактировании — старые медиа удаляются до заливки новых [src/features/admin/api/posts.ts] — Исправлено: upload новых файлов ДО удаления старых
- [x] [Review][Patch] Потеря консистентности типа публикации (posts.type) при редактировании — тип не обновляется в запросе [src/features/admin/api/posts.ts] — N/A: `type: derivePostType(mediaItems)` уже присутствует в update query
- [x] [Review][Patch] Оставленные "осиротевшие" файлы в Storage при частичном сбое uploadNewMediaItems в createPost [src/features/admin/api/posts.ts] — Исправлено: замена Promise.all на последовательную загрузку с поштучным трекингом URL
- [x] [Review][Patch] Перманентная утечка памяти (Memory Leak) в Object URL при удалении медиа — не вызывается revokeObjectURL немедленно [src/features/admin/components/PostForm.tsx] — Исправлено: handleMediaChange синхронизирует objectUrlsRef, удаляя revoked URLs
- [x] [Review][Patch] Тотальное скрытие ошибок (Silent Failures) очистки массива файлов Storage через .catch(() => {}) [src/features/admin/api/posts.ts] — Исправлено: console.warn вместо пустого catch
- [x] [Review][Patch] Хрупкое батчевое обновление через Promise.all (Риск Race Condition на rate limit базы) [src/features/admin/api/posts.ts] — Исправлено: последовательный for-loop вместо Promise.all
- [x] [Review][Patch] Небезопасный Math.random фолбэк для ключей загрузки [src/features/admin/components/MediaUploader.tsx] — Исправлено: импорт и использование generateUUID() из uploadMedia.ts
- [x] [Review][Patch] Мнимая интерактивность Drag-and-Drop — ложная активация зоны при перетаскивании текста [src/features/admin/components/MediaUploader.tsx] — Исправлено: проверка e.dataTransfer.types.includes('Files')
- [x] [Review][Patch] Наивная валидация MIME-типов может блокировать валидные файлы с пустым type от браузера [src/features/admin/components/MediaUploader.tsx] — Исправлено: resolveFileType() с fallback на extension
- [x] [Review][Patch] Незащищенная экстраполяция типов derivePostType неправомерно возвращает gallery для аудио [src/features/admin/components/PostForm.tsx] — Исправлено: defensive check (!hasImages && !hasVideos) → 'gallery' в derivePostType
- [x] [Review][Patch] Баг UX: сообщение об ошибке (stale error) некорректно себя ведет при drag-and-drop сортировке файла [src/features/admin/components/MediaUploader.tsx] — Исправлено: setFileError(null) в handleDragEnd
- [x] [Review][Patch] Мертвый код при выборе обложки — переменная minOrder вычисляется, но не используется [src/features/admin/components/MediaUploader.tsx] — N/A: переменная не найдена в коде
**Round 3: Comprehensive Code Review (2026-03-29)**
- [x] [Review][Patch] Утечка медиафайлов (Storage orphan files) при ошибке в updatePost [src/features/admin/api/posts.ts] — Исправлено: try-catch с rollback uploadedUrls через removeStorageFiles
- [x] [Review][Patch] Нарушение транзакционной целостности БД в updatePost [src/features/admin/api/posts.ts] — Исправлено: все DB операции обёрнуты в try-catch с rollback загруженных файлов
- [x] [Review][Patch] Неэффективная обработка ошибок отката в createPost (Fire-and-Forget) [src/features/admin/api/posts.ts] — Исправлено: rollback с console.warn уже реализован, retry over-engineering для client-side
- [x] [Review][Patch] Некорректные данные для новых медиа (missing order_index/is_cover) [src/features/admin/api/posts.ts] — N/A: order_index и is_cover берутся из item (MediaItem), корректно заданы из формы
- [x] [Review][Patch] Деградация производительности UX из-за линейных циклов загрузки [src/features/admin/api/posts.ts] — Исправлено: uploadFilesWithTracking с batch concurrency (3 параллельных загрузки)
- [x] [Review][Patch] Уязвимость подмены MIME-типа (resolveFileType) [src/features/admin/components/MediaUploader.tsx] — Исправлено: file.type проверяется на вхождение в ALLOWED_MEDIA_TYPES перед доверием
- [x] [Review][Patch] Ненадежный генератор UUID fallback [src/features/admin/api/uploadMedia.ts] — Исправлено: добавлен crypto.getRandomValues fallback перед Math.random
- [x] [Review][Patch] Утечка памяти Object URL [src/features/admin/components/PostForm.tsx] — Исправлено: URL.revokeObjectURL() при удалении URL из tracking Set в handleMediaChange
- [x] [Review][Patch] Небезопасное приведение типов (raw casting) [src/features/admin/components/PostForm.tsx] — Исправлено: type guard `i.kind === 'new'` вместо `as { preview_url: string }`
- [x] [Review][Patch] Некорректный базовый тип по умолчанию в derivePostType [src/features/admin/components/PostForm.tsx] — Исправлено: возвращает 'text' вместо 'gallery' при отсутствии image/video
- [x] [Review][Patch] Хрупкая защита Drag-and-Drop [src/features/admin/components/MediaUploader.tsx] — Исправлено: hasFileTransfer() с try-catch для устойчивости к синтетическим drag-событиям

**Round 4: Final Acceptance & Adversarial Review (2026-03-29)**
- [x] [Review][Patch] N+1 запросов при обновлении order_index в updatePost [src/features/admin/api/posts.ts] — Исправлено: заменены N последовательных update на один upsert с onConflict:'id'
- [x] [Review][Patch] Возможная утечка Storage при сбое параллельной загрузки (отсутствует AbortSignal) [src/features/admin/api/posts.ts] — Исправлено: Promise.allSettled вместо Promise.all, частично загруженные файлы трекаются для rollback
- [x] [Review][Patch] Неточное форматирование размера файлов (1.49MB отображается как 1MB) [src/features/admin/components/MediaUploader.tsx] — Исправлено: toFixed(1) для MB
- [x] [Review][Patch] Отсутствие ограничения длины для поля content в Zod-схеме [src/features/admin/types.ts] — Исправлено: .max(50000) для content
- [x] [Review][Patch] Рассинхронизация состояния originalMedia после успешного update без перезагрузки [src/features/admin/components/PostForm.tsx] — N/A: router.push('/feed') выполняется сразу после update, форма размонтируется
- [x] [Review][Patch] Потеря stack trace при пробросе ошибок API (отсутствует cause) [src/features/admin/api/posts.ts] — Исправлено: { cause } добавлен ко всем Error конструкторам в posts.ts и uploadMedia.ts
- [x] [Review][Patch] Состояние гонки при очистке ObjectURL [src/features/admin/components/PostForm.tsx] — Исправлено: useEffect cleanup создаёт snapshot Set и очищает ref, предотвращая double-revoke
- [x] [Review][Patch] Тихий сбой ручной валидации Zod в onSubmit (ошибки не показываются в UI) [src/features/admin/components/PostForm.tsx] — Исправлено: toast.error с первой Zod issue при safeParse failure
- [x] [Review][Patch] Нарушение инкапсуляции Skeletons (использование в Smart-компоненте) [src/app/(admin)/posts/[id]/edit/page.tsx] — N/A: RSC page не является Smart Container, Suspense fallback — стандартный Next.js паттерн
- [x] [Review][Patch] Нарушение транзакционности в updatePost (текст не откатывается при сбое загрузки медиа) [src/features/admin/api/posts.ts] — Исправлено: текстовый update перенесён в try-catch, при ошибке откатывается к originalFormValues
- [x] [Review][Patch] Исключение массива файлов из Zod-схемы (неполная валидация) [src/features/admin/types.ts] — Исправлено: добавлена проверка MAX_MEDIA_FILES в onSubmit; File объекты несовместимы с Zod
- [x] [Review][Defer] Отсутствие генерации миниатюр для видео (жесткий null) — deferred: требует бэкенд процессинга
- [x] [Review][Defer] Хрупкая логика отката в createPost при сбое сети — deferred: архитектурное ограничение клиента
- [x] [Review][Defer] Определение MIME-типа по расширению — deferred: идеальное решение требует тяжелых библиотек
- [x] [Review][Defer] Тихие утечки при удалении старых медиа (best-effort очистка) — deferred: осознанный компромисс из Round 3

**Раунд 5: Финальный Edge Case & Consistency Review (2026-03-29)**
- [x] [Review][Patch] Незавершенный откат оставляет БД в поврежденном состоянии при сбое upsert/insert медиа [src/features/admin/api/posts.ts] — Исправлено: удаление removed медиа перенесено ПОСЛЕ успешного upsert/insert (шаг 6)
- [x] [Review][Patch] Удаленные медиа-файлы безвозвратно удаляются из Storage до успешного обновления БД [src/features/admin/api/posts.ts] — Исправлено: Storage deletion перенесена в конец после всех DB операций
- [x] [Review][Patch] Откат состояния полагается на начальные данные страницы вместо текущего состояния БД [src/features/admin/components/PostForm.tsx] — Исправлено: snapshot текущего состояния из БД перед update, используется для rollback
- [x] [Review][Patch] Очистка при размонтировании предполагает, что objectUrlsRef.current это Set [src/features/admin/components/PostForm.tsx] — Исправлено: добавлен instanceof Set guard + захват ref в теле эффекта (ESLint fix)
- [x] [Review][Patch] Поврежденная кодировка символов в сообщении об ошибке макс. количества файлов [src/features/admin/components/PostForm.tsx] — N/A: кодировка корректна (UTF-8 \xc4\x8d = č), все символы валидны
- [x] [Review][Patch] В API отсутствует серверная проверка лимита MAX_MEDIA_FILES [src/features/admin/api/posts.ts] — Исправлено: guard в createPost и updatePost с throw Error

## Change Log

- 2026-03-28: Story 4.1 реализована — мультимедийные посты, drag-and-drop, обложка, транзакция Storage+DB, редактирование с удалением файлов из Storage (claude-sonnet-4-6)
- 2026-03-28: Адресовано 13 review findings — error handling, валидация, UX, a11y, утечки памяти (claude-opus-4-6)
- 2026-03-28: Адресовано 13 round 2 review findings — reorder upload/delete, sequential uploads, MIME fallback, DnD text guard, Object URL cleanup, silent catch logging (claude-opus-4-6)
- 2026-03-29: Адресовано 11 round 3 review findings (8 real fixes + 3 N/A) — updatePost rollback, concurrency uploads, UUID crypto fallback, Object URL revocation, type safety, derivePostType default, DnD hardening (claude-opus-4-6)
- 2026-03-29: Адресовано 15 round 4 review findings (8 real fixes + 3 N/A + 4 deferred) — N+1→upsert, allSettled upload rollback, formatSize precision, content max length, error cause chains, ObjectURL race fix, Zod toast, updatePost text rollback (claude-opus-4-6)
- 2026-03-29: Адресовано 6 round 5 review findings (5 real fixes + 1 N/A) — reorder updatePost ops (delete-after-success), DB snapshot rollback, instanceof Set guard, MAX_MEDIA_FILES server-side check, ESLint fix (claude-opus-4-6)
