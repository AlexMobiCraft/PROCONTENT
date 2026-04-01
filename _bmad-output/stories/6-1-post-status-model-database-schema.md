# Story 6.1: Схема БД — статусная модель постов

Status: ready-for-dev

## Story

As a автор,
I want новые поля `status`, `scheduled_at`, `published_at` в таблице постов,
So that система может отслеживать статус публикации и управлять очередью запланированных постов.

## Acceptance Criteria

1. **Миграция схемы `posts`:**
   **Given** существующая таблица `posts` в production БД
   **When** применяется миграция через Supabase
   **Then** добавлено поле `status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'published'))`
   **And** добавлено поле `scheduled_at TIMESTAMPTZ` (nullable)
   **And** добавлено поле `published_at TIMESTAMPTZ` (nullable)
   **And** создан частичный индекс `CREATE INDEX idx_posts_scheduled ON posts(scheduled_at) WHERE status = 'scheduled'`
   **And** существующие посты получают `status='published'` через backfill-часть миграции

2. **Сохранение ограничения записи только для admin:**
   **Given** RLS-политики Supabase для таблицы `posts`
   **When** участник с ролью не `admin` пытается изменить пост, включая поля `status`, `scheduled_at`, `published_at`
   **Then** Supabase возвращает ошибку доступа
   **And** новые поля не ослабляют существующую admin-only модель записи

3. **Обновление TypeScript-типов:**
   **Given** обновлена схема БД
   **When** выполнена регенерация Supabase types
   **Then** TypeScript-типы отражают новые поля `status`, `scheduled_at`, `published_at` в `snake_case`
   **And** `src/types/supabase.ts` становится единственным актуальным источником типов для этих полей

## Контекст разработчика и технические требования

### Что уже есть в проекте

- Таблица `posts` создана в `supabase/migrations/007_create_posts_table.sql` и сейчас содержит legacy-поле `is_published BOOLEAN NOT NULL DEFAULT true`.
- Текущие read-path'ы приложения всё ещё завязаны на `is_published = true`:
  - `src/features/feed/api/serverPosts.ts`
  - `src/features/feed/api/posts.ts`
  - `src/features/onboarding/api/onboardingServer.ts`
  - а также RLS SELECT policy для `authenticated` и `anon`.
- Админская форма публикации уже существует в `src/features/admin/components/PostForm.tsx`, а мутации записи — в `src/features/admin/api/posts.ts`.
- Сейчас `createPost()` при создании поста явно пишет `is_published: true`, а новые поля статуса ещё не учитывает.
- Текущая admin-only модель записи в `posts` уже реализована на уровне RLS в миграции `009_add_role_fix_admin_rls.sql`: записывать в `posts` может только пользователь с `profiles.role = 'admin'`.
- В `src/app/(admin)/layout.tsx` доступ в админскую зону уже дополнительно защищён проверкой `profile.role !== 'admin'` → redirect на `/feed`.
- В `src/types/supabase.ts` таблица `posts` пока содержит `is_published`, `is_landing_preview`, `is_onboarding`, но не содержит `status`, `scheduled_at`, `published_at`.

### Ключевые архитектурные решения для этой истории

1. **`status` — новый канонический статус публикации, но `is_published` пока нельзя ломать.**
   В проекте уже есть много production-read путей, которые используют `is_published`. История 6.1 не должна ломать существующую ленту, onboarding, landing-preview и поиск.

2. **Не удалять `is_published` в Story 6.1.**
   Удаление или массовый перевод всех query/RLS на `status='published'` — это уже изменение нескольких downstream-историй. В рамках 6.1 безопаснее ввести новую статусную модель без удаления legacy-флага.

3. **Требуется transitional compatibility.**
   После добавления `status DEFAULT 'draft'` текущая форма «Objavi» начнёт создавать записи с опасной комбинацией `is_published=true` + `status='draft'`, если код не обновить. Это регрессионный риск.

   Поэтому при реализации Story 6.1 разработчик должен **синхронизировать текущий immediate publish path**:
   - обычное создание поста без scheduling UI должно явно сохранять `status='published'`
   - `published_at` должно выставляться при обычной немедленной публикации
   - `scheduled_at` должно быть `null`
   - legacy-флаг `is_published` должен остаться `true` для уже существующего поведения

4. **Не пытаться реализовать column-level RLS.**
   В PostgreSQL/Supabase текущая модель уже запрещает не-admin любые `INSERT/UPDATE/DELETE` по таблице `posts`, а не только изменение отдельных полей. Для AC достаточно убедиться, что новые поля остаются под этой же политикой. Отдельная field-level политика не нужна.

5. **Следующие истории зависят от этой схемы.**
   - Story 6.2 будет публиковать `scheduled` → `published` по cron
   - Story 6.3 будет записывать `scheduled_at` из формы
   - Story 6.4 будет читать список `status='scheduled'`

   Поэтому 6.1 должна дать корректную базу данных, типы и безопасную совместимость с текущим кодом.

### Границы этой истории

**Входит в scope 6.1:**
- SQL-миграция для новых колонок и индекса
- backfill существующих записей
- подтверждение/сохранение admin-only write-модели
- регенерация `src/types/supabase.ts`
- минимальная совместимость текущего publish flow с новой статусной моделью

**Не входит в scope 6.1:**
- cron endpoint / автопубликация
- toggle «Запланировать» и datetime picker в UI
- отдельная admin-таблица запланированных постов
- полный перевод всех read-query и RLS SELECT policy на `status='published'`, если это не требуется для безболезненной совместимости текущей истории

### Файлы и точки интеграции

#### Файлы, которые почти наверняка придётся менять

- `supabase/migrations/007_create_posts_table.sql` — только как reference, **не редактировать старую миграцию**
- `supabase/migrations/009_add_role_fix_admin_rls.sql` — reference для текущей admin-only RLS модели
- `supabase/migrations/033_add_posts_anon_read_policy.sql` — reference для текущего anon-read поведения по `is_published`
- `src/types/supabase.ts`
- `src/features/admin/api/posts.ts`
- `src/app/(admin)/posts/[id]/edit/page.tsx`
- при необходимости: `src/features/admin/types.ts`
- при необходимости: тесты для admin API слоя

#### Новый файл, который ожидается

- `supabase/migrations/037_add_post_status_scheduling.sql`

`037` выбран как следующий номер после `036_add_user_profile_fields.sql`, уже существующей в проекте.

### Требования к миграции БД

Миграция должна:

1. Добавить поля:
   - `status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'published'))`
   - `scheduled_at TIMESTAMPTZ NULL`
   - `published_at TIMESTAMPTZ NULL`

2. Выполнить backfill для существующих строк:
   - установить `status='published'` для уже существующих постов
   - не ломать существующий production-контент

3. Создать частичный индекс:
   - `idx_posts_scheduled ON posts(scheduled_at) WHERE status = 'scheduled'`

4. Не изменять существующие FK и не расширять права записи не-admin пользователям.

5. Сохранить идемпотентность миграции настолько, насколько это возможно для Supabase SQL-практики (`IF NOT EXISTS`, `DROP ... IF EXISTS` там, где уместно).

### Требования к совместимости текущего publish flow

Чтобы не сломать текущую публикацию постов между Story 6.1 и Story 6.3:

- `createPost()` должен явно записывать:
  - `status: 'published'`
  - `published_at: now()` / серверное текущее время
  - `scheduled_at: null`
  - `is_published: true`

- `updatePost()` для обычного редактирования уже опубликованного поста не должен случайно переводить запись обратно в `draft`.

- Запросы на редактирование (`fetchPostForEdit`, server prefill на странице edit) желательно уже начать читать новые поля, чтобы следующие истории не дублировали plumbing.

### Требования к типам и data contract

После регенерации `src/types/supabase.ts` таблица `posts` должна содержать в `Row`, `Insert`, `Update`:

- `status: string` / `status?: string`
- `scheduled_at: string | null` / `scheduled_at?: string | null`
- `published_at: string | null` / `published_at?: string | null`

Критично сохранить соглашение проекта:
- DB-поля остаются в `snake_case`
- не вводить ручные camelCase-мэпперы для Supabase rows
- `src/types/supabase.ts` обновляется генерацией, а не ручным редактированием «кусочков» по памяти

### RLS и безопасность

- Текущая write-policy `Admin can manage posts` уже завязана на `profiles.role = 'admin'` и распространяется на всю таблицу `posts`.
- Следовательно, новые поля `status`, `scheduled_at`, `published_at` автоматически попадают под ту же защиту.
- Если разработчик решит менять policy, нужно быть предельно осторожным: **нельзя** ослабить текущую модель доступа ради якобы «точечной защиты этих полей».
- История должна завершаться тем, что участница с ролью `member` по-прежнему не может обновить строку `posts` через Supabase.

### Previous Story Intelligence

#### Из Story 4.1

- В проекте уже есть production-ready путь создания/редактирования постов через `PostForm` + `createPost/updatePost`.
- Мутации в admin API слое уже реализуют аккуратную обработку ошибок, rollback для медиа и guards на бизнес-ограничения. Это нельзя ломать при добавлении новых полей.
- UI проекта остаётся на словенском языке, документация и story — на русском.

#### Из Story 4.3

- Уже была история с добавлением новых флагов в таблицу `posts` (`is_landing_preview`, `is_onboarding`) и последующим обновлением `src/types/supabase.ts`.
- Это хороший референс для безопасного расширения схемы `posts` без разрушения существующего кода.

#### Из Story 5.1

- В проекте уже использовался паттерн: сначала SQL-миграция, затем `npx supabase db push`, затем обновление story/типов.
- Нумерация миграций уже дошла до `036`, поэтому Story 6.1 не должна переиспользовать старые номера.

### Тестирование и проверка

Обязательно покрыть проверками следующие сценарии:

1. **Schema verification**
   - новые поля существуют в `posts`
   - check constraint разрешает только `draft | scheduled | published`
   - индекс `idx_posts_scheduled` создан

2. **Backfill verification**
   - все legacy-записи получают `status='published'`
   - существующие опубликованные посты не исчезают из текущего UI-потока

3. **RLS verification**
   - пользователь `member` не может обновить строку `posts`
   - admin может обновить строку `posts`
   - новые поля не создают новых write loopholes

4. **Type generation verification**
   - `src/types/supabase.ts` содержит `status`, `scheduled_at`, `published_at`
   - поля присутствуют минимум в `Row`, `Insert`, `Update`

5. **Regression verification для текущей публикации**
   - обычное создание поста из текущей формы продолжает приводить к «сразу опубликованному» посту
   - редактирование существующего поста не переводит его в `draft`
   - текущие тесты admin API слоя при необходимости обновлены под новый контракт

## Tasks / Subtasks

- [ ] Task 1: Подготовить и применить миграцию БД для статусной модели постов (AC: 1)
  - [ ] 1.1 Создать `supabase/migrations/037_add_post_status_scheduling.sql`
  - [ ] 1.2 Добавить в `posts` поля `status`, `scheduled_at`, `published_at`
  - [ ] 1.3 Добавить `CHECK (status IN ('draft', 'scheduled', 'published'))`
  - [ ] 1.4 Создать частичный индекс `idx_posts_scheduled`
  - [ ] 1.5 Выполнить backfill существующих постов в `status='published'`

- [ ] Task 2: Сохранить текущую совместимость immediate publish flow (AC: 1, 2)
  - [ ] 2.1 Обновить `src/features/admin/api/posts.ts`, чтобы обычная публикация явно записывала `status='published'`
  - [ ] 2.2 Для immediate publish path явно выставлять `published_at`, `scheduled_at=null`, `is_published=true`
  - [ ] 2.3 Убедиться, что edit flow не переводит существующие посты обратно в `draft`
  - [ ] 2.4 При необходимости расширить select/prefill новыми полями для следующих историй

- [ ] Task 3: Обновить Supabase types и сверить контракт (AC: 3)
  - [ ] 3.1 Сгенерировать обновлённые TS types после применения миграции
  - [ ] 3.2 Обновить `src/types/supabase.ts`
  - [ ] 3.3 Проверить наличие новых полей в `Row`, `Insert`, `Update` для `posts`

- [ ] Task 4: Подтвердить сохранение модели безопасности (AC: 2)
  - [ ] 4.1 Проверить, что текущая policy `Admin can manage posts` остаётся валидной для новых полей
  - [ ] 4.2 Не вводить избыточную field-level логику доступа
  - [ ] 4.3 Подтвердить, что `member` не может изменять `posts`, включая новые поля

- [ ] Task 5: Проверить регрессии и зафиксировать результат (AC: 1, 2, 3)
  - [ ] 5.1 Прогнать релевантные unit/integration тесты admin API слоя
  - [ ] 5.2 Проверить сценарий создания поста через текущую админскую форму
  - [ ] 5.3 Зафиксировать в story список реально изменённых файлов и итоги проверки

## References

- [Source] `_bmad-output/planning-artifacts/epics.md#Story 6.1`
- [Source] `_bmad-output/planning-artifacts/product-brief-scheduled-publishing.md`
- [Source] `_bmad-output/planning-artifacts/architecture.md#Implementation Patterns & Consistency Rules`
- [Source] `supabase/migrations/007_create_posts_table.sql`
- [Source] `supabase/migrations/008_fix_posts_fk_and_rls.sql`
- [Source] `supabase/migrations/009_add_role_fix_admin_rls.sql`
- [Source] `supabase/migrations/033_add_posts_anon_read_policy.sql`
- [Source] `src/types/supabase.ts`
- [Source] `src/features/admin/api/posts.ts`
- [Source] `src/features/admin/components/PostForm.tsx`
- [Source] `src/app/(admin)/posts/[id]/edit/page.tsx`
- [Source] `src/app/(admin)/layout.tsx`
- [Source] `src/features/feed/api/serverPosts.ts`
- [Source] `src/features/feed/api/posts.ts`
- [Source] `src/features/onboarding/api/onboardingServer.ts`
- [Source] `_bmad-output/stories/4-1-creating-and-editing-multimedia-posts.md`
- [Source] `_bmad-output/stories/4-3-managing-content-for-onboarding-and-landing.md`
- [Source] `_bmad-output/stories/5-1-access-to-the-entire-content-archive-telegram-migration.md`

## Dev Agent Record

### Agent Model Used

Cascade

### Debug Log References

- Sprint status не обновлялся автоматически в рамках этой подготовки story, потому что текущий `sprint-status.yaml` в рабочем каталоге ещё не содержит записей для `Epic 6`.

### Completion Notes List

- Story подготовлена как `ready-for-dev` с акцентом на безопасную миграцию `posts`, сохранение текущего publish flow и без регрессии для существующего `is_published`-контракта.
- Отдельно зафиксирован риск несовместимости `DEFAULT 'draft'` с текущим admin create flow и добавлено требование синхронизировать immediate publish path уже в рамках этой истории.
- Зафиксировано, что RLS для новых полей не требует отдельной field-level политики: текущая admin-only policy уже покрывает всю строку `posts`.

### File List

- `_bmad-output/stories/6-1-post-status-model-database-schema.md`

## Change Log

- 2026-04-01: Story 6.1 подготовлена в статусе `ready-for-dev` с developer guardrails по миграции схемы `posts`, регенерации Supabase types, transitional compatibility для `is_published` и проверке RLS-модели.
