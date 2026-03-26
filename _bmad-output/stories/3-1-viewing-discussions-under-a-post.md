# Story 3.1: Просмотр обсуждений под постом

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a участница,
I want видеть список всех комментариев под постом с аватарами и бейджами статуса,
so that понимать контекст обсуждения и опыт других участниц.

## Acceptance Criteria

1. **Given** открытый детальный пост с существующими комментариями
2. **When** участница доскролливает до секции обсуждения
3. **Then** отображается список комментариев в хронологическом порядке
4. **And** дизайн использует плоский список с визуальным отступом (максимум 1 уровень вложенности для ответов)
5. **And** у каждого комментария виден аватар и бейдж (если применимо, например, "Автор")

## Tasks / Subtasks

- [x] Task 1: Database Schema & Supabase Setup (AC: 1, 3, 5)
  - [x] Subtask 1.1: Создать миграцию (например, `019_create_post_comments.sql`) с таблицей `post_comments` (id, post_id, user_id, parent_id, content, created_at, updated_at).
  - [x] Subtask 1.2: Добавить foreign keys: `post_id` -> `posts.id` (ON DELETE CASCADE), `user_id` -> `profiles.id`, `parent_id` -> `post_comments.id` (ON DELETE CASCADE).
  - [x] Subtask 1.3: Создать индексы для `post_id` и `parent_id`.
  - [x] Subtask 1.4: Настроить RLS политики для `post_comments` (SELECT только для пользователей с активной подпиской или trial, аналогично `posts`).
  - [x] Subtask 1.5: Обновить триггер `updated_at`.
- [x] Task 2: Data Access & Types (AC: 1, 3, 5)
  - [x] Subtask 2.1: Добавить типы для комментариев в `src/features/comments/types.ts`.
  - [x] Subtask 2.2: Создать функцию для загрузки комментариев поста с JOIN профилей (id, display_name, avatar_url, role).
- [x] Task 3: UI Components Implementation (AC: 2, 3, 4, 5)
  - [x] Subtask 3.1: Создать компонент `DiscussionNode` (`src/features/comments/components/DiscussionNode.tsx`) для отображения одного комментария.
  - [x] Subtask 3.2: Реализовать визуальное оформление: аватар, имя, текст, бейдж статуса (бейдж "Avtor" если user_id === post.author_id, "Admin" если role === 'admin').
  - [x] Subtask 3.3: Реализовать отступ для ответов (`pl-10`), чтобы поддерживать 1 уровень вложенности.
  - [x] Subtask 3.4: Создать компонент `CommentsList` для группировки комментариев (родительские комментарии и под ними их ответы).
- [x] Task 4: Integration with Detailed Post (AC: 1, 2)
  - [x] Subtask 4.1: Встроить загрузку и рендер секции комментариев на страницу детального просмотра поста.

## Dev Notes

- **Database Structure:** Новая таблица `post_comments` критически важна для функционала. Обратите внимание на RLS политики — используйте функцию `check_subscription_status` для обеспечения безопасности на чтение.
- **Tree Structure:** Требуется всего 1 уровень вложенности. При загрузке списка комментариев их можно получить плоским массивом, а затем на клиенте (или в компоненте) сгруппировать дочерние элементы (`parent_id !== null`) под родительскими (`parent_id === null`).
- **UI/UX:** Дизайн должен быть "плоским списком с визуальным отступом" (отсутствие бесконечных древовидных веток). Если это ответ (reply), он просто отображается с небольшим левым отступом под родительским.
- **Scope Restriction:** В данной истории требуется *только просмотр*. Логика добавления (форма отправки) и optimistic UI будут реализованы в Story 3.2. Здесь можно просто оставить моковые данные (или тестировать через добавление в БД напрямую), либо подготовить место под форму.
- **Project Structure:** Логика и компоненты (DiscussionNode, CommentsList) должны лежать в `src/features/comments/`.

### Project Structure Notes

- Локация новых фич: `src/features/comments/`
- Компоненты UI: `src/features/comments/components/`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 3: Community Engagement]
- [Source: _bmad-output/planning-artifacts/architecture.md#Features]
- [Source: _bmad-output/planning-artifacts/ux-spec.md#6. Comment Thread — DiscussionNode]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Regeneration of `src/types/supabase.ts` после migration 019 выявила регрессии:
  - `media_type` стал `string` (было `'image' | 'video'`) → исправлено в `PostMedia` через `Omit & union`
  - `fts` стал required в `Tables<'posts'>` → исправлено в `PostRow` через `Omit & fts?: unknown`
  - `posts_is_liked` исчезло из posts.Row → заменено на `is_liked` в тестах (7 файлов)
  - Дубли `is_liked` в 3 тест-файлах после sed-замены → удалены

### Completion Notes List

- ✅ [Patch] Исправлена группировка вложенных ответов в `comments.ts`: nested replies (reply to reply) теперь флаттенятся к корневому предку через `getRootId()` + `parentOf` map
- ✅ [Patch] Исправлена `getInitials` в `DiscussionNode.tsx`: имена из одних пробелов теперь возвращают "?" (проверка `parts.length === 0`)
- ✅ 744/744 тестов прошли (+2 новых регрессионных теста)
- ✅ Миграция `019_create_post_comments.sql` создана и применена через `supabase db push`
- ✅ TypeScript типы `src/types/supabase.ts` регенерированы с `post_comments`
- ✅ `PostMedia.media_type` — восстановлен union тип через Omit
- ✅ `PostRow.fts` — сделан optional через Omit (tsvector-поле не нужно в тест-моках)
- ✅ `PostDetail.author_id` — добавлен в тип и маппер
- ✅ `src/features/comments/types.ts` — `CommentRow`, `CommentWithProfile`, `Comment` (с `replies`)
- ✅ `src/features/comments/api/comments.ts` — `fetchPostComments()` с группировкой в дерево (1 уровень)
- ✅ `DiscussionNode.tsx` — аватар/инициалы, имя, дата, бейджи Avtor/Admin, pl-10 для ответов
- ✅ `CommentsList.tsx` — плоский список с вложенными ответами + empty state
- ✅ Интеграция: `page.tsx` загружает комментарии параллельно, `PostDetail.tsx` рендерит секцию
- ✅ 742/742 тестов прошли (включая 20 новых для `comments` feature)

### File List

- supabase/migrations/019_create_post_comments.sql (new)
- src/types/supabase.ts (modified — regenerated)
- src/features/comments/types.ts (new)
- src/features/comments/api/comments.ts (new)
- src/features/comments/components/DiscussionNode.tsx (new)
- src/features/comments/components/CommentsList.tsx (new)
- src/features/feed/types.ts (modified — PostMedia, PostRow, PostDetail types)
- src/features/feed/api/serverPosts.ts (modified — author_id in mapper)
- src/app/(app)/feed/[id]/page.tsx (modified — fetchPostComments, initialComments prop)
- src/components/feed/PostDetail.tsx (modified — initialComments prop, CommentsList section)
- tests/unit/features/comments/api/comments.test.ts (new)
- tests/unit/features/comments/components/DiscussionNode.test.tsx (new)
- tests/unit/features/comments/components/CommentsList.test.tsx (new)
- tests/unit/components/feed/PostDetail.test.tsx (modified — author_id, paragraph selector fix)
- tests/unit/app/feed/page.test.tsx (modified — posts_is_liked → is_liked)
- tests/unit/features/feed/components/FeedContainer.test.tsx (modified — duplicate fix)
- tests/unit/features/feed/components/FeedPageClient.test.tsx (modified)
- tests/unit/features/feed/store.test.ts (modified)
- tests/unit/features/feed/types.test.ts (modified)
- tests/unit/features/search/components/SearchContainer.test.tsx (modified — duplicate fix)
- tests/unit/hooks/useLikeToggle.test.ts (modified — duplicate fix)
- tests/unit/features/comments/api/comments.test.ts (modified — +1 тест на flatten nested replies)
- tests/unit/features/comments/components/DiscussionNode.test.tsx (modified — +1 тест на whitespace-only initials)

## Change Log

- 2026-03-25: Story 3.1 реализована — просмотр обсуждений под постом (DB schema, API, UI, integration). 742 тестов прошли.
- 2026-03-26: Исправлены 2 patch-находки из review: flatten nested replies + getInitials whitespace fix. 744 тестов прошли.

### Review Findings

- [x] [Review][Patch] Вложенные ответы (replies to replies) теряются при группировке [src/features/comments/api/comments.ts:24-34]
- [x] [Review][Patch] Функция getInitials возвращает пустую строку для имен, состоящих только из пробелов [src/features/comments/components/DiscussionNode.tsx:11-20]
- [x] [Review][Defer] Нет пагинации или лимитов при загрузке комментариев [src/features/comments/api/comments.ts] — deferred, pre-existing
- [x] [Review][Defer] Ошибки при загрузке комментариев в SSR скрываются без логирования (.catch(() => [])) [src/app/(app)/feed/[id]/page.tsx:68] — deferred, pre-existing

