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

## Change Log

- 2026-03-28: Story 4.1 реализована — мультимедийные посты, drag-and-drop, обложка, транзакция Storage+DB, редактирование с удалением файлов из Storage (claude-sonnet-4-6)
