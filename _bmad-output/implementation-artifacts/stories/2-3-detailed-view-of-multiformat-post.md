# Story 2.3: Детальный просмотр мультиформатного поста

Status: ready-for-dev

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

- [ ] **Task 1: Маршрут для детальной страницы поста**
  - [ ] Создать директорию `src/app/(app)/feed/[id]/` и файл `page.tsx`
  - [ ] Создать файл `loading.tsx` со скелетоном для мгновенного фидбека при навигации
  - [ ] Создать файл `not-found.tsx` для обработки ошибок (несуществующий пост)

- [ ] **Task 2: API слой для получения поста по ID**
  - [ ] Добавить функцию `fetchPostById(id: string)` в `src/features/feed/api/posts.ts` (или `serverPosts.ts`, если загрузка серверная)
  - [ ] Реализовать запрос к Supabase (`posts` + join `profiles`) с обработкой ошибок
  - [ ] Обновить/создать маппер данных (например, `dbPostToDetailData`), если структура детального поста шире, чем `PostCardData`

- [ ] **Task 3: Компоненты детального просмотра (Dumb UI)**
  - [ ] Создать `src/components/feed/PostDetail.tsx` (или внутри `src/features/feed/components/`)
  - [ ] Реализовать условный рендеринг в зависимости от `type` ('text', 'photo', 'video')
  - [ ] Реализовать отображение медиа с использованием оптимизаций из Story 2.2 (`LazyMediaWrapper` или `next/image` с `priority=true` для LCP)
  - [ ] Добавить кнопку "Назад" (с вызовом `router.back()` или ссылкой на `/feed`)

- [ ] **Task 4: Контейнер детальной страницы (Smart Container / RSC)**
  - [ ] В `page.tsx` (Server Component) или через `PostDetailContainer.tsx` реализовать загрузку данных поста
  - [ ] Обработать состояния (loading, error/not-found, success)
  - [ ] Передать данные в `PostDetail`

- [ ] **Task 5: Интеграция с лентой**
  - [ ] В `PostCard` (или в списке) обернуть карточку или заголовок в `<Link href="/feed/[id]">` (или добавить обработчик клика с `router.push()`)
  - [ ] Убедиться, что при возврате назад Zustand-store ленты предоставляет закэшированные посты для мгновенного рендера и Next.js восстанавливает позицию скролла

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

Cascade

### Debug Log References

### Completion Notes List

### File List

- `src/app/(app)/feed/[id]/page.tsx` (new)
- `src/app/(app)/feed/[id]/loading.tsx` (new)
- `src/app/(app)/feed/[id]/not-found.tsx` (new)
- `src/features/feed/api/posts.ts` (modify)
- `src/features/feed/api/serverPosts.ts` (modify - optional)
- `src/components/feed/PostDetail.tsx` (new)
- `src/components/feed/PostCard.tsx` (modify)
