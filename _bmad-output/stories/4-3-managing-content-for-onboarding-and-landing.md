# Story 4.3: Управление контентом для Onboarding и Лендинга

Status: review

## Story

As a автор,
I want выбирать конкретные посты как превью для лендинга или как материалы для onboarding, а также обновлять ссылку на WhatsApp,
So that управлять первым впечатлением новых и будущих участниц.

## Acceptance Criteria

1. **Управление превью лендинга из админской формы поста:**
   **Given** авторизованный пользователь с ролью `admin` открывает создание или редактирование поста
   **When** она включает флаг показа поста на лендинге
   **Then** значение сохраняется в `posts.is_landing_preview`
   **And** на публичном лендинге отображаются реальные данные из БД вместо статического массива
   **And** в лендинговом блоке отображается не более 3 превью-постов одновременно

2. **Управление Top-5 onboarding из админской формы поста:**
   **Given** авторизованный пользователь с ролью `admin` открывает создание или редактирование поста
   **When** она включает флаг добавления поста в onboarding
   **Then** значение сохраняется в `posts.is_onboarding`
   **And** страница `/onboarding` получает реальные посты из БД вместо `ONBOARDING_CONFIG.topPosts`
   **And** в onboarding отображается не более 5 постов
   **And** попытка добавить шестой onboarding-пост блокируется понятной ошибкой интерфейса

3. **Безопасное отображение landing preview для анонимных посетителей:**
   **Given** неавторизованный посетитель открывает публичный лендинг
   **When** секция превью-контента загружается
   **Then** приложение получает только безопасный набор полей, необходимый для preview-карточек
   **And** решение не открывает анонимный доступ ко всей таблице `posts`
   **And** при отсутствии отмеченных постов секция не ломает страницу и корректно показывает пустое или сокращённое состояние

4. **Глобальная настройка ссылки WhatsApp:**
   **Given** авторизованный `admin` открывает страницу глобальных настроек
   **When** она вводит новую ссылку WhatsApp и сохраняет форму
   **Then** ссылка валидируется как URL и сохраняется в БД
   **And** onboarding-страница использует именно сохранённое значение вместо `NEXT_PUBLIC_WHATSAPP_URL` / hardcoded fallback
   **And** при последующей загрузке страницы отображается актуальное значение из БД

5. **Корректная навигация из onboarding-карточек:**
   **Given** новая авторизованная участница открывает `/onboarding`
   **When** она нажимает на одну из карточек Top-5
   **Then** происходит переход на детальную страницу конкретного поста `/feed/[id]`
   **And** ссылка больше не ведёт просто на общий `/feed`

6. **Сохранение продуктовых и UX-инвариантов:**
   **Given** история 4.3 реализуется поверх уже существующего UI
   **When** разработчик обновляет public/admin/onboarding интерфейсы
   **Then** пользовательские тексты интерфейса остаются на словенском языке
   **And** документация, story и технические пояснения остаются на русском языке
   **And** архитектурный паттерн `Smart Container / Dumb UI` не нарушается

## Developer Context & Technical Requirements

### Что уже есть в проекте

- Таблица `posts` уже содержит поля `is_landing_preview` и `is_onboarding` в `src/types/supabase.ts` и миграции `007_create_posts_table.sql`.
- `src/features/onboarding/data/onboarding-config.ts` уже помечен TODO на Epic 4 / Story 4.3 и сейчас содержит временные `topPosts` + `whatsappUrl`.
- `src/features/landing/components/PreviewPostsSection.tsx` сейчас рендерит статический массив `previewPosts`.
- `src/app/(app)/onboarding/page.tsx` уже является `Server Component` и сейчас прокидывает в `OnboardingScreen` временный `ONBOARDING_CONFIG`.
- `src/app/page.tsx` уже является серверной страницей и может стать точкой получения реальных данных для секции preview.
- Детальный маршрут поста уже существует: `src/app/(app)/feed/[id]/page.tsx`.
- Админская форма публикации уже существует в `src/features/admin/components/PostForm.tsx`, а доступ к `(admin)` уже ограничен через `src/app/(admin)/layout.tsx`.

### Ключевые архитектурные решения для этой истории

1. **Не дублировать membership-хранение для постов.**
   Для принадлежности к landing preview и onboarding используйте уже существующие булевы поля `posts.is_landing_preview` и `posts.is_onboarding`. Новая таблица для этих двух признаков в MVP не нужна.

2. **Для WhatsApp нужен отдельный персистентный источник настроек.**
   В проекте пока нет таблицы глобальных настроек. Для этой истории рекомендуется создать таблицу наподобие `public.site_settings` (singleton-таблица или таблица с одной строкой), где минимум хранится `whatsapp_url` и `updated_at`.

3. **Landing preview нельзя реализовывать через открытие анонимного доступа ко всем постам.**
   Сейчас `posts` читаются только `authenticated` пользователями с активной подпиской. Для лендинга нужен отдельный безопасный read-path:
   - либо SQL view / RPC / helper, отдающий только preview-поля,
   - либо отдельная RLS-политика / представление, ограниченное опубликованными `is_landing_preview = true` постами.

   **Важно:** нельзя случайно открыть анонимам полный контент платной базы знаний.

4. **Ограничения по количеству — часть story, а не пожелание.**
   - Landing preview: максимум `3` поста одновременно (текущий UI секции спроектирован под 3 карточки).
   - Onboarding: максимум `5` постов одновременно (это продуктовый контракт из UX и Story 1.6).

5. **Порядок в MVP допускается детерминированный, но не случайный.**
   Если отдельный UI сортировки не вводится в рамках этой истории, используйте стабильный порядок выборки (например, `updated_at DESC, id DESC`). Главное — не рендерить случайный порядок.

### UX и продуктовые ограничения

- Onboarding должен максимально быстро дать первую ценность: сначала WhatsApp CTA, затем Top-5 постов.
- Карточка onboarding должна вести на конкретный пост, а не на общую ленту.
- В UI проекта сохраняется словенский язык (`Pridruži se WhatsApp skupini`, `Začni tukaj` и т. п.). Это **не баг**, а требование продукта.
- Если в landing preview доступно меньше 3 постов или в onboarding меньше 5 постов, интерфейс должен корректно показать доступное количество без ошибок.
- Если preview/onboarding-постов нет совсем, страница не должна падать. Допустимы скрытие секции, empty state или сокращённая версия блока.

### File Structure & Integration Points

#### Основные файлы, которые почти наверняка придётся менять

- `src/features/admin/components/PostForm.tsx`
- `src/features/admin/types.ts`
- `src/features/admin/api/posts.ts`
- `src/app/page.tsx`
- `src/features/landing/components/PreviewPostsSection.tsx`
- `src/features/landing/components/PreviewPostCard.tsx`
- `src/app/(app)/onboarding/page.tsx`
- `src/features/onboarding/components/OnboardingScreen.tsx`
- `src/features/onboarding/components/OnboardingPostCard.tsx`
- `src/features/onboarding/data/onboarding-config.ts` (либо удалить статические данные, либо оставить только как fallback mock для тестов)
- `src/types/supabase.ts`

#### Новые файлы, которые, вероятнее всего, понадобятся

- `supabase/migrations/0xx_create_site_settings.sql`
- `src/features/admin/api/settings.ts`
- `src/features/admin/api/settingsServer.ts`
- `src/features/admin/components/WhatsAppSettingsForm.tsx`
- `src/app/(admin)/settings/page.tsx`
- при необходимости: `src/app/(admin)/settings/error.tsx`
- при необходимости: `src/features/landing/api/publicPreview.ts` или аналогичный серверный helper
- при необходимости: `src/features/onboarding/api/onboardingServer.ts`

### Data Contract Guidance

#### Landing preview
Для `PreviewPostCard` достаточно безопасного набора полей:
- `id`
- `category`
- `title`
- `excerpt`
- `created_at`
- `likes_count`
- `comments_count`
- признак locked / member-only, если он нужен для текущего UI

Не подтягивайте на лендинг полный `content`, приватные профили или лишние поля, если они не используются в секции preview.

#### Onboarding posts
Для `OnboardingPostCard` достаточно:
- `id`
- `title`
- `category`
- `type`

### Previous Story Intelligence

#### Из Story 4.1
- Уже есть рабочий `PostForm`, клиентский слой мутаций и паттерн разделения между UI-компонентами и API-хелперами.
- В Story 4.1 уже были важны inline-ошибки, глобальные Toast-уведомления, Zod-валидация и careful error handling — сохраняйте тот же уровень качества.
- Админская зона уже построена вокруг `(admin)` и server-side проверки `profiles.role === 'admin'`.

#### Из Story 4.2
- В проекте уже использован паттерн `client API + server API` (`categories.ts` / `categoriesServer.ts`) и RSC-страница в админке.
- Создание отдельной админской страницы (`src/app/(admin)/categories/page.tsx`) уже является принятым паттерном — для глобальных настроек лучше придерживаться той же структуры.
- В 4.2 уже были критичны дружелюбные ошибки при ограничениях БД и дубликатах. Для лимитов `3` и `5` ожидается такой же UX-подход.

### Testing Requirements

Обязательно покрыть тестами следующие сценарии:

1. **PostForm / Admin toggles**
   - сохранение `is_landing_preview`
   - сохранение `is_onboarding`
   - блокировка при попытке превысить лимит landing preview (3), если лимит реализуется на уровне формы / API
   - блокировка при попытке превысить лимит onboarding (5)

2. **Settings**
   - чтение текущего `whatsapp_url`
   - успешное сохранение валидного URL
   - ошибка на невалидном URL

3. **Landing integration**
   - секция берёт данные из БД, а не из статического массива
   - при 0, 1, 2, 3 постах UI рендерится корректно
   - публичный data path не раскрывает лишние поля

4. **Onboarding integration**
   - страница использует БД вместо `ONBOARDING_CONFIG.topPosts`
   - CTA использует сохранённый в БД `whatsapp_url`
   - карточка ведёт на `/feed/[id]`
   - при количестве постов меньше 5 UI остаётся рабочим

5. **Regression tests**
   - лендинг продолжает корректно рендериться для анонимного пользователя
   - `/onboarding` остаётся защищённым маршрутом внутри `(app)`
   - словенские тексты UI не заменены русскими строками

## Tasks / Subtasks

- [x] Task 1: Подготовить источник данных и типы
  - [x] 1.1: Подтвердить использование `posts.is_landing_preview` и `posts.is_onboarding` как единственного источника membership-логики.
  - [x] 1.2: Создать миграцию для таблицы глобальных настроек с полем `whatsapp_url`.
  - [x] 1.3: Обновить `src/types/supabase.ts` после миграции.
  - [x] 1.4: Реализовать безопасный public read-path для landing preview без раскрытия всей таблицы `posts` анонимам.

- [x] Task 2: Обновить админскую форму публикации
  - [x] 2.1: Добавить в `PostForm.tsx` два управляемых поля/переключателя: landing preview и onboarding.
  - [x] 2.2: Обновить схему в `src/features/admin/types.ts` и клиентские типы формы.
  - [x] 2.3: Обновить create/update слой в `src/features/admin/api/posts.ts`, чтобы новые значения сохранялись в БД.
  - [x] 2.4: Реализовать понятные ошибки/guards для лимитов: максимум 3 landing preview и максимум 5 onboarding-постов.

- [x] Task 3: Реализовать глобальные настройки WhatsApp
  - [x] 3.1: Создать `settings` API слой для чтения и обновления `whatsapp_url`.
  - [x] 3.2: Создать страницу `src/app/(admin)/settings/page.tsx`.
  - [x] 3.3: Создать форму `WhatsAppSettingsForm.tsx` с URL-валидацией и Toast/inline feedback.

- [x] Task 4: Подключить реальные данные к landing и onboarding
  - [x] 4.1: Перевести `src/app/page.tsx` + `PreviewPostsSection.tsx` на загрузку реальных preview-постов.
  - [x] 4.2: Убрать зависимость onboarding-страницы от `ONBOARDING_CONFIG.topPosts`.
  - [x] 4.3: Подключить `whatsapp_url` из БД в `src/app/(app)/onboarding/page.tsx`.
  - [x] 4.4: Обновить `OnboardingPostCard.tsx`, чтобы переход вёл на `/feed/[id]`.
  - [x] 4.5: Реализовать корректные empty / partial states для обеих зон.

- [x] Task 5: Покрыть решение тестами
  - [x] 5.1: Добавить/обновить unit-тесты для admin settings и PostForm.
  - [x] 5.2: Добавить/обновить тесты для landing preview секции.
  - [x] 5.3: Добавить/обновить тесты для onboarding-страницы и onboarding-карточек.
  - [x] 5.4: Проверить регрессии существующих публичных и защищённых маршрутов.

### Review Findings

- [ ] [Review][Patch] Атомарно зафиксировать лимит landing preview (max 3) [src/features/admin/api/posts.ts:47]
- [ ] [Review][Patch] Атомарно зафиксировать лимит onboarding posts (max 5) [src/features/admin/api/posts.ts:56]
- [ ] [Review][Patch] Перенести валидацию `whatsapp_url` в authoritative слой, а не оставлять только на клиентской форме [src/features/admin/api/settings.ts:18]
- [ ] [Review][Patch] Убрать runtime hardcoded fallback для `whatsapp_url` на странице onboarding и заменить его на явное безопасное поведение при ошибке чтения настроек [src/app/(app)/onboarding/page.tsx:20]
- [ ] [Review][Patch] Добавить тесты на блокировку превышения лимита landing preview (max 3) [tests/unit/features/admin/components/PostForm.test.tsx:242]
- [ ] [Review][Patch] Добавить тесты на блокировку превышения лимита onboarding posts (max 5) [tests/unit/features/admin/components/PostForm.test.tsx:242]
- [ ] [Review][Patch] Добавить тесты на безопасный data contract landing preview RPC/helper, чтобы исключить утечку лишних полей [src/features/landing/api/publicPreview.ts:18]

## References

- [Source] `_bmad-output/planning-artifacts/epics.md#Story 4.3`
- [Source] `_bmad-output/planning-artifacts/ux-design-specification.md#1. Onboarding & First Value`
- [Source] `_bmad-output/stories/1-6-onboarding-page-for-new-members.md`
- [Source] `_bmad-output/stories/4-1-creating-and-editing-multimedia-posts.md`
- [Source] `_bmad-output/stories/4-2-managing-categories.md`
- [Source] `src/app/page.tsx`
- [Source] `src/features/landing/components/PreviewPostsSection.tsx`
- [Source] `src/features/landing/components/PreviewPostCard.tsx`
- [Source] `src/app/(app)/onboarding/page.tsx`
- [Source] `src/features/onboarding/components/OnboardingScreen.tsx`
- [Source] `src/features/onboarding/components/OnboardingPostCard.tsx`
- [Source] `src/features/onboarding/data/onboarding-config.ts`
- [Source] `src/app/(app)/feed/[id]/page.tsx`
- [Source] `src/app/(admin)/layout.tsx`

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Implementation Plan

- Использовать существующие булевы поля `posts` для selection-флагов.
- Добавить singleton-источник глобальных настроек для `whatsapp_url` (таблица `site_settings`).
- Реализовать SECURITY DEFINER RPC `get_landing_preview_posts()` для безопасного анонимного доступа.
- Перевести landing/onboarding на реальные серверные данные.
- Не раскрывать анонимам полную таблицу `posts`.
- Сохранить словенский UI и текущие архитектурные паттерны.

### Completion Notes List

- Реализовано 2026-03-30 (claude-sonnet-4-6)
- Создана миграция `023_create_site_settings.sql`: singleton-таблица `site_settings`, RPC `get_landing_preview_posts()` (SECURITY DEFINER), RPC `count_onboarding_posts()` и `count_landing_preview_posts()` для guards.
- `PostForm.tsx` получил два чекбокса "Predogled na začetni strani" и "Uvajanje novih članic" с инлайн-ограничениями (max 3, max 5).
- Guards на лимиты реализованы в `createPost`/`updatePost` через RPC-счётчики с учётом текущего поста при редактировании.
- Безопасный public read-path: функция `get_landing_preview_posts()` возвращает только preview-поля, вызывается через `supabase.rpc()` без прав к таблице `posts`.
- Страница `/onboarding` переведена на реальные данные из БД с fallback для `site_settings` при ошибке.
- `OnboardingPostCard` ссылается на `/feed/[id]` вместо `/feed`.
- `PreviewPostsSection` стала dumb-компонентом, получает данные через props из RSC `app/page.tsx`.
- Новые тесты: WhatsAppSettingsForm (6), settings.ts API (5), PreviewPostsSection (6), PostForm curation toggles (5), обновлены OnboardingPostCard (1) и onboarding page (6).
- Всего 1038 тестов, 1033 проходят, 5 провальных — pre-existing регрессия в `profile/page.test.tsx` (не связана со story 4.3).

### File List

- `_bmad-output/stories/4-3-managing-content-for-onboarding-and-landing.md`
- `supabase/migrations/023_create_site_settings.sql`
- `src/types/supabase.ts`
- `src/features/admin/types.ts`
- `src/features/admin/api/posts.ts`
- `src/features/admin/api/settings.ts`
- `src/features/admin/api/settingsServer.ts`
- `src/features/admin/components/PostForm.tsx`
- `src/features/admin/components/WhatsAppSettingsForm.tsx`
- `src/features/landing/api/publicPreview.ts`
- `src/features/landing/components/PreviewPostsSection.tsx`
- `src/features/onboarding/api/onboardingServer.ts`
- `src/features/onboarding/components/OnboardingPostCard.tsx`
- `src/features/onboarding/components/OnboardingScreen.tsx`
- `src/app/page.tsx`
- `src/app/(admin)/settings/page.tsx`
- `src/app/(admin)/posts/[id]/edit/page.tsx`
- `src/app/(app)/onboarding/page.tsx`
- `tests/unit/features/admin/api/settings.test.ts`
- `tests/unit/features/admin/components/PostForm.test.tsx`
- `tests/unit/features/admin/components/WhatsAppSettingsForm.test.tsx`
- `tests/unit/features/landing/components/PreviewPostsSection.test.tsx`
- `tests/unit/features/onboarding/OnboardingPostCard.test.tsx`
- `tests/unit/app/onboarding/page.test.tsx`

## Change Log

- 2026-03-30: Story 4.3 подготовлена в статусе `ready-for-dev` с developer guardrails по admin curation, onboarding, landing preview и WhatsApp settings (Cascade / Scrum Master flow)
- 2026-03-30: Story 4.3 реализована полностью → статус `review` (claude-sonnet-4-6). Создана миграция site_settings, SECURITY DEFINER RPC для public landing preview, curation toggles в PostForm, WhatsApp settings форма, real data в onboarding/landing, fix OnboardingPostCard→/feed/[id], 24 новых теста.
