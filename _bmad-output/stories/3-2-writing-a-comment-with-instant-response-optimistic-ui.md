# Story 3.2: Написание комментария с мгновенным откликом (Optimistic UI)

Status: review

## Story

As a участница,
I want написать свой комментарий или вопрос,
So that получить помощь от комьюнити.

## Acceptance Criteria

1. **Given** поле ввода комментария под постом
2. **When** участница вводит текст и нажимает "Отправить"
3. **Then** комментарий мгновенно появляется в списке (Optimistic update)
4. **And** система отправляет запрос в Supabase для сохранения
5. **And** в случае ошибки сети, комментарий помечается красным с предложением "Повторить отправку"

## Tasks / Subtasks

- [x] Task 1: Database Security (AC: 4)
  - [x] Subtask 1.1: Создать миграцию для добавления RLS-политики `INSERT` для таблицы `post_comments` (создавать могут только авторизованные пользователи с активной подпиской или trial).
- [x] Task 2: Data Access & State Management (AC: 3, 4, 5)
  - [x] Subtask 2.1: Добавить функцию `insertPostComment` в `src/features/comments/api/clientComments.ts`.
  - [x] Subtask 2.2: Создать хук `useComments` (`src/features/comments/hooks/useComments.ts`) для управления состоянием списка комментариев (с поддержкой оптимистичного добавления, обновления ID после сохранения и статусов ошибки/ожидания).
- [x] Task 3: UI Component: Comment Input Form (AC: 1, 2)
  - [x] Subtask 3.1: Создать компонент `CommentForm` (`src/features/comments/components/CommentForm.tsx`) с текстовым полем и кнопкой отправки.
  - [x] Subtask 3.2: Реализовать логику блокировки кнопки при пустом поле или в процессе отправки.
  - [x] Subtask 3.3: Добавить поддержку передачи `parent_id` для возможности отвечать на другие комментарии.
- [x] Task 4: UI Component: Error and Pending States (AC: 5)
  - [x] Subtask 4.1: Обновить `DiscussionNode` для отображения состояния отправки (например, полупрозрачность).
  - [x] Subtask 4.2: Реализовать визуальное выделение комментария с ошибкой сети (красный акцент).
  - [x] Subtask 4.3: Добавить кнопку "Повторить отправку" (Retry) для комментариев со статусом ошибки.
- [x] Task 5: Integration (AC: 1, 2, 3)
  - [x] Subtask 5.1: Интегрировать `CommentForm` под списком комментариев в `PostDetail.tsx`.
  - [x] Subtask 5.2: Интегрировать `CommentForm` в `DiscussionNode.tsx` для кнопки "Ответить" (кнопка "Odgovori" с inline формой).
  - [x] Subtask 5.3: Написать модульные тесты для хука управления комментариями и компонента формы.

## Dev Notes

- **Optimistic UI Pattern:** Сначала добавляйте временный комментарий в локальный стейт (с временным `id`, например генерируемым `crypto.randomUUID()` или префиксом `temp-`, и статусом `status: 'pending'`). Затем делайте запрос в Supabase.
- **Handling Success:** Если запрос успешен - заменяйте временный `id` на реальный из БД и снимайте статус `pending`.
- **Handling Error:** Если возникает ошибка сети - меняйте статус на `status: 'error'`, чтобы UI мог подсветить этот комментарий красным и показать кнопку "Повторить отправку". Пользовательский ввод не должен теряться.
- **Security / RLS:** В Story 3.1 таблица `post_comments` была создана, но RLS для `INSERT` скорее всего отсутствует или ограничена. Обязательно проверьте и добавьте нужную политику (например: `CREATE POLICY "Users can insert comments" ON post_comments FOR INSERT WITH CHECK (auth.uid() = user_id AND public.is_active_subscriber());`).
- **State Management:** Для комментариев лучше использовать локальный стейт внутри `PostDetail` (или специализированный хук `useComments`), так как они специфичны для конкретного поста и не нужны в глобальном сторе `useFeedStore`, чтобы не перегружать его.

### Project Structure Notes

- Локация новых файлов: `src/features/comments/`
- Компоненты UI: `src/features/comments/components/`

### References

- `src/features/comments/components/DiscussionNode.tsx` (из Story 3.1)
- `src/features/comments/api/comments.ts`
- `_bmad-output/planning-artifacts/epics.md#Epic 3: Community Engagement`

## Dev Agent Record

### Implementation Plan

**Task 1 — Database Security:** RLS-политика `post_comments_insert_own` уже существует в миграции `019_create_post_comments.sql`. Новая миграция не создавалась (дубликат не нужен).

**Task 2 — Data Access & State:**
- Создан `src/features/comments/api/clientComments.ts` — клиентская функция `insertPostComment`, использует `createClient()` (browser), вставляет строку с `user_id = auth.uid()` и возвращает `CommentWithProfile` через `.select('*, profiles(...)')`.
- Создан `src/features/comments/hooks/useComments.ts` — хук с тремя вспомогательными tree-функциями (`addToTree`, `replaceInTree`, `updateStatusInTree`). `addComment` оптимистично добавляет с `temp-{uuid}` id, после ответа заменяет на реальный. `retryComment` повторяет отправку провального комментария.

**Task 3 — CommentForm:**
- Создан `src/features/comments/components/CommentForm.tsx` — controlled `<textarea>` + submit button. Кнопка disabled при пустом поле или `isSubmitting`. После успешной отправки форма очищается. Поддерживает `parentId` prop (проброс через `onSubmit`).

**Task 4 — Pending/Error states в DiscussionNode:**
- `_status: 'pending'` → `opacity-60` на inner div, вместо `<time>` — текст "Pošiljanje...", кнопка "Odgovori" скрыта.
- `_status: 'error'` → красный левый бордер (`border-l-2 border-destructive/60`), текст "Napaka pri pošiljanju", кнопка "Poskusi znova" (вызывает `onRetry(comment)`).
- Кнопка "Odgovori" показывается только в нормальном состоянии, при клике показывает inline `CommentForm` и переключается на "Prekliči".

**Task 5 — Интеграция:**
- `PostDetail.tsx` использует `useComments` хук; `CommentsList` получает `onRetry` / `onReply` callbacks; `CommentForm` добавлен после `CommentsList` (только для авторизованных пользователей).
- `page.tsx` ([id]/page.tsx) параллельно загружает комментарии и профиль текущего пользователя, передаёт `currentUserProfile` в `PostDetail` для реалистичных оптимистичных комментариев.
- Типы обновлены: добавлены `CommentStatus`, `CommentWithStatus`, `OptimisticComment` в `types.ts` — совместимы с существующим `Comment` (структурная совместимость TypeScript).

### Completion Notes

- ✅ AC 1-5 полностью выполнены
- ✅ 781 тест, 50 файлов — 0 регрессий (было 746 тестов)
- ✅ TypeScript: 0 ошибок
- ✅ Lint: 0 новых ошибок в моём коде (1 pre-existing `any` в PostDetail.test.tsx строка 570)
- ✅ Новые тесты: `useComments.test.ts` (11 тестов), `CommentForm.test.tsx` (10 тестов), расширен `DiscussionNode.test.tsx` (+13 тестов для pending/error/retry/reply состояний)
- Принято решение не создавать новую миграцию для Task 1 — RLS INSERT-политика уже существует в 019

## File List

- `src/features/comments/types.ts` — добавлены `CommentStatus`, `CommentWithStatus`, `OptimisticComment`
- `src/features/comments/api/clientComments.ts` — новый: `insertPostComment` (client-side)
- `src/features/comments/hooks/useComments.ts` — новый: хук `useComments`
- `src/features/comments/components/CommentForm.tsx` — новый: компонент формы комментария
- `src/features/comments/components/DiscussionNode.tsx` — обновлён: pending/error states, retry, reply button
- `src/features/comments/components/CommentsList.tsx` — обновлён: `OptimisticComment[]`, новые callback props
- `src/components/feed/PostDetail.tsx` — обновлён: интеграция `useComments`, `CommentForm`, `currentUserProfile` prop
- `src/app/(app)/feed/[id]/page.tsx` — обновлён: загрузка профиля пользователя, передача `currentUserProfile`
- `tests/unit/features/comments/hooks/useComments.test.ts` — новый
- `tests/unit/features/comments/components/CommentForm.test.tsx` — новый
- `tests/unit/features/comments/components/DiscussionNode.test.tsx` — расширен

## Change Log

- 2026-03-26: Story 3.2 реализована — `insertPostComment`, `useComments` хук, `CommentForm`, pending/error UI в `DiscussionNode`, интеграция в `PostDetail` и `page.tsx`, 35 новых тестов (всего 781)
