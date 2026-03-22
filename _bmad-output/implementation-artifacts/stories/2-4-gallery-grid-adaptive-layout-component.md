# Story 2.4: Компонент галереи с адаптивной сеткой (GalleryGrid)

Status: ready-for-dev

## Story

As a участница,
I want видеть медиа в посте-галерее в красивой адаптивной сетке,
so that удобно просматривать все фото и видео поста без лишней прокрутки.

## Acceptance Criteria

1. **Компонент `GalleryGrid` создан** и является **Dumb UI** компонентом: принимает только `props`, не имеет прямого доступа к Supabase/Zustand.

2. **Логика сетки из FR16.1 реализована полностью:**
   - 1 элемент → `GalleryGrid` **не рендерится** (данный случай обрабатывается вне компонента — стандартный `LazyMediaWrapper`)
   - 2–4 элемента → адаптивная сетка (2 колонки для 2-3, 3 колонки для 4 — по усмотрению, главное: не 1 колонка)
   - 5 элементов → сетка 2×3 (2 колонки, 3 строки)
   - 6 элементов → сетка 3×3 (но только 6 = 2 строки×3 колонки)
   - 7–10 элементов → первые 4 в сетке 2×2, остальные (5–10) — горизонтальная карусель ниже

3. **Проп `isLoading: boolean`** — компонент самостоятельно рендерит свой Skeleton-плейсхолдер при `isLoading=true` (Dumb pattern, паттерн из Story 2.3: `PostCardSkeleton`).

4. **Порядок медиа** определяется полем `order_index` из `PostMedia[]` — компонент сортирует по `order_index` перед рендером.

5. **Изображения** рендерятся через `LazyMediaWrapper` (уже существует в `src/components/media/LazyMediaWrapper.tsx`).

6. **Видео** рендерится через `LazyMediaWrapper` с `type="video"` и `src={thumbnail_url}` как постер (аналогично существующей логике в `PostDetail.tsx`); при клике — стандартный `<video controls>` или запрос к глобальному video-менеджеру (см. Dev Notes: реализация full video player — в Story 2.5).

7. **Каждый элемент доступен по клику**: клик открывает медиа на полный экран (lightbox) или вызывает опциональный колбэк `onMediaClick?: (index: number) => void`.

8. **Компонент покрыт юнит-тестами** для всех вариаций:
   - 2, 3, 4 элемента → сетка (не 1 колонка)
   - 5 элементов → сетка 2×3
   - 6 элементов → сетка 3×3
   - 7, 8, 9, 10 элементов → 4 в сетке + карусель
   - `isLoading=true` → рендерится Skeleton, а не медиа
   - `order_index` — медиа отсортированы корректно

9. **Интеграция в `PostCard`**: если у поста `media.length >= 2` → рендерится `GalleryGrid` вместо одиночного `LazyMediaWrapper`.

10. **Интеграция в `PostDetail`**: если у поста `media.length >= 2` → рендерится `GalleryGrid` с полным набором медиа (включая все элементы карусели).

## Tasks / Subtasks

- [ ] **Task 1: Добавить `PostMedia` тип и поле `media` в `Post`** (предварительное условие, Story 2.1 должна быть завершена) (AC: #4)
  - [ ] 1.1. Убедиться что `PostMedia` интерфейс присутствует в `src/features/feed/types.ts` (добавлен в Story 2.1)
  - [ ] 1.2. Убедиться что `PostRow` / `Post` содержит поле `media: PostMedia[]` (добавлено в Story 2.1)
  - [ ] 1.3. Если Story 2.1 ещё не выполнена — добавить временный `PostMedia` интерфейс самостоятельно с пометкой `// TODO: Story 2.1`

- [ ] **Task 2: Создать `GalleryGrid.tsx`** (AC: #1, #2, #3, #4, #5, #6, #7)
  - [ ] 2.1. Создать файл `src/components/feed/GalleryGrid.tsx` (Dumb UI, `'use client'` не обязателен если нет Browser API)
  - [ ] 2.2. Определить props-интерфейс (`GalleryGridProps`)
  - [ ] 2.3. Реализовать логику `getGridLayout(count)` → возвращает `{ layout: 'grid-2' | 'grid-2x3' | 'grid-3x3' | 'grid-2x2-carousel', mainCount: number }`
  - [ ] 2.4. Реализовать сортировку медиа по `order_index` (один `useMemo` или чистая сортировка)
  - [ ] 2.5. Реализовать рендер Skeleton-состояния при `isLoading=true`
  - [ ] 2.6. Реализовать рендер сетки для 2–6 элементов (CSS Grid через Tailwind)
  - [ ] 2.7. Реализовать карусель для 7–10 элементов (первые 4 — сетка, остальные — карусель)
  - [ ] 2.8. Интегрировать `LazyMediaWrapper` для каждого элемента
  - [ ] 2.9. Добавить колбэк `onMediaClick?: (index: number) => void` для клика по элементу

- [ ] **Task 3: Написать юнит-тесты** (AC: #8)
  - [ ] 3.1. Создать `tests/unit/components/feed/GalleryGrid.test.tsx`
  - [ ] 3.2. Написать тест для каждой вариации count (2, 3, 4, 5, 6, 7, 8, 9, 10)
  - [ ] 3.3. Тест на `isLoading=true` → Skeleton рендерится
  - [ ] 3.4. Тест на корректную сортировку по `order_index`
  - [ ] 3.5. Тест на `onMediaClick` вызывается с правильным index

- [ ] **Task 4: Интегрировать GalleryGrid в `PostCard`** (AC: #9)
  - [ ] 4.1. В `src/components/feed/PostCard.tsx` добавить условный рендер: `if (post.media?.length >= 2)` → `<GalleryGrid />`
  - [ ] 4.2. Обновить `PostCardData` / маппер `dbPostToCardData`: прокинуть `media: PostMedia[]` из `Post`
  - [ ] 4.3. Сохранить обратную совместимость с существующими постами без `post_media` (поле `image_url` — deprecated, но пока используется)

- [ ] **Task 5: Интегрировать GalleryGrid в `PostDetail`** (AC: #10)
  - [ ] 5.1. В `src/components/feed/PostDetail.tsx` добавить условный рендер для `media.length >= 2`
  - [ ] 5.2. Для постов с одним медиа — сохранить существующую логику (`LazyMediaWrapper` / видео)

- [ ] **Task 6: Верификация** (AC: #2, #8)
  - [ ] 6.1. Запустить `npx tsc --noEmit` — 0 ошибок
  - [ ] 6.2. Запустить все тесты — 0 новых ошибок

## Dev Notes

### 🏗️ Структура проекта (обязательно)

```
src/
├── components/
│   └── feed/
│       ├── GalleryGrid.tsx         # ← СОЗДАТЬ (Dumb UI)
│       ├── PostCard.tsx            # ← ИЗМЕНИТЬ (интеграция)
│       └── PostDetail.tsx          # ← ИЗМЕНИТЬ (интеграция)
├── features/
│   └── feed/
│       └── types.ts                # ← ИЗМЕНИТЬ (PostMedia, Post.media)
tests/
└── unit/
    └── components/
        └── feed/
            └── GalleryGrid.test.tsx  # ← СОЗДАТЬ
```

> **Критично**: `GalleryGrid` — это **Dumb UI компонент** (`src/components/feed/`, а не `src/features/feed/components/`). Он не импортирует ничего из `features/` или `lib/supabase`. Исключение: импорт `PostMedia` типа из `features/feed/types.ts` допустим как type-only import.

### 🔑 Критические паттерны из реализованного кода

**Паттерн `PostCardSkeleton` (из `PostCard.tsx`) — образец для `GalleryGrid` Skeleton:**
```tsx
// Dumb-компоненты сами рендерят своё Skeleton-состояние через isLoading prop
// Пример из PostCard.tsx:
// export function PostCardSkeleton({ showMedia = false }: { showMedia?: boolean }) { ... }

// Для GalleryGrid аналогично:
function GalleryGridSkeleton({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-2 gap-1">
      {Array.from({ length: Math.min(count, 4) }).map((_, i) => (
        <div key={i} className="aspect-square animate-pulse bg-muted rounded-sm" />
      ))}
    </div>
  )
}
```

**Паттерн `LazyMediaWrapper` (уже существует в `src/components/media/LazyMediaWrapper.tsx`):**
```tsx
// Используй LazyMediaWrapper для каждого элемента галереи.
// Priority=true только для первых 2 элементов (LCP оптимизация, паттерн из FeedContainer)
<LazyMediaWrapper
  src={media.url}
  alt={`Слика ${index + 1}`}
  type={media.media_type === 'video' ? 'video' : 'image'}
  aspectRatio="square"   // все элементы галереи — квадратные (aspect-ratio: 1/1)
  priority={index < 2}
/>
```

**Паттерн маппера из `types.ts` (`dbPostToCardData`):**
```tsx
// Существующий маппер в types.ts возвращает PostCardData.
// PostCardData не содержит media: PostMedia[] — нужно добавить:
export interface PostCardData {
  // ... существующие поля ...
  media?: PostMedia[]   // ← ДОБАВИТЬ
}

// В dbPostToCardData:
return {
  // ... существующие поля ...
  media: post.post_media ?? [],   // ← ДОБАВИТЬ
}
```

> ⚠️ **Важно**: в текущей схеме поле называется `post_media` (snake_case, паттерн Supabase JOIN). После выполнения Story 2.1 в типах будет `post_media: PostMedia[]`. Проверь актуальное имя поля в `PostRow` после выполнения миграции.

### 📐 Алгоритм макета галереи (FR16.1)

```tsx
// Строгая логика из epics.md#FR16.1 — не отклоняться!
type GalleryLayout = 'grid-2' | 'grid-2x3' | 'grid-3x3' | 'grid-2x2-carousel'

function getGridLayout(count: number): {
  layout: GalleryLayout
  mainCount: number    // количество элементов в основной сетке
  carouselCount: number // количество элементов в карусели (для 7-10)
} {
  if (count <= 4) return { layout: 'grid-2', mainCount: count, carouselCount: 0 }
  if (count === 5) return { layout: 'grid-2x3', mainCount: 5, carouselCount: 0 }
  if (count === 6) return { layout: 'grid-3x3', mainCount: 6, carouselCount: 0 }
  // 7-10: первые 4 — сетка 2×2, остальные — карусель
  return { layout: 'grid-2x2-carousel', mainCount: 4, carouselCount: count - 4 }
}
```

**Tailwind CSS-классы для сеток:**

| Layout | Tailwind | Описание |
|--------|----------|----------|
| `grid-2` (2 элемента) | `grid grid-cols-2 gap-1` | 2 ячейки в ряд |
| `grid-2` (3 элемента) | `grid grid-cols-2 gap-1` | 2+1, последний растянуть |
| `grid-2` (4 элемента) | `grid grid-cols-2 gap-1` | 2×2 квадратная |
| `grid-2x3` (5 элементов) | `grid grid-cols-2 gap-1` | 5 ячеек в 2 колонки |
| `grid-3x3` (6 элементов) | `grid grid-cols-3 gap-1` | 6 ячеек в 3 колонки |
| `grid-2x2-carousel` | основа: `grid grid-cols-2 gap-1` + карусель ниже | 4 + overflow карусель |

**Карусель для 7–10 элементов:**
```tsx
// overflow-x-auto с flex — нативный горизонтальный скролл без доп. библиотек
<div className="flex overflow-x-auto gap-1 snap-x snap-mandatory">
  {carouselItems.map((media, i) => (
    <div key={media.id} className="flex-none w-32 snap-start">
      <LazyMediaWrapper src={media.url} aspectRatio="1/1" ... />
    </div>
  ))}
</div>
```

### 🔗 Зависимости от Story 2.1

Story 2.4 **зависит** от Story 2.1 (создание `post_media` таблицы и TypeScript типов). Если Story 2.1 НЕ завершена:

1. API-запросы постов **не возвращают** `post_media` — `GalleryGrid` не получит данных
2. Решение: временно добавить mock-данные `media` для тестирования компонента
3. Обновить API-запрос в `src/features/feed/api/posts.ts` — добавить JOIN `post_media`:

```typescript
// Обновить SELECT в fetchPosts и fetchPostById:
const { data } = await supabase
  .from('posts')
  .select(`
    *,
    profiles!author_id(display_name, avatar_url),
    post_media(id, media_type, url, thumbnail_url, order_index, is_cover)
  `)
  .order('created_at', { ascending: false })
```

> **Supabase JOIN**: имя `post_media(...)` в select автоматически добавляет поле `post_media: PostMedia[]` в результат. RLS на `post_media` применяется автоматически.

### 📦 Обратная совместимость

Существующие посты используют `image_url` из таблицы `posts` (deprecated после Story 2.1), а не `post_media`. Необходимо:

```tsx
// В PostCard и PostDetail: логика выбора источника медиа
const mediaItems = post.media?.length >= 2
  ? post.media  // новая нормализованная схема
  : null        // один медиафайл или нет медиа вообще

// Для одиночного медиа — существующая логика:
const singleMediaUrl = post.media?.[0]?.url ?? post.imageUrl  // deprecated fallback
```

### 🎨 UX / Accessibility требования

- **Минимальный размер tap-area**: 44×44px (из architecture.md) — каждый элемент галереи кликабелен
- **Alt-атрибуты**: каждое `<LazyMediaWrapper>` должно иметь `alt` (NFR16)
- **Keyboard navigation**: элементы галереи должны быть tab-accessible (WCAG 2.1 AA)
- **Для <video>**: `aria-label="Videoposnetek"` или аналогичный

### 🧪 Паттерн тестирования

Используй паттерн из `tests/unit/components/media/LazyMediaWrapper.test.tsx` и `tests/unit/components/feed/PostCard.test.tsx`:

```tsx
// GalleryGrid.test.tsx
import { render, screen } from '@testing-library/react'
import { GalleryGrid } from '@/components/feed/GalleryGrid'
import type { PostMedia } from '@/features/feed/types'

function makeMedia(count: number): PostMedia[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `media-${i}`,
    post_id: 'post-1',
    media_type: 'image' as const,
    url: `https://example.com/image-${i}.jpg`,
    thumbnail_url: null,
    order_index: i,
    is_cover: i === 0,
  }))
}

// Мок LazyMediaWrapper для изоляции
vi.mock('@/components/media/LazyMediaWrapper', () => ({
  LazyMediaWrapper: ({ src, alt }: { src: string; alt: string }) =>
    <img src={src} alt={alt} data-testid="lazy-media" />,
}))

describe('GalleryGrid', () => {
  it('рендерит 2 элемента в сетке из 2 колонок', () => {
    render(<GalleryGrid media={makeMedia(2)} isLoading={false} />)
    expect(screen.getAllByTestId('lazy-media')).toHaveLength(2)
    // проверить что контейнер имеет grid-cols-2 класс
  })

  // ...тесты для 3, 4, 5, 6, 7-10 элементов

  it('рендерит Skeleton при isLoading=true', () => {
    render(<GalleryGrid media={makeMedia(4)} isLoading={true} />)
    expect(screen.queryByTestId('lazy-media')).toBeNull()
    // проверить skeleton элементы
  })

  it('сортирует медиа по order_index', () => {
    const shuffled = [
      { ...makeMedia(1)[0], order_index: 2, url: 'url-2' },
      { ...makeMedia(1)[0], order_index: 0, url: 'url-0' },
      { ...makeMedia(1)[0], order_index: 1, url: 'url-1' },
    ]
    render(<GalleryGrid media={shuffled} isLoading={false} />)
    const images = screen.getAllByTestId('lazy-media') as HTMLImageElement[]
    expect(images[0].src).toContain('url-0')
    expect(images[1].src).toContain('url-1')
    expect(images[2].src).toContain('url-2')
  })
})
```

### ⚠️ Ограничения и Gotchas

1. **`GalleryGrid` не управляет видео-воспроизведением** — это задача Story 2.5 (глобальный `videoController`). В данной истории видео просто отображается как статичное превью с иконкой play.

2. **Карусель — нативный `overflow-x-auto`** без `framer-motion`, `swiper` или других библиотек. Это намеренно (минимальный bundle size).

3. **`next/image` с `fill`** требует `position: relative` на родительском контейнере. LazyMediaWrapper уже это делает — не нужно дублировать.

4. **Не удалять `imageUrl`-логику** из `PostCard.tsx` — устаревшие посты (до миграции) могут не иметь `media: PostMedia[]`. Добавить fallback: `post.imageUrl`.

5. **`GalleryGrid` не вызывается** если `media.length < 2`. Для одного медиа — `LazyMediaWrapper` напрямую. Для нуля медиа — текстовый пост.

6. **Текущие тесты (457 тестов) должны пройти** без регрессий. Использовать `vi.mock` для изоляции зависимостей.

### Project Structure Notes

**Создаваемые файлы:**
```
src/components/feed/GalleryGrid.tsx              # ← СОЗДАТЬ
tests/unit/components/feed/GalleryGrid.test.tsx  # ← СОЗДАТЬ
```

**Изменяемые файлы:**
```
src/features/feed/types.ts                       # ← добавить PostMedia, Post.media
src/components/feed/PostCard.tsx                 # ← интеграция GalleryGrid
src/components/feed/PostDetail.tsx               # ← интеграция GalleryGrid
src/features/feed/api/posts.ts                   # ← JOIN post_media в SELECT
src/features/feed/api/serverPosts.ts             # ← JOIN post_media в SELECT
```

### References

- Логика FR16.1 (правила сетки): [Source: _bmad-output/planning-artifacts/epics.md#Story 2.4]
- Architect brief (GalleryGrid): [Source: _bmad-output/implementation-artifacts/quick-spec-briefs/architect-brief-multimedia-posts.md]
- SM brief (Step 2): [Source: _bmad-output/implementation-artifacts/quick-spec-briefs/sm-brief-multimedia-posts.md]
- Паттерн Dumb UI / Smart Container: [Source: _bmad-output/planning-artifacts/architecture.md#Component Patterns]
- LazyMediaWrapper (существующий): [Source: src/components/media/LazyMediaWrapper.tsx]
- PostCardSkeleton (образец skeleton): [Source: src/components/feed/PostCard.tsx]
- PostDetail (место интеграции): [Source: src/components/feed/PostDetail.tsx]
- FeedContainer (паттерн priority): [Source: src/features/feed/components/FeedContainer.tsx#L482]
- Типы PostRow / Post: [Source: src/features/feed/types.ts]
- Нормализованная схема post_media: [Source: _bmad-output/implementation-artifacts/2-1-normalized-post-media-database-schema.md]

## Dev Agent Record

### Agent Model Used

gemini-2.5-pro (SM Bob — create-story workflow)

### Debug Log References

### Completion Notes List

### File List
