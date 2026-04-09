# Brief: Scrum Master - Story Prep для Epic 7 / Rich Content в `/posts/create`

## Цель документа

Этот brief нужен Scrum Master как опорный артефакт для написания **подробной implementation story для Senior Software Engineer** по Epic 7. Документ связывает:

- Epic 7 из `_bmad-output/planning-artifacts/epics.md`
- существующую реализацию формы создания поста
- новое UX-решение для rich content authoring в `/posts/create`

Главная задача SM: не просто переписать Epic 7 в story, а превратить его в **исполняемую инженерную историю** с четкой границей scope, проверяемыми acceptance criteria, техническими ограничениями и тестовыми ожиданиями.

---

## Какой именно scope нужно покрыть в story

Рекомендуемый scope для истории Senior SWE:

**Редизайн и переработка authoring flow страницы `/posts/create` так, чтобы она поддерживала два независимых визуальных слоя контента:**

1. `Galerija objave` как отдельный верхний блок поста
2. `WYSIWYG`/rich editor для текста с инлайн-изображениями внутри статьи

### Что входит в scope

- замена текущего plain `textarea` в форме создания поста на rich text editing experience
- добавление отдельной модели данных для inline images в тексте
- сохранение текущего gallery flow, но как отдельного блока **перед текстом**
- новый preview, который отражает финальный порядок публикации:
  - gallery
  - article body
  - inline images внутри article body
- обработка edge cases:
  - много inline images
  - большая gallery
  - одновременно много gallery items и много inline images

### Что не должно бесконтрольно разрастись в этой истории

- полная переработка consumer-side rendering всего feed, если это не требуется для завершения authoring flow
- сложный drag-and-drop внутри редактора
- автоматическая миграция старого контента
- video authoring внутри inline editor
- orphan cleanup background jobs

Если SM видит, что объем не помещается в одну сильную историю Senior уровня, допустимо разбить на две последовательные stories:

1. authoring model + `/posts/create`
2. rendering/read path для `PostDetail` и feed-consumption

Но первая история должна оставаться **самодостаточной** и deliverable.

---

## Контекст Epic 7, который нужно сохранить

Из Epic 7 обязательно сохранить следующие intent-level требования:

- FR19.1: автор может создавать rich content через WYSIWYG c inline images
- FR16.2: участница видит корректный комбинированный layout
- NFR4.2: изображения в теле контента не должны ломать производительность и должны поддерживать lazy loading там, где применимо

### Важное уточнение для SM

В новой UX-концепции **галерея остается перед текстом поста**. Это не optional detail, а зафиксированное правило композиции. История должна явно закрепить, что:

- gallery authoring block находится выше editor block на `/posts/create`
- в preview gallery тоже идет выше article body
- inline images не смешиваются с gallery items и не участвуют в cover-selection

---

## От чего отталкиваться в текущем коде

Базовая текущая реализация уже существует и должна учитываться как brownfield-контекст:

- `src/app/(admin)/posts/create/page.tsx`
- `src/features/admin/components/PostForm.tsx`
- `src/features/admin/components/MediaUploader.tsx`
- `src/features/admin/components/MediaSortableItem.tsx`
- `src/features/admin/types.ts`
- `src/features/admin/api/posts.ts`

SM должен писать историю как **эволюцию существующего PostForm flow**, а не как greenfield-фичу с нуля.

---

## UX-решение, которое должно быть отражено в story

### Информационная архитектура экрана `/posts/create`

Порядок блоков:

1. `Naslov`
2. `Kategorija`
3. `Povzetek`
4. `Galerija objave`
5. `Vsebina objave`
6. `Nastavitve objave`
7. `Predogled objave`

### Роли двух медиа-слоев

`Galerija objave`:

- главный визуальный блок поста
- отдельный upload/reorder/cover flow
- отображается перед текстом

`Inline images v besedilu`:

- поддерживают ритм чтения внутри статьи
- вставляются в точку курсора
- редактируются независимо от gallery
- не участвуют в выборе cover image

### Ключевое UX-правило

Gallery и inline images должны быть разделены не только визуально, но и **на уровне данных, состояния и submit payload**.

---

## Что должен зафиксировать SM в story как инженерную модель

История должна направлять Senior SWE к разделению формы на 3 домена состояния:

1. `meta`
2. `gallery`
3. `editor`

### Ожидаемая модель данных

Story должна прямо описывать, что:

- `gallery` хранится отдельно от body editor content
- `editor content` не должен оставаться plain string-only полем без структуры
- inline image nodes должны быть частью editor content model
- final payload должен собираться из:
  - `formValues`
  - `galleryItems`
  - `editorContent`

### Рекомендуемое инженерное направление

Senior SWE должен иметь свободу реализации, но история должна подталкивать к следующему решению:

- `PostForm` декомпозируется на meta/gallery/editor/preview блоки
- gallery и editor не используют общий массив media
- editor не импортирует Supabase/Zustand напрямую, если выступает dumb/UI слоем
- preview получает уже нормализованные данные

---

## Рекомендуемая декомпозиция истории на deliverables

SM стоит оформить историю так, чтобы она содержала 5 крупных deliverables.

### Deliverable 1. Authoring architecture refactor

- вынести из текущего `PostForm` отдельные зоны ответственности
- подготовить типы rich content authoring state
- разделить gallery state и editor state

### Deliverable 2. Gallery block preservation and upgrade

- сохранить gallery block в верхней части формы
- оставить/reuse текущий upload + sort + cover flow
- добавить live preview итогового gallery layout

### Deliverable 3. Rich text editor with inline image flow

- заменить `textarea` на editor experience
- реализовать insert image at cursor
- реализовать image-block actions: replace, caption, align, remove

### Deliverable 4. Preview and composition warnings

- собрать preview в правильном порядке: gallery above text
- показывать composition warnings при медиаперегрузе
- поддержать mobile/desktop preview modes, если помещается в scope

### Deliverable 5. Submit integration and validation

- сериализовать данные в новый payload
- сохранить gallery и editor content раздельно
- обработать upload errors без потери соседнего состояния

---

## Acceptance Criteria, которые SM должен включить

Ниже не финальный story-текст, а обязательный минимум смысла, который нельзя потерять.

### AC 1. Структура экрана

**Given** admin открывает `/posts/create`  
**When** страница загружается  
**Then** форма содержит отдельный блок `Galerija objave` перед блоком `Vsebina objave`  
**And** gallery block и text editor block визуально и логически разделены

### AC 2. Раздельные модели медиа

**Given** admin работает с формой поста  
**When** добавляет изображения в gallery и в тело текста  
**Then** gallery items и inline images хранятся и редактируются независимо  
**And** операции над gallery не изменяют inline images  
**And** операции над inline images не изменяют gallery

### AC 3. Rich editor вместо textarea

**Given** admin редактирует тело поста  
**When** взаимодействует с блоком `Vsebina objave`  
**Then** вместо plain `textarea` отображается rich text editor  
**And** editor поддерживает как минимум paragraph, heading, list, quote и image block

### AC 4. Вставка инлайн-изображения

**Given** курсор находится в теле редактора  
**When** admin нажимает `Dodaj fotografijo v besedilo` и выбирает изображение  
**Then** изображение вставляется в текущую позицию как отдельный image block  
**And** block можно отредактировать, заменить и удалить  
**And** ошибка upload не уничтожает остальной текст редактора

### AC 5. Gallery остается верхним визуальным блоком

**Given** пост содержит и gallery, и rich text content  
**When** admin открывает preview  
**Then** gallery отображается выше текста  
**And** inline images остаются внутри текстового потока, а не выносятся в gallery

### AC 6. Composition warnings

**Given** пост содержит много визуального контента  
**When** количество gallery items и/или inline images превышает UX-порог  
**Then** интерфейс показывает мягкие предупреждения о перегрузке композиции  
**And** предупреждения не блокируют сохранение

### AC 7. Submit payload

**Given** admin завершил редактирование  
**When** отправляет форму  
**Then** submit собирает раздельные части данных: meta, gallery, editor content  
**And** сериализация не смешивает gallery media и inline images в одну неструктурированную модель на клиенте

### AC 8. Brownfield-safe integration

**Given** проект уже содержит работающий flow создания мультимедийного поста  
**When** новая история реализована  
**Then** текущие возможности gallery upload/reorder/cover selection не теряются  
**And** edit/create flow не деградирует по сравнению с текущим Story 4.1

---

## Edge cases, которые должны попасть в story явно

SM должен включить edge cases не как nice-to-have, а как обязательные сценарии приемки.

### Inline-heavy article

- 4+ inline images в тексте
- длинный rich content body
- editor остается управляемым
- пользователь видит warning про читаемость на mobile

### Large gallery

- gallery близка к лимиту
- preview не разваливается
- верхний visual block остается читаемым

### Dual overload

- большая gallery + много inline images
- пользователь получает composition-level warning
- UI не схлопывается и не перестает быть понятным

### Failure isolation

- failure при upload inline image не ломает gallery
- failure при gallery upload не ломает editor content

### Editing existing content

Если story включает edit flow, то нужно явно закрепить:

- rich content existing value корректно гидратится в editor
- существующая gallery гидратится отдельно
- порядок gallery сохраняется

---

## Технические ограничения, которые нельзя потерять

История должна уважать текущие правила проекта:

- Smart Container / Dumb UI
- `snake_case` для DB fields
- `src/components/ui/` не импортирует `src/features/`
- minimum touch target `44x44`
- коммуникация UI текста на slovene
- Next.js App Router / client-server boundary без лишних route handlers для client-side reads

### Особенно важно

SM должен прописать в story, что:

- решение внедряется в существующую feature-driven структуру
- rich editor UI не должен тащить в себя бизнес-логику загрузок напрямую, если это ломает архитектурные границы
- если для editor content выбирается structured JSON model, это должно быть явно отражено в acceptance criteria или technical notes

---

## Что стоит указать в Technical Notes внутри будущей story

Ниже рекомендации для блока `Technical Notes`, который SM должен включить в финальную story.

### Suggested file areas

- `src/app/(admin)/posts/create/page.tsx`
- `src/features/admin/components/PostForm.tsx`
- `src/features/admin/components/MediaUploader.tsx`
- `src/features/admin/api/posts.ts`
- `src/features/admin/types.ts`
- новый editor slice внутри `src/features/admin/` или отдельного `src/features/editor/`

### Suggested engineering direction

- декомпозировать `PostForm`
- ввести типы rich content nodes
- держать gallery отдельно
- сделать preview отдельным dumb component
- предусмотреть сериализацию/десериализацию editor content

### Suggested non-goals

- полноценный universal migration framework для старого `content`
- тяжелая автоматизация переноса inline images в gallery
- поддержка video inside WYSIWYG на первом проходе

---

## Ожидания по тестированию

История для Senior SWE должна содержать явное требование к automated coverage.

Минимальный набор:

- unit tests для gallery/editor state separation
- unit tests для insert/remove/update inline image nodes
- component tests для `/posts/create` rich content flow
- preview tests: gallery above text
- edge case tests: many inline images + large gallery
- regression tests, подтверждающие, что existing gallery behavior не сломан

### Что важно для QA формулировки

SM должен потребовать не только happy path, но и:

- upload error path
- validation path
- disabled state path
- hydration path для edit mode, если он входит в scope истории

---

## Риски, которые SM должен подсветить в истории

### Риск 1. Смешение gallery и editor media

Если разработчик оставит одну общую media-модель, UI быстро станет хрупким и story потеряет UX-смысл.

### Риск 2. Слишком большой scope

Если в одну story одновременно включить:

- новый editor
- новый renderer
- DB migration
- full preview parity
- edit mode

то история станет плохо исполнимой даже для Senior SWE.

### Риск 3. Сломать текущий flow Story 4.1

Новая история не должна откатить существующий рабочий функционал:

- gallery upload
- ordering
- cover selection
- create/edit post flow

---

## Рекомендуемая формулировка цели истории для SM

Можно опереться на такую формулировку:

> As an admin author, I want to create a post in `/posts/create` using a separated gallery block and a rich text editor with inline images, so that I can compose visually rich articles without mixing gallery media and article media.

---

## Что должен получить Senior SWE на входе в финальной story

После работы Scrum Master story должна содержать:

- четкий scope без расплывчатого "реализовать Epic 7"
- список конкретных AC
- список brownfield-зависимостей
- file/module touchpoints
- testing expectations
- technical notes по разделению gallery/editor state
- edge cases и non-goals

Если этих разделов нет, история будет недостаточно подготовлена для Senior уровня исполнения.

---

## Рекомендуемый результат для SM

Итоговая story должна быть готова к передаче Senior SWE без дополнительной UX-интерпретации и без необходимости заново выяснять:

- где должна быть gallery
- как соотносятся gallery и inline images
- что именно считается finished behavior
- какие граничные сценарии обязательны

Этот brief использовать как прямой companion document при написании story по Epic 7.
