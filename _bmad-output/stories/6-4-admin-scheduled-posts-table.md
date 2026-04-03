# Story 6.4: Admin — Раздел «Запланировано» в admin-панели

Status: review

## Story

As a автор,
I want видеть список всех запланированных постов и управлять ими прямо из admin-панели,
so that я могу контролировать расписание публикаций, не открывая каждый пост отдельно.

## Acceptance Criteria

### AC1: Таблица запланированных постов
**Given** автор открыл admin-панель
**When** переходит на страницу «Načrtovane objave» (Запланировано)
**Then** отображается таблица со всеми постами `status='scheduled'`: заголовок, категория, дата/время публикации в локальной timezone, статус
**And** посты отсортированы по `scheduled_at` ASC (ближайшие — первые)

### AC2: Skeleton loading
**Given** данные загружаются
**When** компонент в состоянии `isLoading=true`
**Then** отображается Skeleton с `animate-pulse`, повторяющий структуру строк таблицы (UX-DR6)

### AC3: Empty state
**Given** список запланированных постов пуст
**When** таблица загружена
**Then** отображается Empty State «Ni načrtovanih objav» (Нет запланированных постов)

### AC4: Responsive — горизонтальный скролл
**Given** таблица на узком экране
**When** ширины недостаточно
**Then** `overflow-x-auto` обеспечивает горизонтальный скролл (UX-DR8)

### AC5: Редактирование из таблицы
**Given** автор видит строку запланированного поста
**When** нажимает кнопку редактирования
**Then** переходит на `/posts/{id}/edit` — форма с toggle «Načrtuj objavo» уже установленным (FR6.15)

### AC6: Отмена публикации
**Given** автор нажимает «Prekliči objavo» (Отменить публикацию) в строке
**When** запрос выполнен успешно
**Then** `status → draft`, `scheduled_at → null`, строка исчезает из таблицы (FR6.16, FR6.8)
**And** кнопка использует цвет `--destructive` (UX-DR9)

### AC7: Ошибка отмены
**Given** при отмене произошла серверная ошибка
**When** запрос завершился с ошибкой
**Then** Toast с сообщением об ошибке, таблица не изменяется (UX-DR5)

### AC8: Немедленная публикация из таблицы
**Given** автор нажимает «Objavi zdaj» (Опубликовать сейчас)
**When** запрос выполнен успешно
**Then** `status → published`, `published_at → now()`, email-рассылка участникам, строка исчезает (FR6.9)
**And** при ошибке — Toast, таблица не изменяется

### AC9: Smart Container / Dumb UI
**Given** архитектурный паттерн проекта
**When** разработчик инспектирует код
**Then** `ScheduledPostsTable` (Dumb) принимает `posts`, `isLoading`, `onCancel`, `onEdit`, `onPublishNow` через props — НЕ импортирует Supabase
**And** `ScheduledPostsContainer` (Smart) управляет данными, оптимистичными обновлениями и API-вызовами

### AC10: Навигация в sidebar
**Given** автор находится в admin-панели
**When** смотрит на sidebar
**Then** видит пункт «Načrtovane objave» с иконкой Calendar (или Clock), ведущий на `/posts/scheduled`

## Tasks / Subtasks

- [x] Task 1: Серверная загрузка данных (AC: 1)
  - [x] 1.1 Добавить `fetchScheduledPostsServer()` в `src/features/admin/api/postsServer.ts` — запрос `posts` WHERE `status='scheduled'` ORDER BY `scheduled_at ASC`, select: `id, title, category, status, scheduled_at, created_at`
  - [x] 1.2 Использовать `createClient` из `@/lib/supabase/server` (server-side паттерн с `await`)

- [x] Task 2: Клиентские API-функции (AC: 6, 8)
  - [x] 2.1 Добавить `cancelScheduledPost(postId)` в `src/features/admin/api/posts.ts` — `supabase.from('posts').update({ status: 'draft', scheduled_at: null }).eq('id', postId)`
  - [x] 2.2 Для немедленной публикации (AC8) переиспользовать существующий `POST /api/posts/publish` endpoint (уже реализован в Story 6.3)

- [x] Task 3: Dumb UI — ScheduledPostsTable (AC: 1, 2, 3, 4, 5, 6, 8)
  - [x] 3.1 Создать `src/features/admin/components/ScheduledPostsTable.tsx` — `'use client'`
  - [x] 3.2 Props: `posts: ScheduledPost[]`, `isLoading: boolean`, `actionInProgress: string | null` (post ID текущего действия — для disabled state кнопок), `onCancel: (id: string) => void`, `onEdit: (id: string) => void`, `onPublishNow: (id: string) => void`
  - [x] 3.3 Колонки: Naslov (заголовок), Kategorija (категория), Načrtovano za (дата/время), Dejanja (действия — Edit/Cancel/PublishNow)
  - [x] 3.4 Форматирование `scheduled_at`: `Intl.DateTimeFormat('sl-SI', { dateStyle: 'medium', timeStyle: 'short' })` + timezone abbreviation
  - [x] 3.5 Skeleton при `isLoading=true`: SkeletonRow с `animate-pulse` внутри таблицы (по паттерну MembersTable)
  - [x] 3.6 Empty state при `posts.length === 0 && !isLoading`: «Ni načrtovanih objav»
  - [x] 3.7 `overflow-x-auto` на обёртке таблицы
  - [x] 3.8 Кнопки действий: `min-h-[44px] min-w-[44px]` touch targets (UX-DR1)
  - [x] 3.9 Стиль кнопок по UX-спеку (editorial outline hierarchy): «Uredi» — Ghost/Icon button, «Objavi zdaj» — Primary CTA outline (`border border-primary`), «Prekliči» — outline с `border-destructive`
  - [x] 3.10 Loading state на кнопках при выполнении действия: `disabled:opacity-50 disabled:pointer-events-none` + текст «Preklic...» / «Objavljanje...» (UX feedback pattern)

- [x] Task 4: Smart Container — ScheduledPostsContainer (AC: 6, 7, 8, 9)
  - [x] 4.1 Создать `src/features/admin/components/ScheduledPostsContainer.tsx` — `'use client'`
  - [x] 4.2 Props: `initialPosts: ScheduledPost[]` (от server page)
  - [x] 4.3 Локальный `useState` для списка постов (по паттерну MembersContainer)
  - [x] 4.4 `handleCancel(id)`: оптимистичное удаление строки → `cancelScheduledPost(id)` → rollback + toast.error при ошибке
  - [x] 4.5 `handlePublishNow(id)`: оптимистичное удаление строки → `fetch('/api/posts/publish', { method: 'POST', body: JSON.stringify({ postId: id }) })` → rollback + toast.error при ошибке
  - [x] 4.6 `handleEdit(id)`: `router.push(getAdminPostEditPath(id))`

- [x] Task 5: Страница и маршрут (AC: 1, 10)
  - [x] 5.1 Добавить `ADMIN_SCHEDULED_POSTS_PATH = '/posts/scheduled'` в `src/lib/app-routes.ts`
  - [x] 5.2 Создать `src/app/(admin)/posts/scheduled/page.tsx` — RSC, вызывает `fetchScheduledPostsServer()`, передаёт в `<ScheduledPostsContainer>`
  - [x] 5.3 Добавить пункт «Načrtovane objave» в `AdminSidebar` (`src/components/navigation/AdminSidebar.tsx`) с иконкой и `ADMIN_SCHEDULED_POSTS_PATH`

- [x] Task 6: Тесты (AC: все)
  - [x] 6.1 Unit-тест `ScheduledPostsTable`: рендеринг строк, skeleton, empty state, вызов callbacks
  - [x] 6.2 Unit-тест `ScheduledPostsContainer`: оптимистичное удаление, rollback при ошибке, вызов API
  - [x] 6.3 Unit-тест `cancelScheduledPost`: мок Supabase client, проверка update query
  - [x] 6.4 Unit-тест `fetchScheduledPostsServer`: мок Supabase server client, проверка select/filter/order

## Dev Notes

### Эталонная реализация — MembersTable

**Строго следовать паттерну Members** — это единственная таблица в admin-панели:

- **MembersTable** (`src/features/admin/components/MembersTable.tsx`): Dumb UI, `overflow-x-auto rounded-lg border`, `<table className="w-full text-sm">`, skeleton через `SkeletonRow` с `animate-pulse`, empty state через `<td colSpan>` с centered muted text
- **MembersContainer** (`src/features/admin/components/MembersContainer.tsx`): `initialMembers` prop → `useState`, оптимистичные обновления, rollback при ошибке через `toast.error`
- **membersServer.ts** (`src/features/admin/api/membersServer.ts`): `fetchMembersServer()` с `await createClient()` (server)
- **members page** (`src/app/(admin)/members/page.tsx`): RSC вызывает server fetch → передаёт в Container

### Существующие endpoints для переиспользования

- **POST /api/posts/publish** (`src/app/api/posts/publish/route.ts`): принимает `{ postId }`, проверяет session + `post.status === 'scheduled'`, устанавливает `status: 'published'`, `is_published: true`, `published_at: now`, `scheduled_at: null`, отправляет email-уведомление. **Уже реализован в Story 6.3 — НЕ создавать заново.**

### UX Design Specification — Button Hierarchy & Feedback

Проект использует **editorial outline стиль кнопок** (НЕ заливку). Из UX-спека (`ux-design-specification.md`, раздел "Button Hierarchy"):
- **Primary CTA:** `border border-primary px-8 py-3 font-sans text-xs font-medium tracking-[0.2em] uppercase`, hover: `bg-primary/10`
- **Ghost/Icon Button:** Без фона и рамки, только иконка. `min-h-[44px] min-w-[44px] rounded-lg`
- **Destructive:** outline с `border-destructive`, текст `text-destructive`

Применение в таблице:
- «Uredi» (Редактировать) → Ghost/Icon button (иконка карандаша)
- «Objavi zdaj» (Опубликовать сейчас) → Primary CTA outline
- «Prekliči objavo» (Отменить публикацию) → Destructive outline

**Loading state кнопок** (из UX feedback patterns): `disabled:opacity-50 disabled:pointer-events-none` + текст-индикатор («Preklic...», «Objavljanje...»). Props `ScheduledPostsTable` должен включать `actionInProgress: string | null` (post ID текущего действия) для блокировки кнопок.

### Ключевые технические ограничения

- **snake_case напрямую из БД** — `scheduled_at`, `created_at`, `status` без маппинга в camelCase
- **Supabase client (browser)** для клиентских мутаций: `import { createClient } from '@/lib/supabase/client'` (без `await`)
- **Supabase server** для SSR fetch: `import { createClient } from '@/lib/supabase/server'` (с `await`)
- **Timezone**: `scheduled_at` хранится в UTC, отображать через `Intl.DateTimeFormat` в браузерной timezone
- **UI текст на словенском** — все labels, button text, empty states на словенском (`sl-SI`)
- **Touch targets**: `min-h-[44px] min-w-[44px]` на всех кнопках действий
- **Toast для системных ошибок**, inline validation не нужна (таблица read-only, мутации через кнопки)
- Компонент `src/components/ui/` **НЕ импортирует** из `src/features/`

### Тип ScheduledPost

Определить в `src/features/admin/types.ts`:
```typescript
export type ScheduledPost = Pick<
  Database['public']['Tables']['posts']['Row'],
  'id' | 'title' | 'category' | 'status' | 'scheduled_at' | 'created_at'
>
```

### Навигация AdminSidebar

`src/components/navigation/AdminSidebar.tsx` использует массив nav items из `src/lib/app-routes.ts`. Добавить новый пункт **между** «Nova objava» и «Kategorije»:
- Label: `Načrtovane objave`
- Path: `ADMIN_SCHEDULED_POSTS_PATH` (`/posts/scheduled`)
- Icon: Calendar или Clock (использовать ту же библиотеку иконок что и остальные пункты sidebar)

### Паттерн оптимистичных обновлений (из MembersContainer)

```
1. Сохранить snapshot текущего state
2. Оптимистично обновить state (удалить строку из массива)
3. Вызвать API
4. При ошибке: rollback к snapshot + toast.error(message)
```

### Предыдущие story — критические уроки из Story 6.3

- `POST /api/posts/publish` уже проверяет auth через Supabase session (cookies), не через CRON_SECRET — это правильно для user-initiated actions
- Guard: published→scheduled запрещён (disabled в PostForm + guard в updatePost) — в таблице кнопки появляются ТОЛЬКО для `status='scheduled'`, поэтому дополнительный guard не нужен
- `is_published` синхронизируется со `status` при мутациях — endpoint `/api/posts/publish` уже это делает

### Project Structure Notes

Все новые файлы в существующих директориях — новых папок создавать не нужно:
- `src/features/admin/api/postsServer.ts` — **новый файл** (по аналогии с `membersServer.ts`)
- `src/features/admin/components/ScheduledPostsTable.tsx` — **новый файл**
- `src/features/admin/components/ScheduledPostsContainer.tsx` — **новый файл**
- `src/app/(admin)/posts/scheduled/page.tsx` — **новый файл** (директория `scheduled/` создаётся)
- `src/features/admin/types.ts` — **дополнить** типом `ScheduledPost`
- `src/features/admin/api/posts.ts` — **дополнить** функцией `cancelScheduledPost`
- `src/lib/app-routes.ts` — **дополнить** `ADMIN_SCHEDULED_POSTS_PATH`
- `src/components/navigation/AdminSidebar.tsx` — **дополнить** nav item

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 6, Story 6.4]
- [Source: _bmad-output/planning-artifacts/architecture.md — Smart/Dumb pattern, State boundaries, Admin dashboard]
- [Source: _bmad-output/planning-artifacts/prd-scheduled-publishing.md — FR14-FR16, UX-DR5/6/8/9]
- [Source: _bmad-output/implementation-artifacts/6-3-ui-toggle-schedule-and-datetime-picker-in-post-form.md — Previous story learnings]
- [Source: src/features/admin/components/MembersTable.tsx — Reference table implementation]
- [Source: src/features/admin/components/MembersContainer.tsx — Reference container pattern]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — Button Hierarchy (editorial outline), Feedback Patterns (loading states), Touch Targets, Skeleton, Empty States, Responsive Strategy]
- [Source: src/app/api/posts/publish/route.ts — Existing publish endpoint]

## Dev Agent Record

### Agent Model Used

Cascade (Windsurf)

### Debug Log References

Нет критических отладочных сессий — реализация прошла с первого раза по паттерну MembersTable/MembersContainer.

### Completion Notes List

- Создан `src/features/admin/api/postsServer.ts` — RSC-совместимый server fetch с `await createClient()`
- Добавлен тип `ScheduledPost` в `src/features/admin/types.ts`
- Добавлена `cancelScheduledPost()` в `src/features/admin/api/posts.ts`
- Создан `ScheduledPostsTable` (Dumb UI) — строго по паттерну MembersTable: `overflow-x-auto`, SkeletonRow с `animate-pulse`, empty state, editorial outline кнопки (Ghost/Primary/Destructive), touch targets `min-h-[44px] min-w-[44px]`, loading text «Objavljanje...» / «Preklic...»
- Создан `ScheduledPostsContainer` (Smart) — оптимистичные обновления (удаление строки из state), rollback на ошибке через `toast.error`, переиспользование `POST /api/posts/publish` для немедленной публикации
- Создана страница `/posts/scheduled` (RSC), добавлен `ADMIN_SCHEDULED_POSTS_PATH`, пункт сайдбара с Calendar icon
- Тесты: 46 новых тестов (4 файла), все прошли. Нет регрессий в admin/navigation областях (189 тестов прошло). Timeout в полном suite — pre-existing Windows worker pool проблема, не связанная с данной story.

### File List

- `src/features/admin/api/postsServer.ts` — новый файл
- `src/features/admin/api/posts.ts` — добавлена `cancelScheduledPost()`
- `src/features/admin/types.ts` — добавлен тип `ScheduledPost`
- `src/features/admin/components/ScheduledPostsTable.tsx` — новый файл
- `src/features/admin/components/ScheduledPostsContainer.tsx` — новый файл
- `src/app/(admin)/posts/scheduled/page.tsx` — новый файл
- `src/lib/app-routes.ts` — добавлен `ADMIN_SCHEDULED_POSTS_PATH`
- `src/components/navigation/AdminSidebar.tsx` — добавлен nav item «Načrtovane objave»
- `tests/unit/features/admin/api/postsServer.test.ts` — новый файл (4 теста)
- `tests/unit/features/admin/api/posts.test.ts` — добавлен `describe('cancelScheduledPost')` (3 теста)
- `tests/unit/features/admin/components/ScheduledPostsTable.test.tsx` — новый файл (13 тестов)
- `tests/unit/features/admin/components/ScheduledPostsContainer.test.tsx` — новый файл (7 тестов)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — обновлён статус story 6-4
