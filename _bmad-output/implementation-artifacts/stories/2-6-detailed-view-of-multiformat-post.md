# Story 2.6: Детальный просмотр мультиформатного поста
Status: complete
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

- [x] [AI-Review] [LOW] Подтвердить корректность локали sl-SI для даты в PostDetail.tsx.
- [x] [AI-Review] [HIGH] Баг рендеринга одиночного видео в PostDetail.tsx для типов multi-video/gallery (сейчас возвращает null вместо плеера).
- [x] [AI-Review] [MEDIUM] Добавить тесты для граничных случаев медиа (media.length < 2) в PostDetail.test.tsx.
- [x] [AI-Review] [MEDIUM] Layout Shift даты: текущий useEffect вызывает моргание текста после гидрации (рассмотреть передачу даты строкой через пропсы или Intl.DateTimeFormat на сервере).
- [x] [AI-Review] [MEDIUM] Семантика ошибок fetchPostById: возвращает null на 500 ошибке, что превращается в 404 для пользователя.
- [x] [AI-Review] [LOW] loading.tsx: h-72 вызывает layout shift для видео (16/9). Использовать aspect-video для превью-скелетона видео-постов.

### Review Follow-ups (AI)

- [x] [AI-Review] [HIGH] Исправить логику `handleBack`: при открытии по прямой ссылке в новой вкладке `history.length > 1`, но `back()` уводит из приложения.
- [x] [AI-Review] [MEDIUM] Исправить часовой пояс в `PostDetail.tsx`: принудительный UTC может отображать неверную дату для пользователей в других регионах.
- [x] [AI-Review] [MEDIUM] Устранить Layout Shift в `loading.tsx`: скелетон всегда показывает 16:9, даже если пост текстовый или фото (4:5).
- [x] [AI-Review] [MEDIUM] Повысить кликабельность: в ленте (`PostCard.tsx`) клик по контейнеру одиночного видео должен вести на страницу поста.
- [x] [AI-Review] [LOW] Исправить опечатку в `not-found.tsx`: "Te objave ne obstaja" -> "Ta objava ne obstaja".

## Dev Notes

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
- ✅ Resolved review finding [CRITICAL]: `page.tsx` — `supabase.auth.getUser()` обёрнут в `.catch(() => ({ data: { user: null } }))` внутри `Promise.all`. При сбое auth RSC не падает; `user` gracefully деградирует до `null`.
- ✅ Resolved review finding [HIGH]: `generateMetadata` в `page.tsx` — добавлен guard через `post.type === 'video' || post.mediaItem?.media_type === 'video'`; для видео всегда `thumbnail_url`, а `imageUrl` проверяется на `.mp4`-суффикс прежде чем использоваться как OG image.
- ✅ Resolved review finding [MEDIUM]: Дата в `PostDetail.tsx` переведена с прямого форматирования на `useState(null)` + `useEffect` — на сервере рендерится `null`, hydration mismatch/мерцание невозможны. Убран `suppressHydrationWarning`.
- ✅ Resolved review finding [MEDIUM]: Скелетон в `loading.tsx` — `aspect-[4/5]` заменён на `h-72` (фиксированная высота), нейтральная для обоих типов (фото 4:5, видео 16:9). Устраняет layout shift при загрузке видео-постов.
- ✅ Resolved review finding [MEDIUM]: Store sync — `handleLike` теперь обновляет Zustand store **оптимистично** (до RPC-вызова). При ошибке RPC store также откатывается. Устраняет stale data при быстрой навигации назад.
- ✅ Resolved review finding [MEDIUM]: Observability — `fetchInitialPostsServer` и `fetchPostById` теперь логируют ошибки через `console.error` перед fallback/return null. Диагностика production-ошибок теперь возможна.
- ✅ Resolved review finding [MEDIUM]: `fetchInitialPostsServer` при ошибке возвращает `hasMore: false` (было `true`). Предотвращает бесконечный цикл загрузки в FeedContainer при сбое Supabase. Тест: "возвращает hasMore: false при ошибке Supabase".
- ✅ Resolved review finding [MEDIUM]: `PostDetail.tsx` — `handleBack()` проверяет `window.history.length > 1`. При прямом входе (length ≤ 1) вызывает `router.push('/feed')` вместо `router.back()`. Предотвращает уход из приложения при открытии поста по прямой ссылке. 2 новых теста.
- ✅ Resolved review finding [MEDIUM]: `PostCardSkeleton` — `aspect-[4/5]` заменён на `h-72` для фото-скелетона. Устраняет layout shift при загрузке фото-карточек (высота фиксированная). Тест обновлён: проверяет `h-72` вместо `aspect-[4/5]`.
- ✅ Resolved review finding [MEDIUM]: File List уточнён — `types.ts` закоммичен в main без outstanding изменений; `PostCard.tsx` содержит outstanding изменение (h-72 fix). Оба файла корректно задокументированы как изменённые данной историей.
- ✅ Resolved review finding [LOW]: Локаль `sl-SI` подтверждена — проект использует Slovenian (lang="sl"). Форматирование даты на клиенте через `useEffect` исключает SSR hydration mismatch.
- ✅ Resolved review finding [HIGH]: `PostDetail.tsx` — одиночное медиа: условие `post.type === 'video'` расширено до `post.type === 'video' || 'multi-video'`; `post.type === 'photo'` — до `'photo' || 'gallery'`. multi-video/gallery с 1 медиа больше не рендерят null. Тесты: "multi-video с 1 медиа: рендерит VideoPlayerContainer" и "gallery с 1 медиа: рендерит LazyMediaWrapper".
- ✅ Resolved review finding [MEDIUM]: Добавлены тесты граничных случаев в `PostDetail.test.tsx`: multi-video/gallery с media.length < 2 (2 новых теста). `as any` заменён на `as unknown as PostMedia` в 5 тест-кейсах (устранены pre-existing lint ошибки).
- ✅ Resolved review finding [MEDIUM]: Дата в `PostDetail.tsx` — `useState(null)` + `useEffect` заменены прямым `toLocaleDateString('sl-SI', { timeZone: 'UTC' })`. Явный UTC исключает SSR/client timezone mismatch; нет useEffect — нет мерцания после гидрации. Удалён неиспользуемый импорт `useEffect`. Тесты обновлены: проверяют вызов с `timeZone: 'UTC'` и синхронный рендер.
- ✅ Resolved review finding [MEDIUM]: `fetchPostById` — `if (error)` теперь различает PGRST116 (return null → 404) и прочие ошибки Supabase (throw → Next.js error.tsx, 500). catch-блок re-throw вместо return null. Тесты обновлены: PGRST116→null, non-PGRST116→throws, catch→throws (3 новых теста, 2 обновлены).
- ✅ Resolved review finding [LOW]: `loading.tsx` — `h-72` заменён на `aspect-video w-full` для медиа-скелетона. Точное соответствие высоте видео (16:9) — минимальный layout shift для видео-постов.
- ✅ Resolved review finding [HIGH]: PostDetail.tsx уже использует `toLocaleDateString('sl-SI', { timeZone: 'UTC' })` — явный UTC исключает SSR/client timezone mismatch без useEffect. Тесты: "toLocaleDateString вызывается с timeZone UTC" и "дата рендерится синхронно" — оба проходят.
- ✅ Resolved review finding [MEDIUM]: `generateMetadata` в `page.tsx` — добавлен `twitter` объект с `card` ('summary_large_image' если есть ogImage, иначе 'summary'), `title`, `description`, `images`. Улучшает превью в X/Twitter.
- ✅ Resolved review finding [MEDIUM]: `PostDetail.tsx` — `handleLike` catch-блок теперь вызывает `toast.error('Napaka pri všečkanju')` после отката UI и store. Импортирован `toast` из `sonner`. 1 новый тест: "показывает toast при ошибке RPC лайка".
- ✅ Resolved review finding [LOW]: `serverPosts.ts` — `authorName.split(' ')` заменён на `.split(/\s+/).filter(Boolean)`. Корректно обрабатывает двойные пробелы в именах. 1 новый тест: "инициалы: split(/\\s+/) корректно обрабатывает двойные пробелы".
- ✅ Resolved review finding [MEDIUM]: `PostDetail.tsx` — `handleLike` разделён: `if (isPending) return` + отдельная ветка `if (!currentUserId) { toast.info('Za všečkanje se morate prijaviti'); return }`. Пользователь получает информационное уведомление при попытке лайкнуть без авторизации. Мок sonner расширен `toast.info`. 1 новый тест: "аноним: показывает toast.info при клике лайка".
- ✅ Resolved review finding [MEDIUM]: `serverPosts.ts` — catch-блок `fetchInitialPostsServer` теперь re-throws вместо fallback return. Next.js error boundary корректно перехватывает DB ошибки. Тест обновлён: "бросает ошибку при сбое Supabase (позволяет Next.js error boundary обработать ошибку)".
- ✅ Resolved review finding [LOW]: `page.tsx` — `generateMetadata` теперь включает `openGraph.url: \`${NEXT_PUBLIC_SITE_URL}/feed/${id}\``. Каноническая ссылка передаётся в og:url для корректного SEO.
- ✅ Resolved review follow-up [LOW]: `not-found.tsx` — исправлена опечатка "Te objave ne obstaja" → "Ta objava ne obstaja".
- ✅ Resolved review follow-up [MEDIUM]: `loading.tsx` — скелетон уже содержал `aspect-video w-full` (было исправлено ранее, чекбокс закрыт).
- ✅ Resolved review follow-up [HIGH]: `PostDetail.tsx` — `handleBack` переработан: вместо `window.history.length > 1` (недостаточно — > 1 даже при переходе с внешнего сайта) использует `document.referrer` для проверки same-origin. Если referrer того же origin → `router.back()`, иначе → `router.push('/feed')`. Тесты обновлены: удалён history stub, добавлен мок `document.referrer`; добавлен тест "router.push('/feed') при переходе с внешнего сайта".
- ✅ Resolved review follow-up [MEDIUM]: `PostDetail.tsx` — дата: принудительный `timeZone: 'UTC'` заменён на `useState('') + useEffect` с локальным timezone пользователя. SSR рендерит пустую строку (нет hydration mismatch), клиент форматирует корректно. Тесты обновлены: убрана проверка `timeZone: 'UTC'`, добавлен `waitFor`. `vitest.config.ts` получил `environmentOptions.jsdom.url: 'http://localhost/'` для корректной работы `window.location.origin` в тестах.
- ✅ Resolved review follow-up [MEDIUM]: `PostCard.tsx` — клик по контейнеру одиночного видео навигирует к посту. Добавлен `useRouter`, враппер получил `onClick={() => router.push('/feed/${post.id}')}` + `cursor-pointer` + `data-testid="video-card-container"`. Нативные контролы `<video>` перехватывают события до всплытия — play/pause работают без триггера навигации. Тест: "клик по контейнеру одиночного видео навигирует к посту".

### File List

- `src/app/(app)/feed/[id]/page.tsx` (modify — добавлен `generateMetadata`, `currentUserId` из `supabase.auth.getUser()`; OG image: для видео → `thumbnail_url`)
- `src/app/(app)/feed/[id]/loading.tsx` (modify — h-72 → aspect-video w-full для медиа-скелетона)
- `src/app/(app)/feed/[id]/not-found.tsx` (new)
- `src/features/feed/types.ts` (modify — добавлен тип `PostDetail`, поле `isLiked: boolean`; `date` → `created_at: string`)
- `src/features/feed/api/serverPosts.ts` (modify — `fetchPostById`: дифференциация PGRST116 (return null) vs server errors (throw); re-throw в catch-блоке)
- `src/components/feed/PostDetail.tsx` (modify — fix single media: multi-video/gallery с 1 медиа больше не рендерит null; дата: useEffect+useState → прямой toLocaleDateString с timeZone:UTC)
- `src/components/feed/PostCard.tsx` (modify — image и excerpt кликабельны через Link; PostCardSkeleton: aspect-[4/5] → h-72 для устранения layout shift)
- `tests/unit/components/feed/PostCard.test.tsx` (modify — обновлён тест PostCardSkeleton: h-72 вместо aspect-[4/5])
- `tests/unit/components/feed/PostDetail.test.tsx` (modify — 34 тестов: добавлены граничные случаи multi-video/gallery с 1 медиа; обновлены тесты даты: UTC timezone + синхронный рендер)
- `tests/unit/features/feed/api/serverPosts.test.ts` (modify — 21 тест: обновлён тест fetchInitialPostsServer на throw вместо fallback return)
- `tests/unit/components/feed/PostDetail.test.tsx` (modify — 40 тестов: рефакторинг handleBack тестов на document.referrer, обновлены timezone тесты, добавлен тест внешнего referrer)
- `src/app/(app)/feed/[id]/not-found.tsx` (modify — исправлена опечатка "Te objave" → "Ta objava")
- `src/components/feed/PostCard.tsx` (modify — добавлен useRouter + onClick навигация на контейнере видео)
- `tests/unit/components/feed/PostCard.test.tsx` (modify — добавлен мок useRouter, тест кликабельности видео контейнера)
- `vitest.config.ts` (modify — environmentOptions.jsdom.url для корректного window.location.origin в тестах)
