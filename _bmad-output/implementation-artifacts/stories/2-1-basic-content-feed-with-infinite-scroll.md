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
- [x] [AI-Review][CRITICAL] Запрос постов упадет на клиенте (Runtime Error): отсутствует прямая связь (FK) между `posts` и `profiles` в БД для автоматического join. [src/features/feed/api/posts.ts, supabase/migrations/007_create_posts_table.sql]
- [x] [AI-Review][CRITICAL] Нарушение AC #7 (Access Control): отсутствует проверка активной подписки пользователя в RLS политиках. [supabase/migrations/007_create_posts_table.sql:31]
- [x] [AI-Review][MEDIUM] Мерцание Empty State (Флеш контента): `isLoading` изначально `false`, что вызывает ложный показ Empty State до начала загрузки. [src/features/feed/components/FeedContainer.tsx:103]
- [x] [AI-Review][MEDIUM] Сломанная фильтрация по категориям: смена категории сбрасывает store, но fetch все равно тянет все посты без фильтрации. [src/features/feed/api/posts.ts]
- [x] [AI-Review][CRITICAL] Нарушение правил агента: задачи отмечены как выполненные без наличия тестов. [2-1-basic-content-feed-with-infinite-scroll.md]
- [x] [AI-Review][CRITICAL] Риск бесконечных API-запросов при пустой категории (sentinel остается видимым при Empty State). [src/features/feed/components/FeedContainer.tsx:144]
- [x] [AI-Review][HIGH] Security: Политика "Admin can manage all posts" не проверяет роль администратора, позволяя любому авторизованному пользователю управлять своими постами. [supabase/migrations/007_create_posts_table.sql:37]
- [x] [AI-Review][MEDIUM] Performance: RLS подзапрос в каждой строке для проверки статуса подписки может замедлить выборку. [supabase/migrations/008_fix_posts_fk_and_rls.sql:26]
- [x] [AI-Review][MEDIUM] UI/UX: Дублирование логики скелетонов при isLoading и isLoadingMore может вызывать мерцание контента. [src/features/feed/components/FeedContainer.tsx:134]
- [x] [AI-Review][CRITICAL] Сломанная пагинация при клиентской фильтрации: скрытие sentinel при пустом отображении навсегда останавливает подгрузку остальных постов. [src/features/feed/components/FeedContainer.tsx:144]
- [x] [AI-Review][CRITICAL] Бесконечный цикл и DDoS API: в loadMore сбой fetchPosts() проглатывается, hasMore остаётся true, IntersectionObserver зацикленно спамит запросы. [src/features/feed/components/FeedContainer.tsx:62]
- [x] [AI-Review][MEDIUM] Уязвимость повышения привилегий RLS: SECURITY DEFINER функция is_active_subscriber() не устанавливает search_path. [supabase/migrations/009_add_role_fix_admin_rls.sql:37]
- [x] [AI-Review][MEDIUM] Костыль с eslint-disable-next-line и Stale Closure: необходимо безопасно читать длину кэша через useFeedStore.getState() внутри начального useEffect. [src/features/feed/components/FeedContainer.tsx:48]
- [x] [AI-Review][LOW] DB Performance: Отсутствует составной индекс (created_at DESC, id DESC) WHERE is_published = true. [supabase/migrations/007_create_posts_table.sql]
- [x] [AI-Review][MEDIUM] Пагинация: Если `loadMore` падает по ошибке сети, загрузка блокируется навсегда. Добавить кнопку "Повторить". [src/features/feed/components/FeedContainer.tsx:67]
- [x] [AI-Review][MEDIUM] Эффективность: При фильтрации по редкой категории на клиенте возможны десятки пустых API-вызовов подряд. Оптимизировать в Story 2.4. [src/features/feed/components/FeedContainer.tsx:104]
- [x] [AI-Review][HIGH] Logic Error: `isAuthor: true` захардкожен в mapper — каждый пост показывает бейдж "Автор" независимо от текущего пользователя. Передать `currentUserId` в `dbPostToCardData` и сравнивать с `post.author_id`. Тест `types.test.ts:51` закрепляет баг. [src/features/feed/types.ts:48]
- [x] [AI-Review][MEDIUM] UX: Нет UI-состояния ошибки при сбое `loadInitial` — пользователь видит Empty State "Скоро здесь появится контент" вместо сообщения об ошибке с retry-кнопкой. Добавить `error: string | null` в store и рендерить error state в FeedContainer. [src/features/feed/components/FeedContainer.tsx:37]
- [x] [AI-Review][MEDIUM] Race condition: быстрая смена категорий запускает несколько параллельных `loadInitial`. Нет AbortController — последний-пишет-побеждает. Добавить `useRef<AbortController>` и отменять предыдущий запрос при новом. [src/features/feed/components/FeedContainer.tsx:28]
- [x] [AI-Review][MEDIUM] Performance: `layout.tsx` делает два auth round-trip — `getUser()` (сетевой запрос) + `getSession()` (кука). Если user существует, session гарантирована. Рефакторинг: один вызов. [src/app/(app)/layout.tsx:12]
- [x] [AI-Review][MEDIUM] Security: cursor интерполируется в PostgREST `.or()` string без валидации формата. Добавить проверку `cursorAt` на ISO8601 timestamp и `cursorId` на UUID перед интерполяцией. [src/features/feed/api/posts.ts:21]
- [x] [AI-Review][LOW] Edge-case: `display_name = ''` (пустая строка) не перехватывается `??` — проходит как валидное имя, initials будут пустыми. Исправить: `post.profiles?.display_name || 'Автор'`. [src/features/feed/types.ts:24]
- [x] [AI-Review][LOW] Test gap: нет теста для catch-ветки `loadMore` — не верифицируется что `appendPosts([], null, false)` вызывается при ошибке и sentinel исчезает из DOM. [tests/unit/features/feed/components/FeedContainer.test.tsx]
- [x] [AI-Review][LOW] UX: `PostCardSkeleton` всегда рендерит `aspect-video` media placeholder — не соответствует text-картам без медиа. Создаёт layout shift при появлении реального контента. [src/components/feed/PostCard.tsx:198]

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

- **Тесты:** Полный regression suite проходит: `vitest` — 380/380, `npm run typecheck` — OK, `eslint` по изменённым story-файлам — OK. Полный `eslint .` всё ещё падает на pre-existing проблемах вне scope story: `everything-claude-code/**`, `src/lib/supabase/auth-middleware.ts`, `src/features/auth/api/server-actions.ts`.
- **Task 1:** Миграция `007_create_posts_table.sql` создана с RLS-политиками и индексами. Seed-данные в `supabase/seed_posts.sql` (13 постов, запускается через DO-блок динамически).
- **Task 2 + 7:** Типы в `src/types/supabase.ts` добавлены (Row/Insert/Update). `src/features/feed/types.ts` содержит `Post`, `FeedPage`, `PostRow`, и mapper `dbPostToCardData`.
- **Task 3:** Zustand store паттерн скопирован с `src/features/auth/store.ts`. Store сохраняет посты при навигации (AC #6 — кэш в памяти) и теперь хранит `error: string | null` для initial/loadMore retry-сценариев.
- **Task 4:** `fetchPosts()` использует cursor-based пагинацию по `created_at` с join `profiles!author_id`. PAGE_SIZE = 10 + 1 для определения `hasMore`; добавлена валидация курсора (`ISO8601|UUID`) и прокидывание `AbortSignal`.
- **Task 5:** `FeedContainer` — smart component с cancellable initial load через `AbortController`, UI-состоянием ошибки, retry-кнопками для initial/loadMore ошибок и manual CTA `Загрузить ещё` для редкой пустой категории без серии пустых auto-fetch вызовов.
- **Task 6:** `feed/page.tsx` полностью переписан: sticky `CategoryScroll` + `FeedContainer`. `(app)/layout.tsx` использует один auth round-trip через `getUser()` и по-прежнему рендерит `MobileNav`.
- **Категориальная фильтрация:** Только UI-состояние в этой story. Для редкой категории компонент больше не спамит пустыми запросами подряд: показывается manual CTA `Загрузить ещё`. Полная серверная фильтрация остаётся в Story 2.4.
- ✅ Resolved review finding [CRITICAL]: Сброс категории — добавлен `changeCategory()` action в store, атомарно сбрасывает данные и устанавливает категорию. `page.tsx` использует `changeCategory` вместо двойного вызова.
- ✅ Resolved review finding [CRITICAL]: Блокировка загрузки — удалён `initialLoadDone.current`, initial load effect подписан на `[activeCategory]`, перезагружает при смене категории.
- ✅ Resolved review finding [MEDIUM]: IntersectionObserver — `loadMore` читает живое состояние через `useFeedStore.getState()`, нет stale closure, deps observer = `[hasMore]` — пересоздаётся только при конце ленты.
- ✅ Resolved review finding [MEDIUM]: `supabase/seed_posts.sql` — файл оказался уже зафиксирован в git, рабочее дерево чистое.
- ✅ Resolved review finding [LOW]: Составной курсор `created_at|id` + `.order('id', { ascending: false })` — стабильная пагинация при постах с одинаковым timestamp.
- ✅ Resolved review finding [CRITICAL]: FK posts → profiles — создана миграция `008_fix_posts_fk_and_rls.sql`: DROP FK на auth.users, ADD FK на public.profiles(id). Supabase join `profiles!author_id` теперь работает корректно.
- ✅ Resolved review finding [CRITICAL]: RLS subscription check (AC #7) — в той же миграции 008: DROP старой политики "Posts are viewable by authenticated users", CREATE "Posts are viewable by subscribers" с `EXISTS(SELECT 1 FROM profiles WHERE id = auth.uid() AND subscription_status IN ('active', 'trialing'))`.
- ✅ Resolved review finding [MEDIUM]: Empty State flash — `isLoading: true` в `initialState` store.ts. При первом рендере компонент показывает скелетоны, не empty state.
- ✅ Resolved review finding [MEDIUM]: Фильтрация по категориям — `displayedPosts` в FeedContainer.tsx: клиентская фильтрация `posts.filter(p => p.category === activeCategory)`. Серверная фильтрация — Story 2.4.
- ✅ Resolved review finding [CRITICAL]: Тесты — написано 37 тестов (9 mapper, 9 store, 7 API, 8 component, 4 page). Все 363 теста проходят без регрессий.
- ✅ Resolved review finding [CRITICAL]: Бесконечные API-запросы — sentinel (`<div ref={observerRef}>`) теперь рендерится только при `displayedPosts.length > 0`. При пустой категории empty state возвращается раньше, sentinel не создаётся.
- ✅ Resolved review finding [HIGH]: Admin policy — миграция 009: добавлена колонка `role` ('member'|'admin') в profiles. Политика "Admin can manage posts" проверяет `role = 'admin'` через EXISTS.
- ✅ Resolved review finding [MEDIUM]: RLS performance — создана `SECURITY DEFINER STABLE` функция `is_active_subscriber()`, заменяет inline подзапрос в SELECT политике. Кешируется per-statement.
- ✅ Resolved review finding [MEDIUM]: Скелетоны — выделен компонент `Skeletons({ count })`, единая точка рендеринга для начальной загрузки (count=5) и подгрузки (count=3).
- ✅ Resolved review finding [CRITICAL]: Сломанная пагинация при клиентской фильтрации — пустая редкая категория теперь не застревает навсегда: компонент показывает CTA `Загрузить ещё`, а не скрытый sentinel без возможности продолжить. [src/features/feed/components/FeedContainer.tsx]
- ✅ Resolved review finding [CRITICAL]: Бесконечный цикл DDoS API — при ошибке `loadMore` store получает `error`, sentinel убирается из DOM пока ошибка не будет сброшена retry-действием, observer больше не спамит запросами. [src/features/feed/components/FeedContainer.tsx]
- ✅ Resolved review finding [MEDIUM]: Уязвимость SECURITY DEFINER без search_path — функция `is_active_subscriber()` пересоздана с `SET search_path = public` в миграции 010. [supabase/migrations/010_fix_security_definer_and_perf_index.sql]
- ✅ Resolved review finding [MEDIUM]: eslint-disable-next-line и stale closure — `loadInitial` в начальном `useEffect` теперь читает `setLoading`, `setPosts` через `useFeedStore.getState()` в момент вызова. Кэш-проверка `posts.length > 0` тоже через `getState()`. Нет замыканий на React state, нет `eslint-disable` комментария. [src/features/feed/components/FeedContainer.tsx]
- ✅ Resolved review finding [LOW]: Составной индекс — создан `idx_posts_cursor ON posts(created_at DESC, id DESC) WHERE is_published = true` в миграции 010. Покрывает cursor-запросы с tiebreaker по id. [supabase/migrations/010_fix_security_definer_and_perf_index.sql]
- ✅ Resolved review finding [MEDIUM]: `loadMore` больше не блокирует ленту навсегда при network error — добавлены `error` state, retry-кнопка и скрытие sentinel до ручного повтора. [src/features/feed/components/FeedContainer.tsx, tests/unit/features/feed/components/FeedContainer.test.tsx]
- ✅ Resolved review finding [MEDIUM]: Редкая пустая категория больше не генерирует десятки пустых auto-fetch запросов подряд — вместо этого показывается manual CTA `Загрузить ещё`. [src/features/feed/components/FeedContainer.tsx]
- ✅ Resolved review finding [HIGH]: `dbPostToCardData(post, currentUserId)` теперь вычисляет `isAuthor` сравнением `currentUserId === post.author_id`; бейдж "Автор" отображается только владельцу. [src/features/feed/types.ts, tests/unit/features/feed/types.test.ts, tests/unit/features/feed/components/FeedContainer.test.tsx]
- ✅ Resolved review finding [MEDIUM]: Initial load теперь имеет отдельный error state с retry-кнопкой вместо ложного Empty State. [src/features/feed/store.ts, src/features/feed/components/FeedContainer.tsx]
- ✅ Resolved review finding [MEDIUM]: Быстрая смена категорий больше не даёт stale response перезаписать store — предыдущий initial load отменяется через `AbortController`. [src/features/feed/components/FeedContainer.tsx, tests/unit/features/feed/components/FeedContainer.test.tsx]
- ✅ Resolved review finding [MEDIUM]: `layout.tsx` больше не делает лишний `getSession()` round-trip; `AuthProvider` принимает `session: null` в app-layout сценарии. [src/app/(app)/layout.tsx, src/features/auth/components/AuthProvider.tsx, tests/unit/app/(app)/layout.test.tsx]
- ✅ Resolved review finding [MEDIUM]: Cursor валидируется до интерполяции в `.or()` string: `cursorAt` проверяется на ISO8601, `cursorId` — на UUID; API-тесты покрывают invalid input и `AbortSignal`. [src/features/feed/api/posts.ts, tests/unit/features/feed/api/posts.test.ts]
- ✅ Resolved review finding [LOW]: Пустой `display_name` теперь корректно уходит в fallback `Автор`, initials остаются валидными. [src/features/feed/types.ts, tests/unit/features/feed/types.test.ts]
- ✅ Resolved review finding [LOW]: Добавлены regression tests для catch-ветки `loadMore`, скрытия sentinel и retry-сценария. [tests/unit/features/feed/components/FeedContainer.test.tsx]
- ✅ Resolved review finding [LOW]: `PostCardSkeleton` больше не рендерит media placeholder по умолчанию; добавлен optional `showMedia` и unit-тесты. [src/components/feed/PostCard.tsx, tests/unit/components/feed/PostCard.test.tsx]

### File List

- `supabase/migrations/007_create_posts_table.sql` (новый)
- `supabase/migrations/008_fix_posts_fk_and_rls.sql` (новый)
- `supabase/migrations/009_add_role_fix_admin_rls.sql` (новый — роль admin в profiles, SECURITY DEFINER функция)
- `supabase/seed_posts.sql` (новый)
- `src/types/supabase.ts` (изменён — добавлена таблица posts, поле role в profiles)
- `src/features/feed/types.ts` (новый)
- `src/features/feed/store.ts` (изменён — `error` state, `changeCategory`, `isLoading: true` в initialState)
- `src/features/feed/api/posts.ts` (изменён — составной курсор `created_at|id`, валидация cursor, `AbortSignal`)
- `src/features/feed/components/FeedContainer.tsx` (изменён — error/retry state, `AbortController`, manual CTA для редкой категории, `currentUserId` mapper)
- `src/app/(app)/feed/page.tsx` (изменён — `changeCategory` вместо `setActiveCategory`+`reset`)
- `src/app/(app)/layout.tsx` (изменён — один auth round-trip + MobileNav)
- `src/features/auth/components/AuthProvider.tsx` (изменён — `session: Session | null` для app-layout сценария)
- `src/components/feed/PostCard.tsx` (изменён — `PostCardSkeleton` без media placeholder по умолчанию)
- `tests/unit/features/feed/types.test.ts` (новый — 11 тестов dbPostToCardData mapper)
- `tests/unit/features/feed/store.test.ts` (новый — 11 тестов Zustand store)
- `tests/unit/features/feed/api/posts.test.ts` (новый — 10 тестов fetchPosts API)
- `tests/unit/features/feed/components/FeedContainer.test.tsx` (новый — 13 тестов компонента)
- `tests/unit/app/feed/page.test.tsx` (переписан — 4 теста обновлённой страницы)
- `tests/unit/app/(app)/layout.test.tsx` (новый — 2 теста app layout без лишнего auth round-trip)
- `tests/unit/components/feed/PostCard.test.tsx` (новый — 2 теста `PostCardSkeleton`)
- `tests/unit/components/media/LazyMediaWrapper.test.tsx` (изменён — исправлен mock `IntersectionObserver` для jsdom)
- `supabase/migrations/010_fix_security_definer_and_perf_index.sql` (новый — SET search_path=public для is_active_subscriber(), составной индекс idx_posts_cursor)

## Change Log

- Первичная реализация: Tasks 1–7 выполнены (Date: 2026-03-18)
- Addressed code review findings — 5 items resolved (Date: 2026-03-18)
- Adversarial review performed: 5 new issues identified (2 Critical, 1 High, 2 Medium). Status set to in-progress. (Date: 2026-03-18)
- Addressed adversarial review findings — 5 items resolved (2 Critical, 1 High, 2 Medium). 37 tests added. (Date: 2026-03-18)
- Addressed final review findings — 5 items resolved (2 Critical, 2 Medium, 1 Low). Migration 010 added. (Date: 2026-03-18)
- Adversarial review #3: 9 new action items created (1 High, 4 Medium, 3 Low). Status → in-progress. (Date: 2026-03-18)
- Addressed adversarial review #3 findings — 10 items resolved (1 High, 6 Medium, 3 Low). Story status → review. (Date: 2026-03-18)
