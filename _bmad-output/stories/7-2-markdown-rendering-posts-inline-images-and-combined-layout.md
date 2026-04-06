# Story 7.2: Markdown-рендеринг постов с инлайн-изображениями и комбинированным layout

Status: review

## Story

As a участница,
I want видеть посты с форматированным текстом, встроенными изображениями и галереей в правильной компоновке,
so that я могла удобно читать богатый контент без визуальных артефактов.

## Acceptance Criteria

1. **Только текст (без галереи):**
   **Given** пост содержит только HTML-контент в `posts.content` (без `post_media`)
   **When** участница открывает страницу поста
   **Then** компонент `MarkdownRenderer` рендерит форматированный текст (заголовки, списки, жирный, курсив, блоки кода, цитаты)
   **And** все `<img>` в теле контента имеют атрибут `loading="lazy"` (NFR4.2)

2. **Текст с инлайн-изображениями:**
   **Given** пост содержит HTML с инлайн-изображениями (`<figure data-type="inline-image">`)
   **When** участница открывает страницу поста
   **Then** инлайн-изображения отображаются внутри текстового блока в правильном месте согласно разметке
   **And** каждое инлайн-изображение имеет `loading="lazy"` (NFR4.2, NFR16)
   **And** изображения адаптивны: `max-width: 100%`, не выходят за ширину контентного блока

3. **Комбинированный layout (текст + галерея):**
   **Given** пост содержит HTML-контент И `post_media` с 2+ записями
   **When** участница открывает страницу поста
   **Then** блок `GalleryGrid` отображается **выше** блока `MarkdownRenderer`
   **And** между ними есть визуальный разделитель (отступ `gap` из design tokens, `mt-6`)
   **And** `PostDetail` передаёт `content: string` и `media: PostMedia[]` как независимые пропы

4. **XSS-защита:**
   **Given** `posts.content` содержит потенциально опасный HTML (например, `<script>`, `onerror=...`, `onclick=...`)
   **When** `MarkdownRenderer` парсит и рендерит контент
   **Then** HTML санитизируется через DOMPurify до рендеринга
   **And** разрешены только безопасные теги: `p`, `strong`, `em`, `u`, `s`, `ul`, `ol`, `li`, `h2`, `h3`, `h4`, `img`, `code`, `pre`, `blockquote`, `a`, `br`, `figure`, `figcaption`
   **And** все атрибуты-обработчики событий (`onclick`, `onerror`, `onload` и т.д.) удаляются

5. **Архитектурные ограничения компонента:**
   **Given** компонент `MarkdownRenderer` реализован
   **When** разработчик инспектирует код
   **Then** `MarkdownRenderer` — `'use client'` Dumb UI компонент в `src/features/feed/components/MarkdownRenderer.tsx`
   **And** принимает только `content: string` через props, не импортирует Supabase и Zustand
   **And** конфигурация DOMPurify (allowed tags, lazy loading transform) вынесена в `src/lib/markdown.ts`

6. **Unit-тесты:**
   **Given** компонент `MarkdownRenderer` реализован
   **When** запускаются unit-тесты
   **Then** тесты покрывают: рендеринг заголовков, списков, блока кода, инлайн-изображений с `loading="lazy"`, удаление `<script>` тегов, удаление `onclick` атрибутов

## Tasks / Subtasks

- [x] Task 1: Установить зависимость DOMPurify (AC: 4)
  - [x] 1.1 Установить `dompurify` и `@types/dompurify` через npm
  - [x] 1.2 Убедиться, что сборка и `npm run typecheck` проходят

- [x] Task 2: Создать `src/lib/markdown.ts` (AC: 4, 5)
  - [x] 2.1 Экспортировать функцию `sanitizeHtml(html: string): string` — вызывает `DOMPurify.sanitize()` с `ALLOWED_TAGS` и `ALLOWED_ATTR` из конфигурации
  - [x] 2.2 Разрешённые теги: `p`, `strong`, `em`, `u`, `s`, `ul`, `ol`, `li`, `h2`, `h3`, `h4`, `img`, `code`, `pre`, `blockquote`, `a`, `br`, `figure`, `figcaption`
  - [x] 2.3 Разрешённые атрибуты: `src`, `alt`, `href`, `class`, `data-type`, `data-align`, `data-upload-id`, `data-storage-bucket`, `loading`, `width`, `height`, `style`, `target`, `rel`
  - [x] 2.4 После sanitize: пройти по `querySelectorAll('img')` и проставить `loading="lazy"` на каждый `<img>` без этого атрибута — возвращать итоговую строку
  - [x] 2.5 Guard для SSR: если `typeof window === 'undefined'` — возвращать пустую строку (компонент `'use client'`, поэтому это защита для тестов и edge cases)

- [x] Task 3: Создать `src/features/feed/components/MarkdownRenderer.tsx` (AC: 1, 2, 3, 4, 5)
  - [x] 3.1 Добавить директиву `'use client'` вверху файла
  - [x] 3.2 Принимать проп `content: string`
  - [x] 3.3 В теле компонента вызывать `sanitizeHtml(content)` из `src/lib/markdown.ts`
  - [x] 3.4 Рендерить через `<div dangerouslySetInnerHTML={{ __html: sanitized }} />`
  - [x] 3.5 Применить классы `.rich-content` для styling (те же, что в TiptapEditor и PostDetail)
  - [x] 3.6 Включить `figure` styling классы для inline-images (скопировать из PostDetail — см. Dev Notes)

- [x] Task 4: Обновить `PostDetail` — заменить `dangerouslySetInnerHTML` на `MarkdownRenderer` (AC: 1, 2, 3)
  - [x] 4.1 Импортировать `MarkdownRenderer` из `@/features/feed/components/MarkdownRenderer`
  - [x] 4.2 Заменить блок `<div dangerouslySetInnerHTML={{ __html: post.content || '<p></p>' }} />` на `<MarkdownRenderer content={post.content || ''} />`
  - [x] 4.3 Убедиться, что GalleryGrid-блок идёт выше контентного блока (уже реализовано, проверить отступ `mt-6` между ними)
  - [x] 4.4 Удалить inline-styling фигур из wrapper `div.rich-content` — перенести в `MarkdownRenderer` (или убедиться что они есть в `.rich-content` классе)

- [x] Task 5: Unit-тесты для `MarkdownRenderer` (AC: 6)
  - [x] 5.1 Создать `tests/unit/features/feed/components/MarkdownRenderer.test.tsx`
  - [x] 5.2 Тест: рендерит `<h2>` заголовок из HTML
  - [x] 5.3 Тест: рендерит `<ul>` список
  - [x] 5.4 Тест: рендерит `<pre><code>` блок кода
  - [x] 5.5 Тест: `<img>` получает `loading="lazy"` атрибут
  - [x] 5.6 Тест: `<script>` тег удаляется из output
  - [x] 5.7 Тест: `onclick` атрибут удаляется
  - [x] 5.8 Тест: пустой `content` рендерится без ошибок

- [x] Task 6: Финальная проверка (все AC)
  - [x] 6.1 `npm run typecheck` — без ошибок
  - [x] 6.2 `npm run lint` — без ошибок
  - [x] 6.3 `npm run test` — без регрессий (особенно `PostDetail.test.tsx`)

## Dev Notes

### КРИТИЧНО: Формат контента — HTML, НЕ Markdown

**Story 7.1 изменила реализацию**: TiptapEditor сериализует контент как HTML через `editor.getHTML()`, а не как Markdown-строку. `posts.content` в базе данных хранит Tiptap HTML. Поэтому:
- `react-markdown` и `remark-gfm` **НЕ используются** в этой истории — они не нужны для HTML-контента
- Ни в `package.json`, ни в архитектуре нет этих пакетов (архитектурный документ написан до реализации Story 7.1)
- Вместо react-markdown: DOMPurify sanitize + `dangerouslySetInnerHTML`
- Компонент называется `MarkdownRenderer` согласно epics.md, но технически является HTML-рендерером с sanitization

### Текущее состояние PostDetail (BROWNFIELD)

Файл: `src/components/feed/PostDetail.tsx:299-309`

Текущий код (НЕБЕЗОПАСНЫЙ — нет sanitization):
```tsx
<div className="rich-content mt-4 [&_figure[data-align='center']]:mx-auto [&_figure[data-align='left']]:mr-auto [&_figure[data-align='right']]:ml-auto [&_figure[data-type='inline-image']]:my-4 [&_figure[data-type='inline-image']]:space-y-2 [&_figure[data-type='inline-image']_img]:rounded-lg [&_figure[data-type='inline-image']_img]:border [&_figure[data-type='inline-image']_img]:border-border">
  {post.content !== null ? (
    <div
      dangerouslySetInnerHTML={{
        __html: post.content || '<p></p>',
      }}
    />
  ) : (
    <p className="leading-relaxed text-muted-foreground">{post.excerpt}</p>
  )}
</div>
```

Целевое состояние:
```tsx
<div className="mt-6">
  {post.content !== null ? (
    <MarkdownRenderer content={post.content || ''} />
  ) : (
    <p className="leading-relaxed text-muted-foreground">{post.excerpt}</p>
  )}
</div>
```

Inline-styling для figure должен переехать в `MarkdownRenderer`.

### Styling: `.rich-content` класс

TiptapEditor (строка 128) и PostDetail (строка 299) используют класс `rich-content`. Проверь, определён ли он в `src/app/globals.css`. Если определён — `MarkdownRenderer` использует тот же класс. Если нет — Tailwind-классы копируются из PostDetail wrapper'а.

### DOMPurify + Next.js 16: SSR Guard

DOMPurify работает только в браузере (требует `window`/`document`). Поскольку `MarkdownRenderer` — `'use client'` компонент, он не рендерится на сервере в production. Тем не менее:
- В Vitest (jsdom) `window` доступен — тесты работают
- Добавь guard в `sanitizeHtml`: `if (typeof window === 'undefined') return ''`

Пример реализации `src/lib/markdown.ts`:
```typescript
import DOMPurify from 'dompurify'

const ALLOWED_TAGS = [
  'p', 'strong', 'em', 'u', 's', 'ul', 'ol', 'li',
  'h2', 'h3', 'h4', 'img', 'code', 'pre', 'blockquote',
  'a', 'br', 'figure', 'figcaption',
]

const ALLOWED_ATTR = [
  'src', 'alt', 'href', 'class', 'data-type', 'data-align',
  'data-upload-id', 'data-storage-bucket', 'loading',
  'width', 'height', 'style', 'target', 'rel',
]

export function sanitizeHtml(html: string): string {
  if (typeof window === 'undefined') return ''
  
  const clean = DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR })
  
  // Добавляем loading="lazy" всем <img> без этого атрибута
  const container = document.createElement('div')
  container.innerHTML = clean
  container.querySelectorAll('img').forEach((img) => {
    if (!img.hasAttribute('loading')) {
      img.setAttribute('loading', 'lazy')
    }
  })
  return container.innerHTML
}
```

### Комбинированный layout: уже реализован

В текущем `PostDetail.tsx` gallery (`GalleryGrid`) уже рендерится ДО блока content:
```tsx
// строка 264: Gallery — 2+ медиафайлов
{(post.media?.length ?? 0) >= 2 && (
  <div className="mb-6"><GalleryGrid ... /></div>
)}

// строка 298: Content
<div className="rich-content mt-4 ...">...</div>
```

Нужно только:
1. Убедиться что отступ между блоками — `mt-6` (минимум)
2. Заменить небезопасный `dangerouslySetInnerHTML` на `MarkdownRenderer`

### Storage Bucket Architecture

- Инлайн-изображения хранятся в bucket `inline-images` (story 7.1)
- Gallery media — в bucket `gallery-media`
- В `posts.content` URL инлайн-картинок уже embedded как `src` в `<img>` тегах

### Архитектурные ограничения (проект)

- `src/components/ui/` **НЕ импортирует** из `src/features/` — соблюдать
- `MarkdownRenderer` — Dumb UI, в `src/features/feed/components/` (НЕ в `src/components/ui/`)
- `src/lib/markdown.ts` — утилита, НЕ добавлять `'use server'` директиву
- Все DB-поля: `snake_case` напрямую — `post.content`, не `post.richContent`
- UI-строки в компоненте на словенском языке (хотя здесь нет user-facing строк)

### Файлы которых НЕ трогать

- `src/features/editor/components/TiptapEditor.tsx` — scope Story 7.1, в этой истории не меняется
- `src/features/editor/extensions/ImageUpload.ts` — не трогать
- `src/features/admin/components/PostForm.tsx` — не трогать
- `src/features/feed/store.ts` — не трогать
- `src/components/feed/GalleryGrid.tsx` — не трогать

### Тестирование: мок DOMPurify в Vitest

Vitest использует jsdom, который поддерживает `window` и `document`, поэтому DOMPurify должен работать без мока. Если тест падает с `window is not defined` — используй:
```typescript
// В файле теста:
vi.mock('dompurify', () => ({
  default: {
    sanitize: (html: string) => html, // passthrough для тестов
  },
}))
```

### Project Structure Notes

- `src/lib/markdown.ts` — новый файл (не существует)
- `src/features/feed/components/MarkdownRenderer.tsx` — новый файл (не существует)
- `tests/unit/features/feed/components/MarkdownRenderer.test.tsx` — новый файл

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-7.2] — AC и FRs
- [Source: _bmad-output/planning-artifacts/epics.md#Epic-7] — Epic context
- [Source: _bmad-output/planning-artifacts/architecture.md#Content-Editor-System] — DOMPurify, Storage buckets
- [Source: _bmad-output/stories/7-1-wysiwyg-editor-inline-images-posts.md] — HTML output format (не Markdown!)
- [Source: src/components/feed/PostDetail.tsx:299-309] — текущий dangerouslySetInnerHTML без sanitize
- [Source: src/features/editor/components/TiptapEditor.tsx:162-168] — `editor.getHTML()` → EditorContentValue.html
- [Source: src/features/admin/types.ts:31-35] — EditorContentValue: html, json, inline_images_count
- [Source: _bmad-output/planning-artifacts/architecture.md#Storage-Bucket-Architecture] — inline-images bucket
- [Source: _bmad-output/project-context.md] — snake_case, Smart/Dumb pattern, 'use server' запрет для lib/

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Установлен `dompurify` + `@types/dompurify` (3 пакета)
- Создан `src/lib/markdown.ts`: `sanitizeHtml()` с DOMPurify + auto `loading="lazy"` для img + SSR guard
- Создан `src/features/feed/components/MarkdownRenderer.tsx`: 'use client' Dumb UI компонент, принимает `content: string`, применяет sanitizeHtml, рендерит с `.rich-content` + figure-styling классами
- Обновлён `PostDetail.tsx`: небезопасный `dangerouslySetInnerHTML` заменён на `<MarkdownRenderer>`, отступ `mt-6`, inline-styling figure перенесён в компонент
- Создано 8 unit-тестов для MarkdownRenderer (заголовки, списки, код, lazy img, XSS-защита)
- Обновлён 1 тест в `PostDetail.test.tsx` (поведение пустого content изменилось: убран fallback `<p></p>`)
- Все pre-existing failures в onboarding-тестах (от коммита 5e1ae4ff) не связаны с этой story
- ✅ Resolved review finding [Patch]: SSR Guard — изменён `return ''` → `return html`, добавлен `suppressHydrationWarning` в MarkdownRenderer
- ✅ Resolved review finding [Patch]: Двойной парсинг DOM — заменён на DOMPurify `addHook`/`removeHook`, без создания отдельного container div
- ✅ Resolved review finding [Patch]: Безопасность ссылок — в хуке добавлен `rel="noopener noreferrer"` для `target="_blank"` ссылок; добавлен тест (9 итого)

### File List

- src/lib/markdown.ts (новый)
- src/features/feed/components/MarkdownRenderer.tsx (новый)
- src/components/feed/PostDetail.tsx (изменён)
- tests/unit/features/feed/components/MarkdownRenderer.test.tsx (новый)
- tests/unit/components/feed/PostDetail.test.tsx (изменён)

## Change Log

- 2026-04-06: Story 7.2 реализована — MarkdownRenderer + DOMPurify sanitization, XSS-защита, lazy loading для img, интеграция в PostDetail
- 2026-04-06: Code review findings resolved (3 Patch): SSR hydration fix, single-pass DOMPurify via hooks, link security rel="noopener noreferrer"


### Review Findings

- [x] [Review][Patch] Риск ошибки гидратации из-за SSR Guard [src/lib/markdown.ts:43]
- [x] [Review][Patch] Неэффективная очистка / Избыточный парсинг DOM [src/lib/markdown.ts:47]
- [x] [Review][Patch] Безопасность: Отсутствует target='blank' и rel='noopener' для ссылок [src/lib/markdown.ts]
- [x] [Review][Defer] Производительность: Отсутствует useMemo для ресурсоемкой очистки [src/features/feed/components/MarkdownRenderer.tsx:10] - отложено, не является критичным сейчас
- [x] [Review][Defer] Отсутствует Error Boundary для манипуляций с DOM [src/lib/markdown.ts:47] - отложено, будет решено после исправления парсинга
