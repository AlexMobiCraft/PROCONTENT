---
title: 'bug-fix: имя автора комментария не отображается'
type: 'bugfix'
created: '2026-06-14'
status: 'done'
route: 'one-shot'
---

## Intent

**Problem:** В комментариях к постам имя автора показывалось как «Uporabnik» (заглушка) вместо реального имени. Причина: запросы профилей выбирали только `display_name`, который у большинства пользователей `null`, игнорируя `first_name`/`last_name` (NOT NULL в БД).

**Approach:** Добавить `first_name` и `last_name` во все select-запросы профилей в цепочке комментариев; обновить логику разрешения имени в `DiscussionNode` — приоритет `display_name`, затем `first_name + last_name`, затем «Uporabnik».

## Suggested Review Order

1. [`src/features/comments/types.ts`](../../src/features/comments/types.ts) — расширенный тип `CommentWithProfile.profiles`
2. [`src/features/comments/components/DiscussionNode.tsx`](../../src/features/comments/components/DiscussionNode.tsx) — новая логика `resolvedName`
3. [`src/features/comments/api/comments.ts`](../../src/features/comments/api/comments.ts) — обновлённый server-select
4. [`src/features/comments/api/clientComments.ts`](../../src/features/comments/api/clientComments.ts) — обновлённый client-select (insert+select)
5. [`src/app/(app)/feed/[id]/page.tsx`](../../src/app/(app)/feed/[id]/page.tsx) — обновлённый select текущего профиля пользователя
6. [`src/components/feed/PostDetail.tsx`](../../src/components/feed/PostDetail.tsx) — тип `UserProfile`
7. [`src/features/comments/hooks/useComments.ts`](../../src/features/comments/hooks/useComments.ts) — тип `UserProfile`
8. [`tests/unit/features/comments/components/DiscussionNode.test.tsx`](../../tests/unit/features/comments/components/DiscussionNode.test.tsx) — обновлённые тест-кейсы
