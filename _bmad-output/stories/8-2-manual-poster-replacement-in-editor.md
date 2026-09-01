# Story 8.2: Ročna zamenjava posterja v urejevalniku

Status: ready-for-dev

## Story

Как автор,
я хочу иметь возможность для каждого видео в публикации вручную выбрать другое изображение в качестве poster,
чтобы иметь полный контроль над превью публикации в ленте.

## Acceptance Criteria

**Given** автор находится в редакторе и в публикации есть хотя бы одно видео  
**When** кликает на иконку меню рядом с превью видео и выбирает "Spremeni poster"  
**Then** открывается file picker для загрузки изображения (JPG/PNG, max. 2 MB)  
**And** после успешной загрузки `thumbnail_url` обновляется на новое изображение  
**And** в превью редактора сразу отображается новое изображение с меткой "Ročni poster"

**Given** автор выбирает изображение, которое не JPG или PNG  
**When** подтверждает выбор  
**Then** система отклоняет загрузку и показывает ошибку "Dovoljeni formati: JPG, PNG"  
**And** старый poster остаётся без изменений

**Given** автор хочет удалить вручную выбранный poster  
**When** кликает "Odstrani poster"  
**Then** `thumbnail_url` устанавливается в NULL  
**And** в ленте для этого видео используется fallback (первый кадр или стандартная иконка)

**Given** автор выбирает изображение, превышающее 2 MB  
**When** подтверждает выбор  
**Then** система отклоняет загрузку и показывает ошибку "Slika je prevelika. Največ 2 MB."  
**And** старый poster остаётся без изменений

**Given** видео уже имеет автоматически сгенерированный poster  
**When** автор вручную выбирает другое изображение  
**Then** ручной выбор имеет приоритет — автоматическая генерация пропускается  
**And** старый автоматический poster удаляется из Storage (если не используется где-то ещё)

## Tasks / Subtasks

- [ ] Task 1: Контекстное меню для poster (AC: 1)
  - [ ] Subtask 1.1: Создать `src/features/editor/components/PosterContextMenu.tsx` — Dumb UI компонент с тремя опциями: "Spremeni poster", "Znova ustvari poster", "Odstrani poster"
  - [ ] Subtask 1.2: Использовать `@base-ui/react` (или shadcn/ui) для menu/popover — проверить существующую UI библиотеку в проекте
  - [ ] Subtask 1.3: Обеспечить `aria-label` и keyboard navigation (WCAG 2.1 Level AA). Touch target: min 44×44 px
- [ ] Task 2: Превью video poster в редакторе (AC: 1, 2, 3)
  - [ ] Subtask 2.1: Создать `src/features/editor/components/MediaItemPreview.tsx` — Dumb UI, отображающий poster с overlay-иконкой видео. Поддерживает состояния: загрузка (Skeleton), автоматический poster, ручной poster (метка "Ročni poster"), без poster (fallback)
  - [ ] Subtask 2.2: Расширить `MediaSortableItem.tsx` — вместо сырого `<video>` элемента для превью использовать `MediaItemPreview`
  - [ ] Subtask 2.3: Добавить визуальную метку "Ročni poster" в правый верхний угол превью
- [ ] Task 3: Загрузка ручного poster (AC: 1, 2)
  - [ ] Subtask 3.1: Создать `src/app/api/admin/upload-poster/route.ts` — Route Handler, принимающий `FormData` (изображение + `post_media_id`), валидирующий MIME тип (JPG/PNG), размер (≤ 2 MB), уменьшающий до max 1920×1080, загружающий в Storage
  - [ ] Subtask 3.2: Валидация MIME типа по magic bytes (не только по расширению). Запрещённые форматы: SVG, GIF, WebP
  - [ ] Subtask 3.3: Client-side функция `uploadManualPoster(file, postMediaId)` в `src/features/editor/api/uploadPoster.ts`
- [ ] Task 4: Удаление poster (AC: 3)
  - [ ] Subtask 4.1: Создать `src/app/api/admin/thumbnail/route.ts` с методом `DELETE` — удалить thumbnail из Storage и установить `thumbnail_url = NULL` в `post_media`
  - [ ] Subtask 4.2: Client-side функция `removeThumbnail(postMediaId)` в `src/features/editor/api/removeThumbnail.ts`
- [ ] Task 5: Интеграция с существующим workflow (AC: 1, 2, 3)
  - [ ] Subtask 5.1: Обновить `MediaUploader.tsx` — добавить вызов `PosterContextMenu` для каждого видео-элемента
  - [ ] Subtask 5.2: Обновить `MediaItem` типы в `src/features/admin/types.ts` — добавить поле `thumbnail_source?: 'auto' | 'manual' | null` (если нужно для отслеживания ручного выбора)
  - [ ] Subtask 5.3: Обновить логику сохранения публикации — ручной poster сохраняется как `thumbnail_url` без автоматической генерации
- [ ] Task 6: Toast-уведомления и error handling (AC: 2, 3)
  - [ ] Subtask 6.1: Успешная замена: "Poster je bil posodobljen"
  - [ ] Subtask 6.2: Успешная генерация: "Poster je bil ustvarjen" (для "Znova ustvari poster")
  - [ ] Subtask 6.3: Ошибка: "Napaka pri ustvarjanju posterja. Poskusite znova."
- [ ] Task 7: Тесты
  - [ ] Subtask 7.1: Unit-тесты для `PosterContextMenu` (меню открывается, вызовы callback'ов)
  - [ ] Subtask 7.2: Unit-тесты для валидации upload (неверный формат, слишком большой файл)
  - [ ] Subtask 7.3: E2E-тест: загрузка ручного poster, проверить метку "Ročni poster"

## Dev Notes

### Архитектурный контекст и ограничения

- **Stack:** Next.js 16.1.6, TypeScript 5, Tailwind CSS 4, Supabase, Zustand 5.
- **UI библиотека:** Проект использует `@base-ui/react` (НЕ Radix) + CVA варианты для компонент. Проверить `src/components/ui/` для существующих паттернов.
- **Smart/Dumb:** `PosterContextMenu` и `MediaItemPreview` — Dumb UI. Smart Container (например, `VideoThumbnailGenerator` или новый компонент) управляет состоянием и вызывает API.
- **Snake_case:** Все поля из базы в `snake_case`. `thumbnail_url`, `media_type`, `post_id`, `order_index`.
- **Storage bucket:** `post_media/thumbnails/` — то же, что и для автоматических thumbnail'ов. Ручной poster сохраняется по тому же пути (`{post_media_id}_thumb.jpg`) и перезаписывает автоматический.

### Ключевые реализационные моменты

1. **Ручной выбор имеет приоритет:** Если `thumbnail_url` уже существует (вручную установлен), автоматическая генерация пропускается. Это применимо как для client-side Canvas, так и для server fallback.
2. **Storage cleanup:** Когда автор вручную меняет poster, старый thumbnail ДОЛЖЕН быть удалён из Storage, чтобы не появились orphaned файлы. Если же один и тот же thumbnail используется для нескольких видео-записей (редко), проверить reference count или оставить (в v1 допустимо, что записи независимы).
3. **Валидация:** Server-side валидация обязательна — client-side можно обойти. Проверить MIME тип по magic bytes (например, `ff d8 ff` для JPEG, `89 50 4e 47` для PNG).
4. **Уменьшение изображения:** Перед загрузкой уменьшить изображение до max 1920×1080 px (NFR8.4). Использовать Canvas для resize или библиотеку (если уже установлена).
5. **UI состояния:**
   - **Загрузка:** `Skeleton` с `animate-pulse` во время генерации/загрузки poster
   - **Автоматический poster:** Отображается изображение с маленькой overlay-иконкой видео
   - **Ручной poster:** Отображается изображение с меткой "Ročni poster" в правом верхнем углу
   - **Без poster:** Серый фон с текстом "Brez posterja" и иконкой видео

### Существующие компоненты для расширения

- `@/src/features/admin/components/MediaUploader.tsx` — главный container для загрузки и редактирования медиа. Здесь интегрируется `PosterContextMenu`.
- `@/src/features/admin/components/MediaSortableItem.tsx` — превью отдельного медиа. Расширить `MediaItemPreview` и кнопкой для контекстного меню.
- `@/src/features/admin/types.ts` — типы `MediaItem`, `ExistingMediaItem` (уже имеет `thumbnail_url: string | null`).

### API Endpoints

- `POST /api/admin/upload-poster` — Admin only. Принимает `FormData` с `file` и `post_media_id`. Валидирует: JPG/PNG, ≤ 2 MB, max 1920×1080. Загружает в Storage, обновляет `thumbnail_url`.
- `DELETE /api/admin/thumbnail` — Admin only. Принимает `post_media_id` в body. Удаляет из Storage, устанавливает `thumbnail_url = NULL`.

### Accessibility

- Все кнопки в контекстном меню должны иметь `aria-label`.
- Touch target: `min-h-[44px] min-w-[44px]` для всех интерактивных элементов.
- Меню должно быть доступно через клавиатуру (Escape для закрытия, стрелки для навигации).

### Testing Notes

- **Unit-тесты:** Проверить, что `upload-poster` endpoint отклоняет SVG, GIF, WebP. Проверить, что отклоняет файлы > 2 MB.
- **E2E-тесты:** Playwright — открыть контекстное меню, загрузить ручной poster, проверить метку.
- **A11y-тесты:** Проверить keyboard navigation в меню.

### References

- [Source: _bmad-output/planning-artifacts/prd-video-thumbnails.md#FR8.2]
- [Source: _bmad-output/planning-artifacts/prd-video-thumbnails.md#FR8.3]
- [Source: _bmad-output/planning-artifacts/prd-video-thumbnails.md#NFR8.4]
- [Source: _bmad-output/planning-artifacts/prd-video-thumbnails.md#NFR8.6]
- [Source: _bmad-output/planning-artifacts/prd-video-thumbnails.md#UX-DR8.1]
- [Source: _bmad-output/planning-artifacts/prd-video-thumbnails.md#UX-DR8.2]
- [Source: _bmad-output/planning-artifacts/architecture.md#Smart Container / Dumb UI]
- [Source: _bmad-output/project-context.md#Critical Implementation Rules]
- [Source: src/features/admin/components/MediaUploader.tsx]
- [Source: src/features/admin/components/MediaSortableItem.tsx]
- [Source: src/features/admin/types.ts]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
