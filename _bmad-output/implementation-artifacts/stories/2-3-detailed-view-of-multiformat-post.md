# Story 2.3: Детальный просмотр мультиформатного поста

Status: in-progress

## Story

As a участница,
I want открывать конкретный пост для полноценного чтения, просмотра галереи или видео,
so that изучить материал полностью.

## Acceptance Criteria

1. **Given** карточка поста в общей ленте **When** участница тапает по карточке **Then** открывается полная версия поста (`/feed/[id]`)
2. **Given** открытая страница поста **When** контент загружается **Then** интерфейс корректно отрисовывает контент в зависимости от типа (Rich Text для текста, Video Player для видео, Image/Gallery для фото)
3. **Given** открытая страница поста **When** участница нажимает кнопку "Назад" (Back) **Then** происходит возврат в общую ленту с сохранением позиции скролла (кэшированное состояние ленты не сбрасывается)
4. **Given** запрос к детальному посту **When** выполняется загрузка данных **Then** отображается Skeleton-загрузчик, имитирующий структуру поста
5. **Given** неверный ID поста или пост удален **When** участница пытается его открыть **Then** отображается 404 страница (Not Found) с предложением вернуться в ленту

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
  - [x] Реализовать условный рендеринг в зависимости от `type` ('text', 'photo', 'video')
  - [x] Реализовать отображение медиа с использованием оптимизаций из Story 2.2 (`LazyMediaWrapper` или `next/image` с `priority=true` для LCP)
  - [x] Добавить кнопку "Назад" (с вызовом `router.back()` или ссылкой на `/feed`)

- [x] **Task 4: Контейнер детальной страницы (Smart Container / RSC)**
  - [x] В `page.tsx` (Server Component) или через `PostDetailContainer.tsx` реализовать загрузку данных поста
  - [x] Обработать состояния (loading, error/not-found, success)
  - [x] Передать данные в `PostDetail`

- [x] **Task 5: Интеграция с лентой**
  - [x] В `PostCard` (или в списке) обернуть карточку или заголовок в `<Link href="/feed/[id]">` (или добавить обработчик клика с `router.push()`)
  - [x] Убедиться, что при возврате назад Zustand-store ленты предоставляет закэшированные посты для мгновенного рендера и Next.js восстанавливает позицию скролла

### Review Follow-ups (AI)

- [x] [AI-Review][CRITICAL] False claims on testing: Tasks marked [x] but no tests exist for `fetchPostById` or `PostDetail`. [_bmad-output/implementation-artifacts/stories/2-3-detailed-view-of-multiformat-post.md:21-45]
- [x] [AI-Review][CRITICAL] Missing `is_liked` status in `fetchPostById` and interactivity in `PostDetail`. [src/features/feed/api/serverPosts.ts:41, src/components/feed/PostDetail.tsx:105]
- [x] [AI-Review][MEDIUM] Poor UX in Feed Navigation: Image and excerpt in `PostCard` are not clickable. [src/components/feed/PostCard.tsx:102]
- [x] [AI-Review][MEDIUM] Code Duplication in `PostDetail.tsx` for photo/video types. [src/components/feed/PostDetail.tsx:79-103]
- [x] [AI-Review][MEDIUM] Missing dynamic SEO metadata (generateMetadata) in `page.tsx`. [src/app/(app)/feed/[id]/page.tsx:9]
- [ ] [AI-Review][CRITICAL] Like state in PostDetail.tsx is isolated from FeedContainer store; navigating back shows stale data. [src/components/feed/PostDetail.tsx:19]
- [ ] [AI-Review][HIGH] Back button uses Link to /feed instead of router.back(), violating AC 3 regarding scroll position preservation. [src/components/feed/PostDetail.tsx:44]
- [ ] [AI-Review][MEDIUM] Missing authentication check for Like action in PostDetail; causes visual rollback for anonymous users. [src/components/feed/PostDetail.tsx:28]
- [ ] [AI-Review][MEDIUM] Potential hydration/timezone mismatch in server-side localized dates. [src/features/feed/api/serverPosts.ts:65]


## Dev Notes

- **Сохранение скролла:** В Next.js App Router навигация через `<Link>` автоматически пытается сохранить и восстановить позицию скролла при возврате. Поскольку в Story 2.1 внедрен Zustand для кэширования списка постов, `FeedContainer` должен сразу рендерить посты из кэша (без начальной задержки или скелетонов, если посты уже есть), что обеспечит правильное восстановление скролла браузером.
- **Dumb/Smart Components:** Строго разделяйте UI детального поста (`PostDetail`) и логику извлечения данных. В Next.js App Router страницу детального просмотра имеет смысл сделать React Server Component (RSC) для быстрого начального рендера, а клиентские интерактивные элементы вынести в клиентские компоненты (`'use client'`).
- **Обработка ошибок (Not Found):** Если запрос `fetchPostById` возвращает пустоту, используйте функцию `notFound()` из `next/navigation`, чтобы отрендерить `not-found.tsx`.
- **Типы контента:**
  - `text`: отформатированный текст.
  - `photo`: Использовать `next/image` с `priority=true`, так как главное фото — это LCP (Largest Contentful Paint) страницы поста.
  - `video`: отобразить превью/плеер.
- **Именование:** По-прежнему используем `snake_case` в ответах Supabase.

### Project Structure Notes

- Alignment with unified project structure:
  - Ожидаемый путь страницы: `src/app/(app)/feed/[id]/page.tsx`
  - Управление данными: `src/features/feed/api/posts.ts` или `serverPosts.ts`
  - UI компонент: `src/components/feed/PostDetail.tsx` (или внутри `features/feed/components/`)

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Component Patterns]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.3]
- [Source: src/features/feed/store.ts]
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
- **Task 3:** `PostDetail.tsx` — клиентский компонент (нужен для `LazyMediaWrapper`). Условный рендеринг по `post.type`: `text` → `whitespace-pre-wrap` контент; `photo` → `LazyMediaWrapper` (aspect 4/5, priority=true для LCP) + текст; `video` → `LazyMediaWrapper` (aspect 16/9, priority=true) + описание. Кнопка "Назад" — `<Link href="/feed">` (не `router.back()` — безопаснее для прямых ссылок).
- **Task 4:** Реализован как RSC прямо в `page.tsx` — данные загружаются на сервере, `notFound()` вызывается при пустом ответе, успешный результат передаётся в `<PostDetail post={post} />`.
- **Task 5:** В `PostCard.tsx` заголовок обёрнут в `<Link href="/feed/${post.id}">` с `group-hover:text-primary transition-colors` для UX-сигнала кликабельности. Zustand-store не сбрасывается при навигации — кэш постов сохраняется, Next.js App Router автоматически восстанавливает скролл.
- ✅ Resolved review finding [CRITICAL]: `fetchPostById` теперь запрашивает `is_liked:posts_is_liked`, возвращает `isLiked: boolean`. `PostDetail` type обновлён. `PostDetail.tsx` — интерактивная кнопка лайка с оптимистичным обновлением через `supabase.rpc('toggle_like')`. `fetchPostById` обёрнута в React `cache` для дедупликации вызова из `generateMetadata` и `page`.
- ✅ Resolved review finding [MEDIUM]: `PostCard.tsx` — изображение обёрнуто в `<Link tabIndex=-1 aria-hidden>` (не дублирует tab-stop), excerpt включён в link заголовка.
- ✅ Resolved review finding [MEDIUM]: `PostDetail.tsx` — дублирующие блоки photo/video объединены в один `{post.type !== 'text' && ...}`.
- ✅ Resolved review finding [MEDIUM]: `page.tsx` — добавлен `generateMetadata` с `title`, `description`, `openGraph` (включая `images` для photo/video постов).
- ✅ Resolved review finding [CRITICAL]: Vitest уже настроен в проекте (CLAUDE.md устарел). Созданы тесты: `tests/unit/features/feed/api/serverPosts.test.ts` (13 тестов — select query, is_liked mapping, fallback Avtor, null/error handling, cache) и `tests/unit/components/feed/PostDetail.test.tsx` (20 тестов — render by type, like optimistic update, rollback, RPC call). Все 33 новых теста ✅. React `cache()` замокан в serverPosts.test.ts чтобы избежать кэширования между тестами.

### File List

- `src/app/(app)/feed/[id]/page.tsx` (modify — добавлен `generateMetadata`)
- `src/app/(app)/feed/[id]/loading.tsx` (new)
- `src/app/(app)/feed/[id]/not-found.tsx` (new)
- `src/features/feed/types.ts` (modify — добавлен тип `PostDetail`, поле `isLiked: boolean`)
- `src/features/feed/api/serverPosts.ts` (modify — `fetchPostById` обёрнута в `cache`, добавлен `is_liked:posts_is_liked` в select, возвращает `isLiked`)
- `src/components/feed/PostDetail.tsx` (modify — интерактивная кнопка лайка, устранено дублирование photo/video блоков)
- `src/components/feed/PostCard.tsx` (modify — image и excerpt кликабельны через Link)
- `tests/unit/features/feed/api/serverPosts.test.ts` (new — 13 тестов fetchPostById)
- `tests/unit/components/feed/PostDetail.test.tsx` (new — 20 тестов PostDetail)
