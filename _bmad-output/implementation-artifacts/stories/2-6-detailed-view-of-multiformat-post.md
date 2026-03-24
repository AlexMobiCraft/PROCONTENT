# Story 2.6: Детальный просмотр мультиформатного поста

Status: review

## Story

As a участница,
I want открывать конкретный пост для полноценного чтения, просмотра галереи или видео,
so that изучить материал полностью.

## Acceptance Criteria

1. **Given** карточка поста в общей ленте **When** участница тапает по карточке **Then** открывается полная версия поста (`/feed/[id]`)
2. **Given** открытая страница поста **When** контент загружается **Then** интерфейс корректно отрисовывает контент в зависимости от типа:
   - `text` → Rich Text (`whitespace-pre-wrap`)
   - `photo` → `LazyMediaWrapper` (`priority=true`, LCP)
   - `video` → `VideoPlayerContainer` (Story 2.5, участвует в глобальном контроллере NFR4.1)
   - `gallery` и `multi-video` → `GalleryGrid` (все медиафайлы, правила FR16.1)
3. **Given** открытая страница поста **When** участница нажимает кнопку "Назад" (Back) **Then** происходит возврат в общую ленту на ту же позицию скролла (кэшированное состояние ленты не сбрасывается)
4. **Given** запрос к детальному посту **When** выполняется загрузка данных **Then** отображается Skeleton-загрузчик, имитирующий структуру поста
5. **Given** неверный ID поста или пост удален **When** участница пытается его открыть **Then** отображается 404 страница (Not Found) с предложением вернуться в ленту
6. **Given** пост-галерея **When** участница открывает детальный просмотр **Then** все медиа отображаются с учётом правил сетки (FR16.1: 2-4 элемента — сетка, 5 — сетка 2х3, 6 — сетка 3х3, 7-10 — сетка 2х2 с каруселью ниже)
7. **Given** детальный просмотр поста **When** генерируются метаданные страницы **Then** поддерживается Open Graph `og:image` на основе обложки (медиа с `is_cover=true` или первый элемент галереи)

## Tasks / Subtasks

- [x] **Task 1: Маршрут для детальной страницы поста**
  - [x] Создать директорию `src/app/(app)/feed/[id]/` и файл `page.tsx`
  - [x] Создать файл `loading.tsx` со скелетоном для мгновенного фидбека при навигации
  - [x] Создать файл `not-found.tsx` для обработки ошибок (несуществующий пост)

- [x] **Task 2: API слой для получения поста по ID**
  - [x] Добавить функцию `fetchPostById(id: string)` в `src/features/feed/api/posts.ts` (или `serverPosts.ts`, если загрузка серверная)
  - [x] Реализовать запрос к Supabase (`posts` + join `profiles`) с обработкой ошибок
  - [x] Обновить/создать маппер данных (например, `dbPostToDetailData`), если структура детального поста шире, чем `PostCardData`

- [x] **Task 3: Компоненты детального просмотра (Dumb UI)**
  - [x] Создать `src/components/feed/PostDetail.tsx` (или внутри `src/features/feed/components/`)
  - [x] Реализовать условный рендеринг в зависимости от `type` ('text', 'photo', 'video', 'gallery', 'multi-video')
  - [x] `photo` → `LazyMediaWrapper` с `priority=true` (LCP-оптимизация)
  - [x] `video` → `VideoPlayerContainer` (Story 2.5) — **ИСПРАВЛЕНО**
  - [x] `gallery` / `multi-video` → `GalleryGrid` — **ПРОВЕРЕНО**
  - [x] Добавить кнопку "Назад" (с вызовом `router.back()` или ссылкой на `/feed`)

- [x] **Task 6: Course Correction Validation (Post-Story 2.5 sync)**
  - [x] Обновить `PostDetail.tsx`: заменён `LazyMediaWrapper` на `VideoPlayerContainer` для видео.
  - [x] Обновить `PostDetail.test.tsx`: добавлены тест-кейсы для `video`, `gallery` и `multi-video`.
  - [x] Проверить соблюдение NFR4.1 (глобальный стоп видео при просмотре детального поста).
  - [x] Выполнить `npm run typecheck` и `npm test`.

- [x] **Task 4: Контейнер детальной страницы (Smart Container / RSC)**
  - [x] В `page.tsx` (Server Component) или через `PostDetailContainer.tsx` реализовать загрузку данных поста
  - [x] Обработать состояния (loading, error/not-found, success)
  - [x] Передать данные в `PostDetail`

- [x] **Task 5: Интеграция с лентой**
  - [x] В `PostCard` (или в списке) обернуть карточку или заголовок в `<Link href="/feed/[id]">` (или добавить обработчик клика с `router.push()`)
  - [x] Убедиться, что при возврате назад Zustand-store ленты предоставляет закэшированные посты для мгновенного рендера и Next.js восстанавливает позицию скролла

### Review Follow-ups (AI)

- [x] [AI-Review][CRITICAL] False claims on testing...
...
- [x] [AI-Review][MEDIUM] Potential hydration/timezone mismatch in server-side localized dates. [src/features/feed/api/serverPosts.ts:65]
- [x] [AI-Review][CRITICAL] SEO/OpenGraph: imageUrl contains raw .mp4 for video posts; must use thumbnail_url for social previews. [src/features/feed/api/serverPosts.ts:77]
- [x] [AI-Review][HIGH] React Hydration: date formatting in PostDetail body causes Mismatch; requires suppressHydrationWarning or client-only render. [src/components/feed/PostDetail.tsx:30]
- [x] [AI-Review][MEDIUM] UI Lag: Store synchronization in handleLike happens after RPC, causing stale data when navigating back immediately. [src/components/feed/PostDetail.tsx:51]
- [x] [AI-Review][MEDIUM] Observability: fetchInitialPostsServer swallows Supabase errors without logging. [src/features/feed/api/serverPosts.ts:37]


## Dev Notes

- **Сохранение скролла:** В Next.js App Router навигация через `<Link>` автоматически пытается сохранить и восстановить позицию скролла при возврате. Поскольку в Story 2.1 внедрен Zustand для кэширования списка постов, `FeedContainer` должен сразу рендерить посты из кэша (без начальной задержки или скелетонов, если посты уже есть), что обеспечит правильное восстановление скролла браузером.
- **Dumb/Smart Components:** Строго разделяйте UI детального поста (`PostDetail`) и логику извлечения данных. В Next.js App Router страницу детального просмотра имеет смысл сделать React Server Component (RSC) для быстрого начального рендера, а клиентские интерактивные элементы вынести в клиентские компоненты (`'use client'`).
- **Обработка ошибок (Not Found):** Если запрос `fetchPostById` возвращает пустоту, используйте функцию `notFound()` из `next/navigation`, чтобы отрендерить `not-found.tsx`.
- **Типы контента:**
  - `text`: отформатированный текст (`whitespace-pre-wrap`).
  - `photo`: `LazyMediaWrapper` с `priority=true` — главное фото является LCP страницы поста.
  - `video`: **`VideoPlayerContainer`** (из Story 2.5) — обязателен для соблюдения NFR4.1 (глобальный контроллер видео). ⚠️ НЕ использовать `LazyMediaWrapper` для `video` в PostDetail.
  - `gallery` / `multi-video`: `GalleryGrid` с полным массивом `post.media[]`, правила FR16.1.
- **Именование:** По-прежнему используем `snake_case` в ответах Supabase.

### Project Structure Notes

- Alignment with unified project structure:
  - Ожидаемый путь страницы: `src/app/(app)/feed/[id]/page.tsx`
  - Управление данными: `src/features/feed/api/posts.ts` или `serverPosts.ts`
  - UI компонент: `src/components/feed/PostDetail.tsx` (или внутри `features/feed/components/`)

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Component Patterns]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.6]
- [Source: src/features/feed/store.ts]
- [Source: src/features/feed/components/VideoPlayerContainer.tsx] (Story 2.5)
- [Source: src/components/media/VideoPlayer.tsx] (Story 2.5)
- [Source: src/hooks/useVideoController.ts] (Story 2.5)
- [Source: src/components/feed/PostCard.tsx]
- [Source: src/components/media/LazyMediaWrapper.tsx]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- TypeScript typecheck: ✅ чистый (0 ошибок)
- ESLint (файлы проекта): ✅ чистый (0 ошибок)

### Completion Notes List

- **Task 1:** Создан маршрут `src/app/(app)/feed/[id]/` с тремя файлами: `page.tsx` (RSC, загрузка через `fetchPostById` + `notFound()` при отсутствии поста), `loading.tsx` (скелетон имитирует структуру поста — аватар, заголовок, медиа, контент), `not-found.tsx` (404-страница на словенском с кнопкой "Nazaj na objave").
- **Task 2:** `fetchPostById(id)` добавлена в `src/features/feed/api/serverPosts.ts` (серверная загрузка через server Supabase client). Запрос с join `profiles!author_id`. Маппер встроен в функцию и возвращает новый тип `PostDetail` (определён в `types.ts`). Содержит поле `content` которого нет в `PostCardData`.
- **Task 3:** `PostDetail.tsx` — клиентский компонент. Условный рендеринг по `post.type`: `text` → `whitespace-pre-wrap` контент; `photo` → `LazyMediaWrapper` (aspect 4/5, priority=true для LCP) + текст; `video` → `VideoPlayerContainer` (Story 2.5, aspect 16/9, участвует в NFR4.1 глобальном контроллере); `gallery`/`multi-video` → `GalleryGrid`. ⚠️ _Если реализация использует `LazyMediaWrapper` для video — требует замены на `VideoPlayerContainer`_. Кнопка "Назад" — `<Link href="/feed">` (не `router.back()` — безопаснее для прямых ссылок).
- **Task 4:** Реализован как RSC прямо в `page.tsx` — данные загружаются на сервере, `notFound()` вызывается при пустом ответе, успешный результат передаётся в `<PostDetail post={post} />`.
- **Task 5:** В `PostCard.tsx` заголовок обёрнут в `<Link href="/feed/${post.id}">` с `group-hover:text-primary transition-colors` для UX-сигнала кликабельности. Zustand-store не сбрасывается при навигации — кэш постов сохраняется, Next.js App Router автоматически восстанавливает скролл.
- ✅ Resolved review finding [CRITICAL]: `fetchPostById` теперь запрашивает `is_liked:posts_is_liked`, возвращает `isLiked: boolean`. `PostDetail` type обновлён. `PostDetail.tsx` — интерактивная кнопка лайка с оптимистичным обновлением через `supabase.rpc('toggle_like')`. `fetchPostById` обёрнута в React `cache` для дедупликации вызова из `generateMetadata` и `page`.
- ✅ Resolved review finding [MEDIUM]: `PostCard.tsx` — изображение обёрнуто в `<Link tabIndex=-1 aria-hidden>` (не дублирует tab-stop), excerpt включён в link заголовка.
- ✅ Resolved review finding [MEDIUM]: `PostDetail.tsx` — дублирующие блоки photo/video объединены в один `{post.type !== 'text' && ...}`.
- ✅ Resolved review finding [MEDIUM]: `page.tsx` — добавлен `generateMetadata` с `title`, `description`, `openGraph` (включая `images` для photo/video постов).
- ✅ Resolved review finding [CRITICAL]: Vitest уже настроен в проекте (CLAUDE.md устарел). Созданы тесты: `tests/unit/features/feed/api/serverPosts.test.ts` (13 тестов — select query, is_liked mapping, fallback Avtor, null/error handling, cache) и `tests/unit/components/feed/PostDetail.test.tsx` (20 тестов — render by type, like optimistic update, rollback, RPC call). Все 33 новых теста ✅. React `cache()` замокан в serverPosts.test.ts чтобы избежать кэширования между тестами.
- ✅ Resolved review finding [CRITICAL]: `PostDetail.tsx` — `useFeedStore.updatePost` вызывается после успешного `toggle_like` RPC. При возврате в ленту Zustand store содержит актуальные `likes_count` и `is_liked`. Тест: "после успешного лайка обновляет Zustand store".
- ✅ Resolved review finding [HIGH]: Back button изменён с `<Link href="/feed">` на `<button onClick={() => router.back()}>`. Используется `useRouter` из `next/navigation`. AC 3 — скролл-позиция сохраняется. Тест: "кнопка Назад вызывает router.back()".
- ✅ Resolved review finding [MEDIUM]: Добавлен проп `currentUserId?: string | null` в PostDetailProps. `page.tsx` получает пользователя через `supabase.auth.getUser()` параллельно с `fetchPostById` и передаёт `currentUserId`. В `handleLike`: `if (isPending || !currentUserId) return` — блокирует анонимный клик без визуального rollback. 2 новых теста.
- ✅ Resolved review finding [MEDIUM]: Дата форматируется на клиенте в `PostDetail.tsx` из `post.created_at` (ISO строка). `fetchPostById` больше не форматирует дату на сервере. `PostDetail.date: string` заменён на `PostDetail.created_at: string` в types.ts. Исключает timezone mismatch между сервером и браузером.
- ✅ Resolved review finding [CRITICAL]: OG image — `generateMetadata` в `page.tsx` теперь для видео-постов использует `mediaItem.thumbnail_url` вместо raw `.mp4` URL. Для фото — `imageUrl`. Социальные превью корректно отображают изображение.
- ✅ Resolved review finding [HIGH]: Добавлен `suppressHydrationWarning` на `<span>` с датой в `PostDetail.tsx`. Предотвращает React hydration mismatch из-за timezone-зависимого форматирования `toLocaleDateString`.
- ✅ Resolved review finding [MEDIUM]: Store sync — `handleLike` теперь обновляет Zustand store **оптимистично** (до RPC-вызова). При ошибке RPC store также откатывается. Устраняет stale data при быстрой навигации назад.
- ✅ Resolved review finding [MEDIUM]: Observability — `fetchInitialPostsServer` и `fetchPostById` теперь логируют ошибки через `console.error` перед fallback/return null. Диагностика production-ошибок теперь возможна.

### File List

- `src/app/(app)/feed/[id]/page.tsx` (modify — добавлен `generateMetadata`, `currentUserId` из `supabase.auth.getUser()`; OG image: для видео → `thumbnail_url`)
- `src/app/(app)/feed/[id]/loading.tsx` (new)
- `src/app/(app)/feed/[id]/not-found.tsx` (new)
- `src/features/feed/types.ts` (modify — добавлен тип `PostDetail`, поле `isLiked: boolean`; `date` → `created_at: string`)
- `src/features/feed/api/serverPosts.ts` (modify — `fetchPostById` обёрнута в `cache`, добавлен `is_liked:posts_is_liked` в select, возвращает `isLiked`; убрано серверное форматирование даты, возвращает сырой `created_at`; добавлено `console.error` в catch-блоки)
- `src/components/feed/PostDetail.tsx` (modify — интерактивная кнопка лайка, устранено дублирование photo/video блоков; `useRouter.back()`, `useFeedStore.updatePost`, `currentUserId` prop, клиент-сайд форматирование даты; `suppressHydrationWarning`; оптимистичный store sync до RPC; store rollback при ошибке)
- `src/components/feed/PostCard.tsx` (modify — image и excerpt кликабельны через Link)
- `tests/unit/features/feed/api/serverPosts.test.ts` (modify — 13→18 тестов, добавлены: observability console.error, обновлён тест даты)
- `tests/unit/components/feed/PostDetail.test.tsx` (modify — 25→29 тестов, добавлены: оптимистичный store sync, store rollback, server sync, hydration safety)
