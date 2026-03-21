---
title: 'Функция лайков с персистентностью'
slug: 'post-likes-feature'
created: '2026-03-21'
status: 'done'
stepsCompleted: [1, 2, 3, 4]
tech_stack: ['Next.js 16', 'Supabase', 'Zustand', 'React', 'TypeScript']
files_to_modify: ['src/features/feed/api/posts.ts', 'src/features/feed/api/serverPosts.ts', 'src/features/feed/types.ts', 'src/features/feed/components/FeedContainer.tsx', 'src/features/feed/store.ts', 'supabase/migrations/014_create_post_likes.sql', 'tests/unit/features/feed/components/FeedContainer.test.tsx']
code_patterns: ['Zustand store (setPosts) for local state', 'Optimistic & Synchronized UI update pattern', 'Supabase RPC (toggle_like) returning JSON for atomic mutations', 'Client-side fetching with fetchPosts', 'Debouncing / UI locking with visual loading indication', 'Standard Auth Modal triggers for anonymous interactions']
test_patterns: ['Vitest', '@testing-library/react', 'vi.mock for API layers']
---

# Tech-Spec: Функция лайков с персистентностью

**Created:** 2026-03-21

## Overview

### Problem Statement

В текущей реализации ленты (Story 2.2 Iteration 18) лайки работают исключительно визуально. Компонент `PostCard` содержит внутреннее состояние `isLiked`, однако `FeedContainer` не передаёт обработчик `onLikeToggle` и не выполняет API-запросы. В базе данных существует только счетчик `likes_count` в таблице `posts`, без привязки к конкретным пользователям, что делает невозможным отслеживание "кто лайкнул этот пост" (нет таблицы `post_likes` и поля `is_liked`). 

Также текущий UI никак не защищен от спама кликами (что может завалить БД), падений сети во время запроса и отсутствия обратной связи (loading state) для пользователя.

### Solution

Необходимо реализовать бэкенд и фронтенд для персистентности лайков с учетом граничных условий (caching, cascading deletes, concurrency, UX):
1. Создать таблицу `post_likes` в БД с `(post_id, user_id)` и `ON DELETE CASCADE`. Внедрить триггер для атомарного обновления `likes_count` в `posts`.
2. Добавить `Supabase RPC toggle_like(p_post_id) RETURNS json`, который возвращает итоговый `{ "likes_count", "is_liked" }` для гарантии Source of Truth.
3. Дополнить SQL-запросы (`fetchPosts`, `fetchInitialPostsServer`) Computed полем `is_liked`, объявленным как `STABLE`.
4. Интегрировать оптимистичное точечное обновление в `FeedContainer`. Управлять гонками через `pendingLikes: Set<string>` в `useFeedStore`, передавая `isPending` в `PostCard` для прозрачности (`opacity-50`). По завершении RPC — синхронизировать стейт с возвращенным JSON.
5. Защитить экшен от анонимных пользователей (вызов полноценной модалки логина, а не дешевых алертов).

### Scope

**In Scope:**
- Создание SQL миграции `014_create_post_likes.sql` с RPC `toggle_like` (который возвращает json), констрейнтами CASCADE, и computed_column.
- Обновление функций получения ленты: `fetchPosts`, `fetchInitialPostsServer` (`dynamic` роутинг / SSR кэширование).
- Настройка типов: `src/types/supabase.ts` (после миграции), `src/features/feed/types.ts` с добавлением типа ответа RPC.
- Обновление `FeedContainer` и `store.ts` (оптимистичное + финальное точечное изменение состояния, `pendingLikes` блокировка спама).
- Модификация `PostCard` для визуальной обратной связи при статусе `isPending` (напр., полупрозрачная кнопка) и обработки клика неавторизованным юзером (открытие AuthModal).
- Обновление связанных unit-тестов с обязательной проверкой network failure rollback ТОЧЕЧНО на уровне поста и мокирования ответов RPC.

**Out of Scope:**
- Анимации лайка (за пределами уже существующих в `PostCard` и новой `opacity-50` для pending-стейта).
- Push-уведомления автору поста при лайке.

## Context for Development

### Codebase Patterns

- **Точечные оптимистичные обновления (Zustand):** Метод `updatePost(postId, updates)` в `store.ts` мутирует копию конкретного поста. Если RPC успешен, мы берем `{ is_liked, likes_count }` из ответа RPC и делаем еще один финальный `updatePost`, синхронизируя клиент с БД. При ошибке от RPC откатываемся через сохраненное с начала старое значение.
- **RPC Mutations & Sync:** Прямой вызов `supabase.rpc('toggle_like')`. Возвращается json, так как в транзакционных системах `likes_count` мог измениться между загрузкой страницы и лайком самого юзера. Фронт всегда опирается на ответ базы. 
- **Race Condition & UX Prevention:** Хранение ID постов в сторе: `pendingLikes: string[]`. Если `postId` внутри массива, отключаем pointer-events кнопки лайка и делаем иконку полупрозрачной (визуальный feedback "запрос отправлен").
- **Graceful Auth:** Анонимы видят посты (`is_liked = false`). Клик по лайку перехватывается, стор проверяет `isAuthReady/user`, и если гость — вызывает открытие компонента входа/регистрации (используя стандартный хук авторизационного модала всего приложения).

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `src/features/feed/components/FeedContainer.tsx` | Обработчик `handleLikeToggle`, синхронизация с возвращенным из RPC JSON |
| `src/features/feed/store.ts` | Стейт `posts` (добавить `updatePost`), стейт `pendingLikes` |
| `src/components/feed/PostCard.tsx` | Компонент карточки, добавление disabled/isPending state для лайка |
| `src/features/feed/api/posts.ts` | Клиентские дата-фетчинги (добавляем `is_liked`) |
| `tests/unit/features/feed/components/FeedContainer.test.tsx` | Тестирование 1) rollback-ов, 2) sync-стейта, 3) ui block, 4) unauth redirect |

### Technical Decisions

- **Supabase Computed Column:** Функция `posts_is_liked(posts)` должна быть `STABLE` и выполняться в контексте `invoker`'а. Это сохранит высокую скорость `EXISTS()` запроса, но RLS `post_likes` жестко фильтрует `INSERT/DELETE`.
- **RPC Returns JSON:** Вместо пустого выполнения `toggle_like`, функция должна делать финальный `SELECT count` и статус лайка, чтобы вернуть актуальный срез данных, нивелируя любые "гонки" между клиентами.
- **Cascading Deletes:** Миграция **сурово** требует `ON DELETE CASCADE` для `user_id` и `post_id`, иначе профиль пользователя или пост невозможно будет удалить через API без "висючих" ссылок.

## Implementation Plan

### Tasks

- [x] Task 1: Создать SQL миграцию
  - File: `supabase/migrations/014_create_post_likes.sql`
  - Action: Написать `CREATE TABLE post_likes` с `ON DELETE CASCADE` для FK. Добавить три́ггер `FOR EACH ROW` на `INSERT/DELETE` для обновления `likes_count` в `posts`.
  - Action 2: Создать RPC `toggle_like(p_post_id) RETURNS json`, возвращающий `{ "is_liked": boolean, "likes_count": int }`. Создать `STABLE` функцию `posts_is_liked` для Computed Column.

- [x] Task 2: Обновить типы Supabase
  - File: `src/types/supabase.ts` (и `src/features/feed/types.ts`)
  - Action: Включить `is_liked` (boolean | null) в типы выборки постов. Добавить тип для ответа RPC.

- [x] Task 3: Обновить запросы ленты (API функции)
  - File: `src/features/feed/api/posts.ts` и `src/features/feed/api/serverPosts.ts`
  - Action: Добавить `is_liked: posts_is_liked` в `.select(...)`. Маппинг в `dbPostToCardData`.

- [x] Task 4: Добавить методы updatePost и togglePending в Zustand store
  - File: `src/features/feed/store.ts`
  - Action: Написать `updatePost: (postId, updates)` для безопасного точечного обновления. Добавить логику для управления коллекцией `pendingLikes`.

- [x] Task 5: Интеграция лайка в FeedContainer и PostCard
  - File: `src/features/feed/components/FeedContainer.tsx` и `src/components/feed/PostCard.tsx`
  - Action: В `FeedContainer` добавить `handleLikeToggle`. Процесс: 1) Проверка авторизации (если гость -> показать Auth Modal -> exit), 2) Добавить `postId` в `pendingLikes`. 3) Сделать Оптимистичный `updatePost`. 4) Вызвать RPC, дождаться ответа. 5) Если успех -> финально синхронизировать стейт `updatePost` из JSON. Если catch -> `updatePost` на старое значение. 6) finally убрать из `pending`.
  - Action 2: `PostCard` принимает проп `isPending` и блокирует себя плюс делает иконку полупрозрачной.

- [x] Task 6: Обновление Unit тестов
  - File: `tests/unit/features/feed/components/FeedContainer.test.tsx`
  - Action: Напишите тесты: 1) Успешный синхрон с JSON ответом (RPC mock), 2) точечный откат при ошибке, 3) игнорирование кликов (заблокированная кнопка), если `postId` в `pendingLikes`, 4) вызов хука авторизации для гостя.

### Acceptance Criteria

- [x] AC 1: Given авторизованный пользователь, when ставит лайк, then счетчик растет моментально, кнопка становится полупрозрачной до ответа от сети (UI block), после чего стейт жестко синхронизируется с сервером.
- [x] AC 2: Given отвал сети (RPC error), when юзер ставит лайк, then стейт лайка КОНКРЕТНОГО поста откатывается к прошлому значению, не повреждая данные других постов, полученных пагинацией.
- [x] AC 3: Given быстрый клик 5 раз, when срабатывает хендлер, then на сервер летит строго 1 запрос благодаря проверке `isPending`, остальные блокируются.
- [x] AC 4: Given неавторизованный юзер, when грузится лента, then у всех постов `is_liked = false`.
- [x] AC 5: Given неавторизованный юзер, when нажимает лайк, then UI перехватывает событие (блокирует запрос к БД) и показывает штатное модальное окно Авторизации.

## Additional Context

### Dependencies
- `@supabase/supabase-js`, `zustand`

### Testing Strategy
- **Unit tests:** Использовать `vi.mock` для изоляции RPC лоера. Проверить все три стадии `handleLikeToggle`: optimistic update `->` success sync from json / error rollback.

### Notes
Все уязвимости, найденные в ходе Adversarial Review и доработки UX/БД из сессии Party Mode залатаны. Эта спецификация является образцом надежной архитектуры и готова к реализации в `quick-dev`! 🚀
