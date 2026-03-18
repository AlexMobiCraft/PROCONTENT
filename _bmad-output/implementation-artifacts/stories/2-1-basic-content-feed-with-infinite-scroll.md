# Story 2.1: Базовая лента контента с бесконечным скроллом (Infinite Scroll)

Status: review

## Story

As a авторизованная участница,
I want просматривать ленту постов в хронологическом порядке с автоматической подгрузкой,
so that быть в курсе новых материалов клуба без ручной пагинации.

## Acceptance Criteria

1. **Given** авторизованная участница на `/feed` **When** страница загружается **Then** отображаются первые 10 постов в обратном хронологическом порядке (новые сверху)
2. **Given** загруженная лента **When** участница скроллит вниз и достигает конца списка **Then** автоматически подгружаются следующие 10 постов (infinite scroll)
3. **Given** загрузка данных в процессе **When** участница ожидает **Then** отображаются `PostCardSkeleton` плейсхолдеры
4. **Given** все посты загружены **When** участница доскролливает до конца **Then** подгрузка прекращается, отображается сообщение "Вы просмотрели все публикации"
5. **Given** лента пуста (нет постов в БД) **When** страница загружается **Then** отображается empty state "Скоро здесь появится контент"
6. **Given** загруженные посты **When** участница уходит со страницы и возвращается **Then** лента восстанавливается из кэша Zustand мгновенно
7. **Given** таблица `posts` в БД **When** выполняется запрос **Then** данные защищены RLS-политиками (только авторизованные пользователи с активной подпиской читают посты)

## Tasks / Subtasks

- [x] **Task 1: Миграция БД — таблица `posts`** (AC: #1, #7)
  - [x] 1.1 Создать `supabase/migrations/007_create_posts_table.sql`
  - [x] 1.2 Создать таблицу `posts` со всеми полями (см. Dev Notes — Схема БД)
  - [x] 1.3 Добавить RLS-политики (SELECT для authenticated, INSERT/UPDATE/DELETE для admin)
  - [x] 1.4 Создать индексы для пагинации (`created_at DESC`) и фильтрации (`category`)
  - [x] 1.5 Добавить seed-данные (10-15 тестовых постов) в отдельный seed-файл

- [x] **Task 2: Обновить TypeScript-типы Supabase** (AC: #1)
  - [x] 2.1 Добавить таблицу `posts` в `src/types/supabase.ts` (Row, Insert, Update)
  - [x] 2.2 Создать вспомогательный тип `Post` для клиентского использования

- [x] **Task 3: Создать Zustand feed store** (AC: #6)
  - [x] 3.1 Создать `src/features/feed/store.ts` с состоянием ленты
  - [x] 3.2 Реализовать actions: `fetchPosts`, `fetchNextPage`, `reset`
  - [x] 3.3 Реализовать cursor-based пагинацию через `created_at`

- [x] **Task 4: Создать API-слой для ленты** (AC: #1, #2)
  - [x] 4.1 Создать `src/features/feed/api/posts.ts`
  - [x] 4.2 Реализовать `fetchPosts(cursor?, limit?)` через Supabase client
  - [x] 4.3 Возвращать `{ posts, nextCursor, hasMore }`

- [x] **Task 5: Реализовать Smart Container FeedContainer** (AC: #1, #2, #3, #5, #6)
  - [x] 5.1 Создать `src/features/feed/components/FeedContainer.tsx` (`'use client'`)
  - [x] 5.2 Подключить к Zustand feed store
  - [x] 5.3 Рендерить `PostCard` для каждого поста, `PostCardSkeleton` при загрузке
  - [x] 5.4 Реализовать empty state при отсутствии постов
  - [x] 5.5 Добавить IntersectionObserver для trigger "load more"

- [x] **Task 6: Обновить страницу `/feed`** (AC: #1, #2, #3)
  - [x] 6.1 Заменить placeholder в `src/app/(app)/feed/page.tsx`
  - [x] 6.2 Добавить `CategoryScroll` (sticky сверху) + `FeedContainer`
  - [x] 6.3 Добавить `MobileNav` в `(app)/layout.tsx` если ещё не подключён

- [x] **Task 7: Маппинг данных PostCard** (AC: #1)
  - [x] 7.1 Создать mapper `dbPostToCardData(post: Tables<'posts'>): PostCardData`
  - [x] 7.2 Маппить `author_id` → имя автора (join с `profiles` или хранить в `posts`)

### Review Follow-ups (AI)

- [x] [AI-Review][CRITICAL] Сброс категории сломан: `handleCategoryChange` в `page.tsx` вызывает `reset()`, что мгновенно возвращает `activeCategory` обратно в `'all'`. [src/app/(app)/feed/page.tsx:14]
- [x] [AI-Review][CRITICAL] Блокировка повторной загрузки: защита `initialLoadDone.current` в `FeedContainer.tsx` навсегда блокирует подгрузку при смене категории. [src/features/feed/components/FeedContainer.tsx:27]
- [x] [AI-Review][MEDIUM] Производительность Intersection Observer: `useEffect` в `FeedContainer.tsx` постоянно делает `disconnect`/`observe` при каждом изменении `isLoadingMore`. [src/features/feed/components/FeedContainer.tsx:68]
- [x] [AI-Review][MEDIUM] Незакоммиченные изменения: файл `supabase/seed_posts.sql` изменен, но не закоммичен. [supabase/seed_posts.sql]
- [x] [AI-Review][LOW] Edge-case с пагинацией: использование только `created_at` может пропустить посты с идентичными таймстампами. Стоит рассмотреть составной ключ сортировки `created_at, id`.

## Dev Notes

### Схема БД — таблица `posts`

```sql
CREATE TABLE public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  excerpt TEXT,
  content TEXT,
  category TEXT NOT NULL DEFAULT 'insight',
  type TEXT NOT NULL DEFAULT 'text' CHECK (type IN ('text', 'photo', 'video')),
  image_url TEXT,
  likes_count INTEGER NOT NULL DEFAULT 0,
  comments_count INTEGER NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT true,
  is_landing_preview BOOLEAN NOT NULL DEFAULT false,
  is_onboarding BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Индексы
CREATE INDEX idx_posts_created_at ON public.posts(created_at DESC);
CREATE INDEX idx_posts_category ON public.posts(category);
CREATE INDEX idx_posts_published ON public.posts(is_published) WHERE is_published = true;

-- RLS
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- Чтение: авторизованные пользователи
CREATE POLICY "Posts are viewable by authenticated users"
  ON public.posts FOR SELECT
  TO authenticated
  USING (is_published = true);

-- Полный доступ: только автор (admin)
CREATE POLICY "Admin can manage all posts"
  ON public.posts FOR ALL
  TO authenticated
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());
```

**Важно:** Поля `likes_count` и `comments_count` — денормализованные счётчики. Будут обновляться через RPC или triggers в будущих stories. Сейчас они статичны.

### Cursor-based пагинация

Используй cursor по `created_at` (НЕ offset-based):

```typescript
// src/features/feed/api/posts.ts
const PAGE_SIZE = 10

export async function fetchPosts(cursor?: string) {
  const supabase = createClient()

  let query = supabase
    .from('posts')
    .select('*, profiles!author_id(display_name, avatar_url)')
    .eq('is_published', true)
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE + 1) // +1 для определения hasMore

  if (cursor) {
    query = query.lt('created_at', cursor)
  }

  const { data, error } = await query
  if (error) throw error

  const hasMore = data.length > PAGE_SIZE
  const posts = hasMore ? data.slice(0, PAGE_SIZE) : data
  const nextCursor = posts.length > 0
    ? posts[posts.length - 1].created_at
    : null

  return { posts, nextCursor, hasMore }
}
```

### Zustand Feed Store

```typescript
// src/features/feed/store.ts
interface FeedState {
  posts: Post[]
  cursor: string | null
  hasMore: boolean
  isLoading: boolean
  isLoadingMore: boolean
  activeCategory: string
  setPosts: (posts: Post[], cursor: string | null, hasMore: boolean) => void
  appendPosts: (posts: Post[], cursor: string | null, hasMore: boolean) => void
  setActiveCategory: (category: string) => void
  setLoading: (loading: boolean) => void
  setLoadingMore: (loading: boolean) => void
  reset: () => void
}
```

### IntersectionObserver для infinite scroll

```typescript
// Внутри FeedContainer
const observerRef = useRef<HTMLDivElement>(null)

useEffect(() => {
  if (!observerRef.current || !hasMore || isLoadingMore) return

  const observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) {
        loadMore()
      }
    },
    { rootMargin: '200px' } // Начинать подгрузку заранее
  )

  observer.observe(observerRef.current)
  return () => observer.disconnect()
}, [hasMore, isLoadingMore])

// В JSX: <div ref={observerRef} /> после списка постов
```

### Структура файлов (итоговая)

```
src/features/feed/
  api/
    posts.ts              # fetchPosts(cursor?, category?)
  components/
    FeedContainer.tsx     # Smart container: store + API + rendering
  store.ts                # Zustand feed state
  types.ts                # Post type alias, FeedState

src/components/feed/
  PostCard.tsx            # ✅ УЖЕ СУЩЕСТВУЕТ — НЕ ТРОГАТЬ
  CategoryScroll.tsx      # ✅ УЖЕ СУЩЕСТВУЕТ — НЕ ТРОГАТЬ
```

### Project Structure Notes

- **Feature-based архитектура:** Вся бизнес-логика ленты живёт в `src/features/feed/`. Dumb UI компоненты (`PostCard`, `CategoryScroll`) остаются в `src/components/feed/`.
- **Smart/Dumb разделение:** `FeedContainer` (smart) подписывается на Zustand store и вызывает API. `PostCard` (dumb) получает только props.
- **Supabase client:** Для клиентских запросов — `src/lib/supabase/client.ts` (НЕ `server.ts`). Это SPA-зона.
- **Именование:** Поля БД в `snake_case`. В TypeScript типах — также `snake_case` (из auto-generated types).
- **Миграции:** Следующий номер — `007`. Файл: `supabase/migrations/007_create_posts_table.sql`.

### Критические ограничения

- **НЕ ИСПОЛЬЗОВАТЬ** offset-based пагинацию (`range()`). Только cursor через `created_at`.
- **НЕ СОЗДАВАТЬ** новые UI-компоненты в `src/components/feed/`. `PostCard` и `CategoryScroll` уже готовы.
- **НЕ ИМПОРТИРОВАТЬ** Zustand или Supabase внутри `PostCard` / `CategoryScroll`. Они dumb.
- **НЕ МЕНЯТЬ** `(app)/layout.tsx` auth-логику. Только добавить `MobileNav` если отсутствует.
- **НЕ ИСПОЛЬЗОВАТЬ** `useEffect` для начальной загрузки данных в Server Component. `feed/page.tsx` может быть client component — это SPA-зона.
- **Фильтрация по категориям** — только UI-состояние в этой story. Серверная фильтрация будет в Story 2.4.

### Паттерны из Epic 1 (наследование)

- **Auth store:** `src/features/auth/store.ts` — паттерн Zustand store с `create<State>()`. Следуй этому же паттерну для feed store.
- **Supabase client:** `createClient()` из `@/lib/supabase/client.ts` — singleton browser client.
- **Tailwind стиль:** Editorial outline кнопки, `font-heading` для заголовков, `text-muted-foreground` для вторичного текста.
- **Touch targets:** Все интерактивные элементы — `min-h-[44px] min-w-[44px]`.
- **Шрифты:** `font-heading` = Cormorant Garamond (заголовки), `font-sans` = Barlow Condensed (UI).

### Existing Components API Reference

**PostCard** (`src/components/feed/PostCard.tsx`):
```typescript
interface PostCardData {
  id: string
  category: string
  title: string
  excerpt: string
  date: string           // Форматированная дата, например "15 марта"
  likes: number
  comments: number
  author: {
    name: string
    initials: string
    isAuthor?: boolean   // Показывает бейдж "Автор"
  }
  imageUrl?: string
  type: 'text' | 'photo' | 'video'
}
// Props: { post: PostCardData, onCommentClick?: (postId: string) => void }
```

**PostCardSkeleton** — без props, рендерит pulse-анимацию.

**CategoryScroll** (`src/components/feed/CategoryScroll.tsx`):
```typescript
// Props: { activeCategory: string, onCategoryChange: (id: string) => void }
// Категории: 'all' | 'insight' | 'razobory' | 'syomka' | 'reels' | 'brendy' | 'tema'
```

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 2, Story 2.1]
- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation Patterns]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Component Strategy, PostCard]
- [Source: src/components/feed/PostCard.tsx — existing PostCardData interface]
- [Source: src/components/feed/CategoryScroll.tsx — existing categories array]
- [Source: src/features/auth/store.ts — Zustand store pattern]
- [Source: src/lib/supabase/client.ts — browser client pattern]
- [Source: src/types/supabase.ts — Database type pattern]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- TypeScript ошибка: `posts.author_id` Relationship указывал на `auth.users`, а не `public.profiles`. Исправлено в `src/types/supabase.ts` — referencedRelation изменён на `profiles`.
- Pre-existing ESLint errors в `auth-middleware.ts` (TS2352) и `server-actions.ts` (unused vars) — не относятся к этой story.

### Completion Notes List

- **Тесты:** Тест-раннер не сконфигурирован в проекте (`CLAUDE.md`: "No test runner is configured yet"). Тесты написаны быть не могут.
- **Task 1:** Миграция `007_create_posts_table.sql` создана с RLS-политиками и индексами. Seed-данные в `supabase/seed_posts.sql` (13 постов, запускается через DO-блок динамически).
- **Task 2 + 7:** Типы в `src/types/supabase.ts` добавлены (Row/Insert/Update). `src/features/feed/types.ts` содержит `Post`, `FeedPage`, `PostRow`, и mapper `dbPostToCardData`.
- **Task 3:** Zustand store паттерн скопирован с `src/features/auth/store.ts`. Store сохраняет посты при навигации (AC #6 — кэш в памяти).
- **Task 4:** `fetchPosts()` использует cursor-based пагинацию по `created_at` с join `profiles!author_id`. PAGE_SIZE = 10 + 1 для определения `hasMore`.
- **Task 5:** `FeedContainer` — smart component с `useRef` для initial load guard (предотвращает повторный запрос при Strict Mode). IntersectionObserver с `rootMargin: '200px'`.
- **Task 6:** `feed/page.tsx` полностью переписан: sticky `CategoryScroll` + `FeedContainer`. `(app)/layout.tsx` — добавлен `MobileNav`.
- **Категориальная фильтрация:** Только UI-состояние (смена категории — reset store), серверная фильтрация — в Story 2.4.
- ✅ Resolved review finding [CRITICAL]: Сброс категории — добавлен `changeCategory()` action в store, атомарно сбрасывает данные и устанавливает категорию. `page.tsx` использует `changeCategory` вместо двойного вызова.
- ✅ Resolved review finding [CRITICAL]: Блокировка загрузки — удалён `initialLoadDone.current`, initial load effect подписан на `[activeCategory]`, перезагружает при смене категории.
- ✅ Resolved review finding [MEDIUM]: IntersectionObserver — `loadMore` читает живое состояние через `useFeedStore.getState()`, нет stale closure, deps observer = `[hasMore]` — пересоздаётся только при конце ленты.
- ✅ Resolved review finding [MEDIUM]: `supabase/seed_posts.sql` — файл оказался уже зафиксирован в git, рабочее дерево чистое.
- ✅ Resolved review finding [LOW]: Составной курсор `created_at|id` + `.order('id', { ascending: false })` — стабильная пагинация при постах с одинаковым timestamp.

### File List

- `supabase/migrations/007_create_posts_table.sql` (новый)
- `supabase/seed_posts.sql` (новый)
- `src/types/supabase.ts` (изменён — добавлена таблица posts)
- `src/features/feed/types.ts` (новый)
- `src/features/feed/store.ts` (изменён — добавлен `changeCategory` action)
- `src/features/feed/api/posts.ts` (изменён — составной курсор `created_at|id`, tiebreaker `.order('id')`)
- `src/features/feed/components/FeedContainer.tsx` (изменён — убран `initialLoadDone`, `loadMore` через `getState()`, deps observer = `[hasMore]`)
- `src/app/(app)/feed/page.tsx` (изменён — `changeCategory` вместо `setActiveCategory`+`reset`)
- `src/app/(app)/layout.tsx` (изменён — добавлен MobileNav)

## Change Log

- Первичная реализация: Tasks 1–7 выполнены (Date: 2026-03-18)
- Addressed code review findings — 5 items resolved (Date: 2026-03-18)
