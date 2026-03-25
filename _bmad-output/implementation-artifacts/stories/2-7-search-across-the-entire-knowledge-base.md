# Story 2.7: Поиск по всей базе знаний

Status: review

## Story

As a участница,
I want вводить ключевые слова в строку поиска,
so that находить конкретные советы или разборы среди всех публикаций и архива.

## Acceptance Criteria

1. **Given** активная навигация (Bottom Bar / Sidebar) **When** участница переходит во вкладку "Поиск" (`/search`) и вводит запрос **Then** происходит поиск по заголовкам, тексту и тегам в БД (Supabase Full Text Search).
2. **Given** результаты поиска **When** данные загружены **Then** результаты отображаются в виде списка карточек (`PostCard`), при клике на которые открывается полный пост.
3. **Given** пустой результат поиска **When** запрос не дал совпадений **Then** отображается дружелюбное "Пустое состояние" (Empty State) с текстом на словенском (т.к. проект локализован под sl-SI).
4. **Given** процесс поиска **When** происходит отправка запроса **Then** отображаются Skeleton-загрузчики на время ожидания ответа от сервера, чтобы избежать скачков интерфейса (SPA-эффект).
5. **Given** ввод текста в строку поиска **When** пользователь печатает **Then** запросы к БД дебаунсятся (debounce, например 300-500мс) для предотвращения излишней нагрузки на API и сохранения отзывчивости.
6. **Given** строка поиска **When** поисковый запрос меняется **Then** он синхронизируется с URL-параметрами (например, `?q=keyword`) для возможности поделиться ссылкой и сохранения состояния при перезагрузке (опционально, но желательно для SPA).

## Tasks / Subtasks

- [x] **Task 1: Настройка маршрута и UI страницы поиска**
  - [x] Создать директорию `src/app/(app)/search/` и файл `page.tsx` (включая `loading.tsx` со скелетоном).
  - [x] Интегрировать поле ввода поиска (Search Input) с иконкой лупы в верхней части страницы.
  - [x] Реализовать компонент `EmptyState` (иллюстрация + текст "Ni zadetkov" / "Nič nismo našli" и т.п.).

- [x] **Task 2: API слой для поиска в Supabase**
  - [x] В `src/features/search/api/search.ts` добавить функцию `searchPosts(query: string)`.
  - [x] Использовать метод `.textSearch()` Supabase с type=websearch, config=simple для поиска по FTS-колонке.
  - [x] Убедиться, что запрос подтягивает связи (join `profiles`, `post_media`), как и в ленте, чтобы мапить в `PostCardData`.

- [x] **Task 3: Интеграция клиентского состояния и Debounce**
  - [x] Реализовать клиентский компонент `SearchContainer.tsx` (Smart Container) в `src/features/search/components/`.
  - [x] Добавить хук `useDebounce` для отложенной отправки запроса при вводе (400ms).
  - [x] Опционально: синхронизация с `useSearchParams` и `useRouter` из `next/navigation` для обновления `?q=`.

- [x] **Task 4: Обновление навигации**
  - [x] Убедиться, что в `MobileNav` (Bottom Bar) и `DesktopSidebar` есть активная ссылка на `/search`.
  - [x] Ссылки уже присутствовали в обоих компонентах — дополнительных изменений не потребовалось.

- [x] **Task 5 (Опционально): SQL-миграция для Full Text Search (FTS)**
  - [x] Создана миграция `supabase/migrations/018_add_fts_to_posts.sql`
  - [x] Добавлена generated column `fts` (tsvector) с индексом GIN, словарь `simple` для sl-SI контента.

## Review Follow-ups (AI)

- [x] [AI-Review][Medium] Исправить предупреждения `act()` в SearchContainer тестах (SearchContainer.test.tsx:157)
- [x] [AI-Review][Medium] Вынести логику лайков из SearchContainer в переиспользуемый хук `useLikeToggle` (SearchContainer.tsx:186-234)
- [x] [AI-Review][Medium] Заменить небезопасное приведение типов в searchPosts.ts:25 на типизированный валидатор
- [x] [AI-Review][Medium] Добавить незакоммиченные файлы в git или удалить (supabase/run-custom-seed.js, supabase/seed_gallery_test_2_4.sql)
- [x] [AI-Review][Low] Добавить проверку минимальной длины запроса (>=3 символа) в SearchContainer.tsx:150
- [x] [AI-Review][Low] Рассмотреть возможность использования стандартных паттернов для SearchInput вместо жестких стилей

## Dev Notes

- **Архитектурные паттерны:** Используем клиентские компоненты для SPA-опыта. Данные запрашиваем с клиента через `lib/supabase/client.ts` для обеспечения мгновенного отклика.
- **Debounce:** Очень важно использовать `debounce` на ввод текста, чтобы не заспамить Supabase запросами при быстром наборе.
- **Отображение:** Используем уже существующий `PostCard` для вывода результатов. Важно переиспользовать тот же маппер `dbPostToCardData` для консистентности.
- **Локализация:** Тексты "ничего не найдено" и плейсхолдеры поиска должны быть на словенском языке (sl-SI).

### Project Structure Notes

- Alignment with unified project structure:
  - Маршрут: `src/app/(app)/search/page.tsx`
  - Логика поиска: можно создать `src/features/search/` (или расширить `feed`). Рекомендуется создать отдельный фича-модуль `search`, если поиск будет расширяться.
  - API: `src/features/search/api/search.ts`

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Component Patterns]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.7]
- [Source: src/components/feed/PostCard.tsx]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Fake timers несовместимы с `waitFor` из @testing-library. Решение: мокировать `useDebounce` в тестах SearchContainer, debounce тестировать отдельно в `useDebounce.test.ts`.
- Тип `Post` требует поле `posts_is_liked` (computed column из Supabase) — добавлено в makePost хелпер теста.

### Completion Notes List

- Task 1: Создан маршрут `/search` — `page.tsx` (RSC с Suspense) + `loading.tsx` со скелетонами. SearchInput, EmptyState реализованы внутри SearchContainer (дублирование компонентов нецелесообразно).
- Task 2: `src/features/search/api/search.ts` — `searchPosts()` использует `.textSearch('fts', query, { type: 'websearch', config: 'simple' })`. Запрос включает join `profiles` и `post_media` — совместим с `dbPostToCardData`.
- Task 3: `SearchContainer` — Smart Container с `useDebounce` (400ms), URL-синхронизацией через `useSearchParams`/`useRouter`, оптимистичным обновлением лайков. `useDebounce` выделен в `src/hooks/useDebounce.ts`.
- Task 4: Навигация уже содержала `/search` в `MobileNav` и `DesktopSidebar` — изменений не потребовалось.
- Task 5: Миграция `018_add_fts_to_posts.sql` — generated column `fts tsvector` + GIN индекс. Словарь `simple` — оптимален для sl-SI (нет встроенного словенского в PostgreSQL).
- Все 711 тестов прошли (27 новых), typecheck и lint без ошибок.
- Review Follow-ups (6 шт.): все выполнены — 717 тестов (36 новых), нулевые регрессии.

### File List

- `src/app/(app)/search/page.tsx` (новый)
- `src/app/(app)/search/loading.tsx` (новый)
- `src/features/search/api/search.ts` (новый)
- `src/features/search/components/SearchContainer.tsx` (новый)
- `src/hooks/useDebounce.ts` (новый)
- `src/hooks/useLikeToggle.ts` (новый — рефакторинг логики лайков)
- `src/components/ui/input.tsx` (новый — стандартный Input компонент)
- `supabase/migrations/018_add_fts_to_posts.sql` (новый)
- `tests/unit/features/search/api/search.test.ts` (новый)
- `tests/unit/features/search/components/SearchContainer.test.tsx` (обновлён: act() fixes, MIN_QUERY_LENGTH тест, мок useLikeToggle)
- `tests/unit/hooks/useDebounce.test.ts` (новый)
- `tests/unit/hooks/useLikeToggle.test.ts` (новый — тесты хука лайков)
- `tests/unit/app/search/page.test.tsx` (новый)
- `.gitignore` (обновлён: добавлены seed-утилиты)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (обновлён: 2-7 → review)
