# Story 4.2: Управление категориями и рубриками постов

Status: review

## Story

As a автор,
I want создавать рубрики и присваивать их постам при публикации,
So that структурировать базу знаний.

## Acceptance Criteria

1. **Создание новых категорий:**
   **Given** интерфейс управления постами или глобальными настройками
   **When** автор вводит название новой категории (например, "#insight") и нажимает "Добавить"
   **Then** категория сохраняется в список доступных тегов (через API или отдельную таблицу БД / Enum)
   **And** система не позволяет создавать дубликаты существующих категорий (показывает Toast или инлайн-ошибку)

2. **Присвоение категории при создании поста:**
   **Given** форма создания/редактирования поста (`PostForm.tsx`)
   **When** автор доходит до поля "Категория/Рубрика"
   **Then** он видит выпадающий список (Select/Combobox) всех существующих в системе категорий
   **And** может выбрать только одну категорию для поста

3. **Отображение категории в постах:**
   **Given** опубликованный пост
   **When** участница просматривает ленту
   **Then** у поста корректно отображается присвоенная ему категория в виде "таблетки" (Pill)
   **And** при клике на неё происходит фильтрация ленты по этой категории

## Technical Constraints & Developer Context

### Architecture Compliance
- **Smart Container / Dumb UI**: Компонент управления категориями (если отдельная страница) или выпадающий список (если внутри формы) должны разделять логику запросов (Smart) и визуальное представление (Dumb).
- **State Management**: Список категорий лучше запрашивать через `useQuery` (или аналог в зависимости от используемого подхода), чтобы не перегружать глобальный `Zustand` стор, если эти данные нужны только в форме и фильтрах. Однако, для фильтров в ленте (`FeedContainer`) категории могут кэшироваться.
- **Error Handling**: Системные ошибки (ошибка добавления в БД) обязательно выводятся через глобальные уведомления (Toasts). Ошибки валидации (пустое имя, дубликат) показываются инлайн.
- **Database Naming Convention**: `snake_case` обязательно.

### Data Model Options
В текущей схеме таблицы `posts` (`src/types/supabase.ts`) поле `category` имеет тип `string` (Text) со значением по умолчанию `'general'`.  Вам нужно решить, как хранить справочник категорий:
- **Опция А (рекомендуемая)**: Создать отдельную таблицу `categories` (поля: `id`, `name`, `slug`, `created_at`) и связать её с `posts.category` (по `slug` или имени).
- **Опция Б**: Использовать `SELECT DISTINCT category FROM posts` (не позволяет создавать категории "про запас", до появления постов).

**Важно:** Убедитесь, что миграции БД отражают выбранный подход. Скорее всего понадобится SQL-скрипт (миграция) для создания таблицы `categories`.

### Integration Points
- **PostForm.tsx**: Необходимо обновить поле `category`. Сейчас это может быть простой текстовый input или статический Select. Нужно заменить на динамический Select/Combobox с данными из БД.
- **Страница управления**: Нужно создать новую страницу (например, `src/app/(admin)/categories/page.tsx`) или добавить модалку/секцию в `Dashboard`.

### Previous Story Context (Story 4.1)
- В предыдущей задаче была создана форма `PostForm.tsx` и схема валидации в `src/features/admin/types.ts`.
- В схеме Zod уже есть `.transform(trim)` для полей. Нужно будет обновить схему для поля `category`, если изменятся правила (например, ограничение длины, формат).
- В `src/types/supabase.ts` тип поля `category` — `string`.

## Tasks / Subtasks

- [x] Task 1: Подготовка БД и Типов
  - [x] 1.1: Создать SQL-миграцию для создания таблицы `categories` (поля: `id` UUID, `name` TEXT, `slug` TEXT UNIQUE, `created_at` TIMESTAMPTZ).
  - [x] 1.2: Обновить `src/types/supabase.ts` после применения миграции.
  - [x] 1.3: Добавить начальные категории в миграцию (например, 'general', 'insight').

- [x] Task 2: API слой для категорий
  - [x] 2.1: Создать `src/features/admin/api/categories.ts` с функциями: `getCategories()`, `createCategory(name, slug)`, `deleteCategory(id)`.

- [x] Task 3: Интерфейс управления категориями
  - [x] 3.1: Создать страницу/секцию для управления категориями (просмотр списка, добавление, удаление).
  - [x] 3.2: Использовать Toasts для уведомлений об успехе/ошибке.

- [x] Task 4: Обновление PostForm
  - [x] 4.1: В `src/features/admin/components/PostForm.tsx` заменить текстовый ввод (или статический селект) категории на динамический выпадающий список (Select из shadcn/ui или Combobox), получающий данные через `getCategories()`.
  - [x] 4.2: Убедиться, что Zod-схема в `src/features/admin/types.ts` корректно валидирует выбранную категорию.

- [x] Task 5: Отображение в ленте
  - [x] 5.1: Убедиться, что компонент `PostCard` (или аналогичный) корректно отображает категорию и клик по ней работает как фильтр (Epic 2, Story 2.8).

## Reference Materials
- [Epic Context]: FR20, FR34 - Управление категориями.
- [Architecture]: `Smart Container / Dumb UI` паттерн, запрет на маппинг БД `snake_case`.

## Dev Agent Record

### Implementation Plan
Реализована Опция А: отдельная таблица `categories` с FK от `posts.category → categories.slug`.

### Completion Notes
- **Task 1**: Создана миграция `021_create_categories.sql` — таблица `categories`, RLS-политики, посев 10 существующих категорий из migration 015, удалён CHECK constraint, добавлен FK с ON UPDATE CASCADE / ON DELETE RESTRICT. Обновлён `supabase.ts`.
- **Task 2**: API файл `categories.ts` (клиент) + `categoriesServer.ts` (сервер/RSC). Функции: `getCategories`, `createCategory` (дубликат → понятное сообщение), `deleteCategory` (FK нарушение → понятное сообщение).
- **Task 3**: Страница `src/app/(admin)/categories/page.tsx` (RSC загружает данные) + компонент `CategoryManager.tsx` (клиент: list, add form, delete). Дубликат показывается инлайн; системные ошибки — через Toast.
- **Task 4**: PostForm.tsx — Input заменён на `<select>`. Динамические опции из `getCategories()`. В edit-mode: `setValue` срабатывает после появления опций (второй useEffect на `[categories]`). Zod-схема без изменений — min(1)+max(100) валидирует slug.
- **Task 5**: PostCard — добавлен пропс `onCategoryClick`. При его наличии рендерится кнопка вместо статичного span; клик вызывает callback без навигации. FeedContainer передаёт `onCategoryClick → useFeedStore.getState().changeCategory(category)`.

### Tests Added
- `tests/unit/features/admin/api/categories.test.ts` — 9 тестов: getCategories, createCategory (дубликат), deleteCategory (FK)
- `tests/unit/features/admin/components/CategoryManager.test.tsx` — 8 тестов: list, empty state, add, duplicate inline error, generic error toast, delete, delete error, slug auto-gen
- `tests/unit/components/feed/PostCard.test.tsx` — +4 теста: category pill (span без callback, кнопка с callback, click filter, no navigation)
- `tests/unit/features/admin/components/PostForm.test.tsx` — обновлены существующие тесты: mock `getCategories`, `selectOptions` вместо `type`, `waitFor` для await categories load

## File List
- `supabase/migrations/021_create_categories.sql` (новый)
- `src/types/supabase.ts` (изменён — добавлена таблица categories)
- `src/features/admin/api/categories.ts` (новый)
- `src/features/admin/api/categoriesServer.ts` (новый)
- `src/features/admin/components/CategoryManager.tsx` (новый)
- `src/app/(admin)/categories/page.tsx` (новый)
- `src/features/admin/components/PostForm.tsx` (изменён — select вместо input, load categories)
- `src/components/feed/PostCard.tsx` (изменён — onCategoryClick prop + кнопка pill)
- `src/features/feed/components/FeedContainer.tsx` (изменён — onCategoryClick передаётся в PostCard)
- `tests/unit/features/admin/api/categories.test.ts` (новый)
- `tests/unit/features/admin/components/CategoryManager.test.tsx` (новый)
- `tests/unit/components/feed/PostCard.test.tsx` (изменён — +4 теста category pill)
- `tests/unit/features/admin/components/PostForm.test.tsx` (изменён — updated mocks + selectOptions)

## Change Log
- 2026-03-29: Реализована Story 4.2 — управление категориями и рубриками постов
