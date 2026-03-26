# Story 3.3: Модерация и ответы на комментарии (Админ-функции)

Status: review

## Story

As a автор,
I want иметь возможность отвечать конкретным участницам или удалять неуместные комментарии,
So that поддерживать здоровую и полезную атмосферу в клубе.

## Acceptance Criteria

1. **Given** авторизованный пользователь с ролью `admin`
2. **When** она просматривает ветку комментариев
3. **Then** под каждым чужим комментарием доступна кнопка "Ответить" и иконка "Удалить" (Trash)
4. **And** при удалении комментарий скрывается из базы и интерфейса с подтверждением через Toast
5. **And** ответ автора визуально выделяется (например, акцентной рамкой или бейджем)

## Tasks / Subtasks

- [x] Task 1: UI Component: Delete Button & Admin Mode (AC: 1, 2, 3)
  - [x] Subtask 1.1: Прокинуть проп `isAdmin` или данные о правах текущего пользователя в `DiscussionNode`.
  - [x] Subtask 1.2: Если пользователь `admin` (или автор поста), добавить иконку "Удалить" (Trash) для чужих комментариев (или возможность удалять любые).
  - [x] Subtask 1.3: Убедиться, что кнопка "Ответить" (Odgovori) доступна под чужими комментариями для автора/админа. *(Примечание: базовая логика onReply уже есть, нужна лишь проверка условий показа)*.
- [x] Task 2: Data Access & State Management (AC: 4)
  - [x] Subtask 2.1: Добавить функцию `deletePostComment(commentId: string)` в `src/features/comments/api/clientComments.ts`.
  - [x] Subtask 2.2: Обновить хук `useComments` для поддержки функции удаления (оптимистичное удаление из дерева или показ состояния загрузки перед удалением).
  - [x] Subtask 2.3: При успешном удалении показывать Toast уведомление и окончательно убирать комментарий из UI.
- [x] Task 3: UI Component: Visual Highlight (AC: 5)
  - [x] Subtask 3.1: В `DiscussionNode` добавить акцентную рамку или специальный фон (например, `bg-primary/5` или левый border) для комментариев, где `role === 'admin'` или `isAuthor === true`. *(Бейджи уже реализованы, требуется дополнительное визуальное выделение)*.
- [x] Task 4: Integration & Security (AC: 4)
  - [x] Subtask 4.1: Интегрировать вызов `deletePostComment` в обработчик клика по кнопке "Удалить" (с подтверждением `window.confirm`).
  - [x] Subtask 4.2: Убедиться, что RLS `DELETE` политика работает корректно (согласно миграции 019: `auth.uid() = user_id OR admin`). Миграцию БД создавать не нужно.
  - [x] Subtask 4.3: Обновить модульные тесты для `DiscussionNode.test.tsx` (проверка кнопки Trash и выделения) и `useComments.test.ts` (проверка удаления).

## Dev Notes

- **Delete Button:** Используйте иконку Trash из `lucide-react`. При клике используйте `confirm()` перед удалением или диалоговое окно, чтобы избежать случайных нажатий.
- **Visual Highlight:** В `DiscussionNode` уже есть бейджи "Admin" и "Avtor". Добавьте CSS-классы к `article` или внутреннему `div` для визуального выделения (например, `bg-primary/5 rounded-lg border border-primary/20 p-2`).
- **RLS:** Политика `"post_comments_delete_own_or_admin"` уже была создана в миграции `019_create_post_comments.sql`. Она позволяет удалять комментарий владельцу или админу. Дополнительные миграции БД не требуются.
- **Integration:** В `PostDetail.tsx` передайте нужные права (например `currentUserProfile?.role === 'admin'`) и callback `onDelete` вниз к `CommentsList` и `DiscussionNode`.

### Project Structure Notes

- Локация файлов: `src/features/comments/`
- API клиент: `src/features/comments/api/clientComments.ts`
- Хук стейта: `src/features/comments/hooks/useComments.ts`
- UI: `src/features/comments/components/DiscussionNode.tsx`

### References

- `src/features/comments/components/DiscussionNode.tsx`
- `src/features/comments/api/clientComments.ts`
- `supabase/migrations/019_create_post_comments.sql`
- `_bmad-output/planning-artifacts/epics.md#Epic 3: Community Engagement`

## Dev Agent Record

### Implementation Plan

1. `clientComments.ts` — добавлена `deletePostComment(commentId)`: удаляет через Supabase `.delete().eq('id', commentId)`, опирается на RLS политику из миграции 019.
2. `useComments.ts` — добавлены: helper `removeFromTree`, функция `deleteComment` с оптимистичным удалением и rollback при ошибке. Паттерн snapshot через `setComments` callback.
3. `DiscussionNode.tsx` — добавлены пропсы `currentUserId`, `currentUserIsAdmin`, `onDelete`. Trash кнопка (Trash2 из lucide-react) показывается когда `onDelete` передан и `comment.user_id !== currentUserId && !isPending`. `window.confirm` в click handler. Визуальное выделение (`rounded-lg border border-primary/20 bg-primary/5 p-2`) на article когда `showBadge` (admin/author).
4. `CommentsList.tsx` — прокинуты `currentUserId`, `currentUserIsAdmin`, `onDelete` в `DiscussionNode`.
5. `PostDetail.tsx` — вычислен `currentUserIsAdmin`, `canModerate`; добавлена `handleDelete` с try/catch + toast.success/error; `onDelete={canModerate ? handleDelete : undefined}`.

### Completion Notes

- Все 5 AC выполнены
- 794 тестов прошли (регрессий нет)
- Новые тесты: 11 в `DiscussionNode.test.tsx` + 4 в `useComments.test.ts`
- Lint: предсуществующая ошибка в `PostDetail.test.tsx:570` (не в scope данной истории)
- TypeScript: typecheck пройден без ошибок

## File List

- `src/features/comments/api/clientComments.ts` (изменён — добавлена `deletePostComment`)
- `src/features/comments/hooks/useComments.ts` (изменён — `removeFromTree`, `deleteComment`)
- `src/features/comments/components/DiscussionNode.tsx` (изменён — Trash кнопка, visual highlight, новые пропсы)
- `src/features/comments/components/CommentsList.tsx` (изменён — новые пропсы)
- `src/components/feed/PostDetail.tsx` (изменён — `handleDelete`, `canModerate`)
- `tests/unit/features/comments/components/DiscussionNode.test.tsx` (изменён — 11 новых тестов)
- `tests/unit/features/comments/hooks/useComments.test.ts` (изменён — 4 новых теста)

## Change Log

- 2026-03-26: Story 3.3 реализована (модерация комментариев, Trash кнопка, визуальное выделение, оптимистичное удаление, тесты)
