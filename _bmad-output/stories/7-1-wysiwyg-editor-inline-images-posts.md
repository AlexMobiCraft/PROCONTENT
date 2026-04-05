# Story 7.1: WYSIWYG-редактор для инлайн-изображений в постах

Status: ready-for-dev

## Story

As an автор,
I want создавать пост в `/posts/create` через разделённые блоки `Galerija objave` и `Vsebina objave`, где текст редактируется в WYSIWYG-редакторе с инлайн-изображениями,
so that я могу собирать rich content без смешивания gallery media и article media и без ручного копирования ссылок.

## Acceptance Criteria

1. **Структура экрана `/posts/create`:**
   **Given** admin открывает `/posts/create`
   **When** страница полностью загружена
   **Then** форма сохраняет порядок блоков `Naslov` → `Kategorija` → `Povzetek` → `Galerija objave` → `Vsebina objave` → `Nastavitve objave` → `Predogled objave`
   **And** `Galerija objave` визуально и логически остаётся отдельным верхним блоком над `Vsebina objave`
   **And** существующий gallery flow из Story 4.1 не деградирует.

2. **Разделённые модели gallery и editor content:**
   **Given** admin работает с формой поста
   **When** добавляет media в gallery и изображения внутрь текста
   **Then** gallery items и inline images хранятся и редактируются независимо
   **And** gallery actions (`upload`, `reorder`, `set cover`, `remove`) не изменяют editor content
   **And** editor actions над inline images не меняют gallery state и не участвуют в cover-selection
   **And** submit payload собирается из трёх доменов: `meta`, `gallery`, `editor`.

3. **Textarea заменён на WYSIWYG editor:**
   **Given** admin редактирует блок `Vsebina objave`
   **When** взаимодействует с полем контента
   **Then** вместо plain `<textarea>` отображается клиентский `TiptapEditor`
   **And** editor поддерживает как минимум paragraph, headings H2-H4, bullet/ordered list, quote, code block и image block
   **And** при edit mode существующее значение `posts.content` корректно гидратируется в editor state
   **And** UI редактора остаётся keyboard-accessible и имеет `aria-label="Vsebina objave"`.

4. **Вставка инлайн-изображения в позицию курсора:**
   **Given** курсор находится внутри тела редактора
   **When** admin вставляет изображение через toolbar action, drag and drop или paste из clipboard
   **Then** файл загружается в Supabase Storage bucket `inline-images`
   **And** в месте вставки отображается временный upload placeholder/state
   **And** после успешной загрузки изображение вставляется как image block в текущую позицию курсора
   **And** editor state обновляется без потери соседнего текста.

5. **Управление inline image block:**
   **Given** в editor content уже есть inline image block
   **When** admin взаимодействует с этим блоком
   **Then** он может как минимум заменить изображение, отредактировать подпись, выровнять блок и удалить блок
   **And** удаление inline image block не влияет на gallery items
   **And** повторная загрузка/замена использует тот же `inline-images` flow.

6. **Изоляция ошибок загрузки:**
   **Given** upload inline image завершается ошибкой сети, размера или формата
   **When** upload helper возвращает ошибку
   **Then** placeholder удаляется из editor
   **And** остальной текст и gallery state сохраняются без rollback соседних изменений
   **And** пользователь видит системный toast с сообщением на slovene
   **And** курсор возвращается в предсказуемое место рядом с точкой неуспешной вставки.

7. **Preview и композиционные предупреждения:**
   **Given** admin собрал пост с gallery и rich text content
   **When** смотрит `Predogled objave`
   **Then** preview показывает gallery выше article body
   **And** inline images остаются внутри article body, а не подмешиваются в gallery
   **And** при visual overload (например, большая gallery и 4+ inline images) интерфейс показывает мягкое non-blocking предупреждение о читаемости/композиции
   **And** предупреждение не блокирует сохранение.

8. **Сохранение и редактирование существующих постов:**
   **Given** admin сохраняет новый или редактирует существующий пост
   **When** submit проходит успешно
   **Then** gallery сохраняется существующим brownfield flow через `post_media`
   **And** editor content сериализуется отдельно и сохраняется в `posts.content`
   **And** при edit mode existing gallery гидратируется отдельно от editor content
   **And** порядок gallery, cover selection и существующие admin сценарии Story 4.1 сохраняются.

## Tasks / Subtasks

- [ ] Task 1: Декомпозировать `PostForm` под rich-content authoring architecture (AC: 1, 2, 8)
  - [ ] 1.1 Выделить в `PostForm` отдельные домены состояния: `meta`, `gallery`, `editor`
  - [ ] 1.2 Убрать прямую зависимость поля `content` от plain textarea и подготовить integration point для `TiptapEditor`
  - [ ] 1.3 Добавить типы rich editor state и payload contracts в `src/features/admin/types.ts`
  - [ ] 1.4 Сохранить совместимость create/edit flow, scheduling section и curation toggles

- [ ] Task 2: Внедрить feature slice редактора (AC: 2, 3, 4, 5, 6)
  - [ ] 2.1 Создать `src/features/editor/components/TiptapEditor.tsx` как `'use client'` dumb/UI-компонент с `value` и `onChange`
  - [ ] 2.2 Создать `src/features/editor/extensions/ImageUpload.ts` для image node / upload command
  - [ ] 2.3 Создать `src/features/editor/lib/uploadInlineImage.ts` с загрузкой в `supabase.storage.from('inline-images')`
  - [ ] 2.4 Поддержать insert-at-cursor для toolbar action, drag and drop и paste
  - [ ] 2.5 Реализовать действия над image block: replace, caption, align, remove

- [ ] Task 3: Сохранить и изолировать gallery flow (AC: 1, 2, 7, 8)
  - [ ] 3.1 Оставить `MediaUploader` и `MediaSortableItem` в роли отдельного верхнего gallery блока
  - [ ] 3.2 Явно зафиксировать, что gallery использует существующий `post_media` pipeline и bucket `gallery-media`
  - [ ] 3.3 Не допустить смешивания gallery items и inline images в одном клиентском массиве media
  - [ ] 3.4 Проверить, что cover-selection работает только для gallery items

- [ ] Task 4: Собрать preview и submit integration (AC: 2, 6, 7, 8)
  - [ ] 4.1 Добавить/выделить preview-компонент для порядка `gallery above text`
  - [ ] 4.2 Сериализовать editor content перед submit в формат, согласованный с текущей колонкой `posts.content`
  - [ ] 4.3 Обновить `createPost()` и `updatePost()` так, чтобы они принимали новый editor payload без ломки текущего gallery flow
  - [ ] 4.4 Добавить composition warnings для inline-heavy, large-gallery и dual-overload сценариев

- [ ] Task 5: Покрыть regression и edge-case tests (AC: 1-8)
  - [ ] 5.1 Unit tests для разделения `gallery` и `editor` state
  - [ ] 5.2 Unit tests для insert/remove/replace/update inline image nodes
  - [ ] 5.3 Component tests для `/posts/create` rich authoring flow
  - [ ] 5.4 Preview tests на порядок `gallery` над `article body`
  - [ ] 5.5 Regression tests, подтверждающие, что Story 4.1 gallery behavior не сломан
  - [ ] 5.6 Edge-case tests: inline-heavy article, large gallery, dual overload, upload failure isolation, edit hydration

## Dev Notes

### Story Intent

Это brownfield story, а не greenfield rewrite. Цель истории: эволюционно перестроить authoring flow в `/posts/create`, сохранив рабочий multimedia pipeline Story 4.1 и добавив отдельный слой rich editor content с inline images.

### Scope Boundaries

**Входит в scope:**
- замена текущего `textarea` на WYSIWYG authoring experience
- отдельная модель editor content и inline images
- сохранение gallery как верхнего визуального блока перед текстом
- preview итоговой композиции
- edge-case handling для многих inline images и большого gallery

**Не входит в scope:**
- полный consumer-side rewrite feed/detail rendering
- сложный drag-and-drop layout внутри editor
- автоматическая миграция старого контента
- video authoring внутри WYSIWYG
- orphan cleanup jobs для `inline-images`

### Brownfield Context

Текущая рабочая реализация уже существует в следующих файлах и должна быть расширена, а не заменена:

- `src/app/(admin)/posts/create/page.tsx`
- `src/app/(admin)/posts/[id]/edit/page.tsx`
- `src/features/admin/components/PostForm.tsx`
- `src/features/admin/components/MediaUploader.tsx`
- `src/features/admin/components/MediaSortableItem.tsx`
- `src/features/admin/api/posts.ts`
- `src/features/admin/types.ts`

Текущее состояние brownfield-кода:
- `PostForm` уже содержит рабочие блоки `Naslov`, `Kategorija`, `Povzetek`, `Vsebina`, `Mediji`, curation toggles и scheduling
- `Vsebina` пока реализована как plain `textarea`
- `MediaUploader` и `MediaSortableItem` уже закрывают upload/reorder/cover/remove сценарии для gallery
- `createPost()` и `updatePost()` уже поддерживают text/media post flow и не должны быть сломаны при добавлении editor layer

### Architecture Guardrails

- Следовать паттерну Smart Container / Dumb UI
- `TiptapEditor` не должен импортировать Zustand store напрямую
- `src/components/ui/` не должен импортировать ничего из `src/features/`
- Для DB-полей использовать только `snake_case`
- Client-side reads остаются через Supabase client patterns, без лишних route handlers
- Все user-facing строки в UI и валидации должны быть на slovene
- Все interactive controls должны сохранять минимальный touch target `44x44`

### Storage & Media Separation

- Gallery media остаются в существующем bucket `gallery-media` и сохраняются через `post_media`
- Inline images используют отдельный bucket `inline-images`
- Gallery и inline images должны быть разделены визуально, логически и на уровне state/payload
- Inline images не участвуют в cover-selection и не должны попадать в `post_media`, если для этого не появится отдельное архитектурное решение в последующих story

### Recommended Engineering Direction

- Разделить `PostForm` на зоны ответственности `meta`, `gallery`, `editor`, `preview`
- Вынести editor-специфичную логику в `src/features/editor/`
- Оставить `MediaUploader` в `src/features/admin/components/` как отдельный gallery block
- Preview должен получать уже нормализованные данные, а не собирать состояние сам
- Если editor хранит structured JSON model, история обязана сохранить отдельный шаг сериализации/десериализации в `posts.content` и не ломать edit hydration

### Suggested File Touchpoints

| Файл | Изменение |
|------|-----------|
| `src/features/admin/components/PostForm.tsx` | декомпозиция формы, подключение editor блока, preview, warnings |
| `src/features/admin/types.ts` | типы rich content authoring state и payload |
| `src/features/admin/api/posts.ts` | submit integration для editor content без ломки gallery flow |
| `src/features/editor/components/TiptapEditor.tsx` | новый dumb editor component |
| `src/features/editor/extensions/ImageUpload.ts` | кастомное Tiptap extension для image upload |
| `src/features/editor/lib/uploadInlineImage.ts` | helper загрузки в `inline-images` |
| `src/app/(admin)/posts/create/page.tsx` | при необходимости только wiring/layout |
| `src/app/(admin)/posts/[id]/edit/page.tsx` | hydration wiring для edit mode |
| `tests/unit/features/admin/components/PostForm.test.tsx` | rich-content form regression tests |
| `tests/unit/features/admin/api/posts.test.ts` | payload separation / submit tests |
| `tests/unit/features/editor/*` | unit tests для editor nodes и upload flow |

### Testing Requirements

Минимальный обязательный набор:
- unit tests для разделения `gallery` и `editor` state
- unit tests для insert/remove/update inline image nodes
- component tests для `/posts/create` rich content flow
- preview tests: gallery above text
- edge-case tests: many inline images + large gallery
- regression tests: существующий gallery behavior Story 4.1 не сломан
- edit hydration tests: existing `content` и existing gallery загружаются независимо

### Risks To Call Out

1. Если оставить одну общую media-модель для gallery и editor, UX и submit быстро станут хрупкими.
2. Если добавить в одну историю одновременно authoring, full renderer parity, DB migration и migration старого контента, scope станет слишком большим даже для Senior SWE.
3. Если менять `PostForm` без жёсткой regression coverage, легко сломать create/edit flow, cover selection или scheduling, уже стабилизированные в Story 4.1 и 6.3.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-7.1]
- [Source: _bmad-output/planning-artifacts/epics.md#Epic-7-Rich-Content-Experience]
- [Source: _bmad-output/implementation-artifacts/Post Creation-Markdown editer/sm-brief-epic-7-create-post-rich-content.md]
- [Source: _bmad-output/planning-artifacts/prd.md] — FR16.2, FR19, FR19.1, NFR4.2
- [Source: _bmad-output/planning-artifacts/architecture.md] — Content Editor System, Storage Bucket Architecture, Project Structure
- [Source: _bmad-output/project-context.md]
- [Source: src/features/admin/components/PostForm.tsx]
- [Source: src/features/admin/components/MediaUploader.tsx]
- [Source: src/features/admin/components/MediaSortableItem.tsx]
- [Source: src/features/admin/api/posts.ts]
- [Source: src/features/admin/types.ts]
- [Source: _bmad-output/stories/4-1-creating-and-editing-multimedia-posts.md]
- [Source: _bmad-output/stories/6-3-ui-toggle-schedule-and-datetime-picker-in-post-form.md]

## Dev Agent Record

### Agent Model Used

GPT-5

### Completion Notes List

- Story 7.1 сформирована как самостоятельная brownfield-safe implementation story для Senior SWE.
- Scope уточнён: story покрывает authoring flow и preview composition, но не full consumer-side renderer rewrite.
- В story зафиксировано обязательное разделение gallery и inline media на уровне UI, state и submit payload.
- Добавлены конкретные touchpoints по текущему коду, чтобы избежать greenfield-реализации поверх существующего `PostForm` flow.

### Change Log

- 2026-04-05: Создана story 7.1 для Epic 7 на основе `epics.md`, project context и SM brief по rich content authoring.
