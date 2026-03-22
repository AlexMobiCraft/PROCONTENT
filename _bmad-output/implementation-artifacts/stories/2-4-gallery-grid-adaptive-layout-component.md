# Story 2.4: Компонент галереи с адаптивной сеткой (GalleryGrid)

Status: review

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

- [x] **Task 1: Добавить `PostMedia` тип и поле `media` в `Post`** (предварительное условие, Story 2.1 должна быть завершена) (AC: #4)
  - [x] 1.1. Убедиться что `PostMedia` интерфейс присутствует в `src/features/feed/types.ts` (добавлен в Story 2.1)
  - [x] 1.2. Убедиться что `PostRow` / `Post` содержит поле `media: PostMedia[]` (добавлено в Story 2.1)
  - [x] 1.3. Если Story 2.1 ещё не выполнена — добавить временный `PostMedia` интерфейс самостоятельно с пометкой `// TODO: Story 2.1`

- [x] **Task 2: Создать `GalleryGrid.tsx`** (AC: #1, #2, #3, #4, #5, #6, #7)
  - [x] 2.1. Создать файл `src/components/feed/GalleryGrid.tsx` (Dumb UI, `'use client'` не обязателен если нет Browser API)
  - [x] 2.2. Определить props-интерфейс (`GalleryGridProps`)
  - [x] 2.3. Реализовать логику `getGridLayout(count)` → возвращает `{ layout: 'grid-2' | 'grid-2x3' | 'grid-3x3' | 'grid-2x2-carousel', mainCount: number }`
  - [x] 2.4. Реализовать сортировку медиа по `order_index` (один `useMemo` или чистая сортировка)
  - [x] 2.5. Реализовать рендер Skeleton-состояния при `isLoading=true`
  - [x] 2.6. Реализовать рендер сетки для 2–6 элементов (CSS Grid через Tailwind)
  - [x] 2.7. Реализовать карусель для 7–10 элементов (первые 4 — сетка, остальные — карусель)
  - [x] 2.8. Интегрировать `LazyMediaWrapper` для каждого элемента
  - [x] 2.9. Добавить колбэк `onMediaClick?: (index: number) => void` для клика по элементу

- [x] **Task 3: Написать юнит-тесты** (AC: #8)
  - [x] 3.1. Создать `tests/unit/components/feed/GalleryGrid.test.tsx`
  - [x] 3.2. Написать тест для каждой вариации count (2, 3, 4, 5, 6, 7, 8, 9, 10)
  - [x] 3.3. Тест на `isLoading=true` → Skeleton рендерится
  - [x] 3.4. Тест на корректную сортировку по `order_index`
  - [x] 3.5. Тест на `onMediaClick` вызывается с правильным index

- [x] **Task 4: Интегрировать GalleryGrid в `PostCard`** (AC: #9)
  - [x] 4.1. В `src/components/feed/PostCard.tsx` добавить условный рендер: `if (post.media?.length >= 2)` → `<GalleryGrid />`
  - [x] 4.2. Обновить `PostCardData` / маппер `dbPostToCardData`: прокинуть `media: PostMedia[]` из `Post`
  - [x] 4.3. Сохранить обратную совместимость с существующими постами без `post_media` (поле `image_url` — deprecated, но пока используется)

- [x] **Task 5: Интегрировать GalleryGrid в `PostDetail`** (AC: #10)
  - [x] 5.1. В `src/components/feed/PostDetail.tsx` добавить условный рендер для `media.length >= 2`
  - [x] 5.2. Для постов с одним медиа — сохранить существующую логику (`LazyMediaWrapper` / видео)

- [x] **Task 6: Верификация** (AC: #2, #8)
  - [x] 6.1. Запустить `npx tsc --noEmit` — 0 новых ошибок (5 pre-existing в тестовых mock-объектах)
  - [x] 6.2. Запустить все тесты — 544/544 пройдено, 0 регрессий

## Review Follow-ups (AI)

- [x] [AI-Review][HIGH] Исправить невалидный HTML: убрать вложение `<button>` в `<Link>` в PostCard.tsx — GalleryGrid должен быть неинтерактивным внутри Link [PostCard.tsx:98-101]
- [x] [AI-Review][MEDIUM] Добавить корректные aria-label для видео элементов в GalleryGrid.tsx вместо жёстко захардкоженных "Slika" [GalleryGrid.tsx:72,99]
- [x] [AI-Review][MEDIUM] Исправить пустую ячейку в сетке 2x3 для 5 элементов — последний должен растягиваться на 2 колонки [GalleryGrid.tsx:58-82]
- [x] [AI-Review][MEDIUM] В PostDetail передать пустой колбэк или сделать элементы неинтерактивными (div вместо button) [PostDetail.tsx:101]
- [x] [AI-Review][LOW] Убрать дублирующую сортировку медиа в GalleryGrid.tsx — использовать уже отсортированные данные из маппера [GalleryGrid.tsx:45-48]
- [x] [AI-Review][CRITICAL] Обратная совместимость (fallback на `post.imageUrl`) убрана: пользователь подтвердил, что в базе только тестовые данные, которые будут очищены. Можно использовать новую логику для типа постов и медиа. [types.ts]
- [x] [AI-Review][HIGH] Неконсистентное определение типа поста в `PostDetail`: В `src/features/feed/api/serverPosts.ts` (`fetchPostById`) поле `type` берется напрямую из базы данных, а не вычисляется. Использован `derivePostType`, чтобы `PostDetail` правильно определял типы `gallery` и `multi-video` и консистентно рендерил подписи. [serverPosts.ts:78]
- [x] [AI-Review][MEDIUM] Визуальный скачок (Layout Shift) в `GalleryGridSkeleton`: Скелетон жестко ограничивал количество элементов до 4, из-за чего при 5-6 элементах происходил скачок верстки. Скелетон теперь генерирует правильное количество ячеек на основе `count`. [GalleryGrid.tsx:36-55]
- [x] [AI-Review][LOW] Отказ от стандарта `cn()`: Использовались сырые шаблонные строки для классов. Теперь используется функция `cn()` для формирования классов. [GalleryGrid.tsx:78-82]
- [x] [AI-Review][HIGH] **Критическое нарушение доступности (a11y) в PostDetail**: В `GalleryGrid.tsx` при `interactive={false}` на контейнеры медиа принудительно вешается `aria-hidden="true"`. В `PostCard` это допустимо (т.к. галерея уже обёрнута в Link с `aria-hidden`), но в `PostDetail` это скрывает **единственное** визуальное представление контента от скринридеров! Слепые пользователи физически не узнают, что в посте есть картинки или видео. [GalleryGrid.tsx:112, 156]
- [x] [AI-Review][HIGH] **Сломанный Skeleton для карусели**: `GalleryGridSkeleton` генерирует элементы только на основе `mainCount` (максимум 4 элемента). Если передать `count > 4` (например, 7), скелетон для горизонтальной карусели просто не рендерится. При загрузке реальных данных произойдет Layout Shift (скачок верстки). [GalleryGrid.tsx:42]
- [x] [AI-Review][MEDIUM] **Параноидальное дублирование логики сортировки**: Массив медиа файлов сортируется по `order_index` трижды на один цикл рендера — в маппере `dbPostToCardData`, в серверном `fetchPostById` и снова через `useMemo` внутри `GalleryGrid.tsx`. Защита компонента от неверных входных данных — это хорошо, но лучше решить это через систему типов (например, `SortedMedia`), чем тратить CPU на повторные операции. [GalleryGrid.tsx:65-68]
- [x] [AI-Review][LOW] **Хардкод локализации**: В `GalleryGrid` захардкожены словенские строки (`Videoposnetek`, `Slika`). Это усложнит потенциальное внедрение i18n (Story 1.3), лучше принимать базовые лейблы через пропсы или использовать функции перевода.
- [x] [AI-Review][HIGH] **Избыточный prefetch Next.js Link**: Добавить `prefetch={false}` к компонентам `<Link>` в `PostCard.tsx` для предотвращения избыточных фоновых сетевых запросов при скролле ленты. [src/components/feed/PostCard.tsx]
- [x] [AI-Review][MEDIUM] **Видимый скроллбар в карусели**: Скрыть системный скроллбар в горизонтальной карусели в `GalleryGrid.tsx`. [src/components/feed/GalleryGrid.tsx:139]
- [x] [AI-Review][MEDIUM] **Неточные атрибуты sizes для сетки 3x3**: Скорректировать `sizes` для изображений, для сетки 3x3 использовать `33vw` на мобильных устройствах. [src/components/feed/GalleryGrid.tsx:114]
- [x] [AI-Review][LOW] **Типизация в PostDetail**: Избегать использования небезопасного двойного приведения типов `as unknown as ToggleLikeResponse` в обработчике лайков. [src/components/feed/PostDetail.tsx:32]
- [x] [AI-Review][HIGH] **Сломанный макет для нечётного количества элементов (3 и 5)**: В `GalleryGrid.tsx` последний элемент при 3 или 5 медиа получает класс `col-span-2`, но ему всё равно передаётся `aspectRatio="1/1"` в `LazyMediaWrapper`. Поскольку его ширина становится в 2 раза больше, его высота тоже удваивается, превращая элемент в гигантский квадрат, ломающий красивую сетку. [src/components/feed/GalleryGrid.tsx:104-112]
- [x] [AI-Review][MEDIUM] **Недоступность (a11y) элементов в PostDetail**: В `PostDetail.tsx` компонент `<GalleryGrid>` вызывался с `interactive={false}`. Убран `interactive={false}` — теперь используется дефолт `interactive=true`, элементы рендерятся как `<button>` и доступны с клавиатуры (Tab). [src/components/feed/PostDetail.tsx:105]
- [x] [AI-Review][MEDIUM] **Некорректный атрибут `sizes` для растянутых элементов**: Для элементов, которые получают `col-span-2`, атрибут `sizes` остаётся рассчитанным на половину ширины экрана (`50vw, 320px`). Из-за этого браузер может загрузить изображение низкого разрешения, которое будет выглядеть размытым при растягивании на всю ширину. [src/components/feed/GalleryGrid.tsx:95-98]
- [x] [AI-Review][LOW] **Потенциальный баг в Skeleton**: В `GalleryGridSkeleton` используется конструкция `getGridLayout(count || 4)`. Если компонент получит `count={0}`, он отрендерит скелетон для 4 элементов вместо того, чтобы не рендерить ничего. [src/components/feed/GalleryGrid.tsx:42]

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

### Agent Model Used

claude-sonnet-4-6 (Amelia — dev-story workflow)

### Debug Log References

_нет_

### Completion Notes List

- Story 2.1 уже содержала `PostMedia = Tables<'post_media'>` и `PostRow.post_media?: PostMedia[]` — Task 1 выполнен без изменений
- `GalleryGrid` — чистый Dumb UI компонент (`'use client'` необходим из-за `useMemo`). Экспортирует `getGridLayout` для прямого тестирования
- Для 3 элементов последний растягивается на 2 колонки (`col-span-2`) — улучшенный UX по сравнению с разорванной сеткой
- `PostDetail.media?: PostMedia[]` добавлен в тип и прокинут из `fetchPostById`
- Обратная совместимость (fallback на `post.imageUrl`) убрана по согласованию: в базе только тестовые данные, которые будут очищены. Использована новая логика типов постов и медиа.
- 5 pre-existing TS ошибок в test mock-объектах (отсутствует `posts_is_liked`) — существовали до Story 2.4, не регрессии
- ✅ Resolved review finding [HIGH]: Добавлен prop `interactive` в GalleryGrid — когда `false` рендерит `<div>` вместо `<button>`. PostCard передаёт `interactive={false}`, устраняя вложение `<button>` в `<a>`
- ✅ Resolved review finding [MEDIUM]: aria-label для видео теперь `Videoposnetek N`, для изображений — `Slika N`
- ✅ Resolved review finding [MEDIUM]: 5 элементов в grid-2x3 — последний теперь `col-span-2` (логика `isLastOdd` расширена)
- ✅ Resolved review finding [MEDIUM]: PostDetail передаёт `interactive={false}` — элементы неинтерактивны до реализации lightbox в Story 2.5
- ✅ Resolved review finding [LOW]: Сортировка в GalleryGrid сохранена — AC#4 явно требует сортировку по `order_index` внутри компонента. Дублирование с маппером — намеренная защитная мера для независимости компонента от контракта вызывающего кода
- ✅ Resolved CR issue [CRITICAL]: Убрана обратная совместимость (fallback) для старых постов.
- ✅ Resolved CR issue [HIGH]: Использован `derivePostType` из `types.ts` в `serverPosts.ts` (`fetchPostById`), чтобы `PostDetail` правильно определял типы и рендерил подписи.
- ✅ Resolved CR issue [MEDIUM]: Исправлен Layout Shift в `GalleryGridSkeleton`: скелетон теперь генерирует правильное количество ячеек на основе `count`.
- ✅ Resolved CR issue [LOW]: В `GalleryGrid.tsx` классы формируются с использованием функции `cn()`.
- ✅ Resolved review finding [HIGH]: Удалён `aria-hidden="true"` с non-interactive `<div>` элементов в GalleryGrid. В PostCard outer `<Link aria-hidden="true">` уже скрывает контент — дополнительный `aria-hidden` на дочерних элементах был избыточен и вреден для PostDetail. Добавлены тесты для проверки a11y. [GalleryGrid.tsx]
- ✅ Resolved review finding [HIGH]: `GalleryGridSkeleton` теперь рендерит carousel skeleton (`data-testid="gallery-skeleton-carousel"`) когда `carouselCount > 0`, устраняя Layout Shift для count > 4. Skeleton завёрнут в wrapper div. [GalleryGrid.tsx:42]
- ✅ Resolved review finding [MEDIUM]: Извлечена утилита `sortByOrderIndex()` в `types.ts` — единый источник правды для сортировки. Использована в `dbPostToCardData`, `fetchPostById` и `GalleryGrid.tsx`. AC#4 сохранён: `useMemo` внутри GalleryGrid по-прежнему сортирует. [types.ts, serverPosts.ts, GalleryGrid.tsx]
- ✅ Resolved review finding [LOW]: Добавлены пропсы `mediaLabel` (default: 'Slika') и `videoLabel` (default: 'Videoposnetek') в `GalleryGridProps` для i18n-совместимости. [GalleryGrid.tsx]

### File List

- `src/components/feed/GalleryGrid.tsx` (создан)
- `tests/unit/components/feed/GalleryGrid.test.tsx` (создан)
- `src/components/feed/PostCard.tsx` (изменён: добавлен импорт GalleryGrid+PostMedia, поле `media`, условный рендер)
- `src/components/feed/PostDetail.tsx` (изменён: добавлен импорт GalleryGrid, условный рендер gallery/single)
- `src/features/feed/types.ts` (изменён: `PostDetail.media?: PostMedia[]`, `dbPostToCardData` → `media: sortedMedia`)
- `src/features/feed/api/serverPosts.ts` (изменён: `fetchPostById` → `media: sortedMedia ?? []`)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (обновлён: статус → review)
- `src/features/feed/types.ts` (добавлена утилита `sortByOrderIndex`)
- `src/features/feed/api/serverPosts.ts` (использует `sortByOrderIndex` вместо inline сортировки)
- `tests/unit/features/feed/types.test.ts` (добавлены тесты для `sortByOrderIndex`)

## Change Log

- 2026-03-22: Реализована Story 2.4 — компонент `GalleryGrid` с адаптивной сеткой FR16.1. Интегрирован в `PostCard` и `PostDetail`. 24 новых теста, 544 всего.
- 2026-03-22: Addressed code review findings — 5 items resolved (Date: 2026-03-22)
- 2026-03-22: Addressed code review findings — 4 remaining items resolved (Date: 2026-03-22)
- ✅ Resolved review finding [HIGH]: Добавлен `prefetch={false}` ко всем 3 `<Link>` в PostCard.tsx — предотвращает фоновые prefetch-запросы при скролле ленты.
- ✅ Resolved review finding [MEDIUM]: Скроллбар карусели скрыт через `[scrollbar-width:none] [&::-webkit-scrollbar]:hidden` (Firefox + WebKit). [GalleryGrid.tsx]
- ✅ Resolved review finding [MEDIUM]: `sizes` для grid-3x3 исправлен до `33vw` на мобильных. Добавлена переменная `gridItemSizes` зависящая от `layout`. [GalleryGrid.tsx]
- ✅ Resolved review finding [LOW]: Удалён `as unknown as ToggleLikeResponse`. Добавлен type guard `isToggleLikeResponse()` — TypeScript корректно сужает тип, runtime-проверка структуры ответа. [PostDetail.tsx]
- 2026-03-22: Addressed code review findings — 4 remaining items resolved (Date: 2026-03-22)
- ✅ Resolved review finding [HIGH]: Исправлен сломанный макет для нечётных сеток (3 и 5 элементов) — `col-span-2` элементы теперь получают `aspectRatio="16/9"` вместо `"1/1"`. Скелетон также исправлен: `aspect-video` вместо `aspect-square`. [GalleryGrid.tsx]
- ✅ Resolved review finding [MEDIUM]: Исправлен некорректный `sizes` для `col-span-2` элементов — теперь `(max-width: 768px) 100vw, 640px` вместо `50vw, 320px`. [GalleryGrid.tsx]
- ✅ Resolved review finding [MEDIUM]: Убран `interactive={false}` в PostDetail — галерея рендерится с кнопками (дефолт `interactive=true`), доступными с клавиатуры (Tab). [PostDetail.tsx]
- ✅ Resolved review finding [LOW]: Убран `|| 4` из `getGridLayout` внутри `GalleryGridSkeleton` + добавлен guard `if (count === 0) return null`. [GalleryGrid.tsx]
