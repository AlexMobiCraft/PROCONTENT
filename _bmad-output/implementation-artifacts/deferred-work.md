# Deferred Work

## Deferred from: code review of 4-2-managing-categories.md (2026-03-29) - Group 1
- **Hardcoded Slovenian categories (i18n concern)**: Миграция создаёт категории со словенскими именами и slug. Поддержка нескольких языков требует перевода категорий в отдельной миграции или рефакторинга seed-подхода. [supabase/migrations/021_create_categories.sql:38-47]
- **Missing UUID format validation in TypeScript types**: TypeScript `id?: string` в `categories.Insert` не имеет UUID-валидации — позволяет `id: "not-a-uuid"`. Runtime UUID-валидация нужна на уровне Zod/API route. Отложено до будущей реализации API route. [src/types/supabase.ts:42-45]

## Deferred from: code review of 4-2-managing-categories.md (2026-03-29) - Group 2
- **Media reordering race condition**: Concurrent upserts на post_media могут конфликтовать без транзакций. Pre-existing из Story 4.1; изолировано post_id FK constraint, но атомарные транзакции были бы безопаснее. [src/features/admin/api/posts.ts:186-206]
- **Cursor validation edge case**: Парсинг курсора ленты ("||id" state) запутан, хотя regex ловит невалидные. Pre-existing pattern, влияющий на пагинацию ленты, не на категории. [src/features/admin/api/posts.ts]
- **updatePost snapshot rollback loses concurrent updates**: Snapshot сделан один раз; concurrent обновления между snapshot + текстовым обновлением тихо перезаписываются rollback. Требует optimistic versioning или conflict detection. Отложено до будущей transactional редизайна. [src/features/admin/api/posts.ts:150-260]
- **Rollback failures silent — no AggregateError**: Ошибки очистки Storage проглатываются через `console.warn`. Вызывающий код считает rollback успешным. Best-effort design намеренный; AggregateError усложнил бы callers. Отложено. [src/features/admin/api/posts.ts:241-265]
- **Post deleted during snapshot-to-update window**: Concurrent удаление поста делает `.update()` успешным тихо (0 rows). Supabase client SDK не экспонирует affected row count без raw SQL. Отложено до optimistic locking. [src/features/admin/api/posts.ts:163-176]
- **MAX_MEDIA_FILES no server-side validation**: Клиентский лимит (10 файлов) можно обойти. Нет кастомного API route для re-validate. DB size limits — last resort. Отложено до реализации API route. [src/features/admin/api/posts.ts:43-45]
- **DRY violation: getCategories duplicated client/server**: Одинаковый 7-строчный запрос в `categories.ts` и `categoriesServer.ts`. Разные Supabase client initialisation patterns делают sharing нетривиальным. Отложено. [src/features/admin/api/categories.ts:11-17]
- **Orphaned Storage files on DB delete + cleanup failure**: `post_media` rows удалены, но очистка Storage может провалиться тихо. Требует отдельной scheduled cleanup job. Отложено. [src/features/admin/api/posts.ts:225-240]
- **Server-side re-validation of category before createPost/updatePost**: Категория удалена после загрузки формы но до submit → FK error на DB уровне. Нет кастомного API route для pre-check. FK constraint — enforcement layer. Отложено. [src/features/admin/api/posts.ts:60-80]

## Deferred from: code review of 4-2-managing-categories.md (2026-03-29) - Group 3
- **Input debounce missing**: Rapid onChange в input имени категории вызывает re-renders, но submission защищён isAdding lock. Low-priority performance optimization. [src/features/admin/components/CategoryManager.tsx:97-103]
- **Select styling not CVA component**: PostForm category select использует raw Tailwind className вместо reusable component wrapper. Code quality issue; функционально, но не идиоматично. Refactor при обновлении form inputs. [src/features/admin/components/PostForm.tsx:237]
- **Input sanitization assumption**: Sanitization имени категории полагается на backend validation. Frontend XSS риск обработан отдельно (aria-label escaping). Pre-existing pattern. [src/features/admin/components/CategoryManager.tsx:16-22]
- **No server-side validation of category before PostForm submit**: Если категория удалена после загрузки формы но до submit, клиент отправляет невалидный slug; error surface — только FK DB constraint. Требует кастомного API route. Отложено. [src/features/admin/components/PostForm.tsx:240-250]

## Deferred from: code review of 4-2-managing-categories.md (2026-03-29) - Group 4 (Tests)
- **posts.test: snapshot-to-update call sequence not enforced**: Test проверяет, что `update` вызван дважды, но не порядок (сначала snapshot, потом update). Strict sequence требует mock redesign. [tests/unit/features/admin/api/posts.test.ts:239-265]
- **PostCard: onLikeToggle double-fire without isPending**: `isPending` опционален (defaults false); caller без него позволяет два RPC вызова при быстрых кликах. Pre-existing optional prop pattern. [tests/unit/components/feed/PostCard.test.tsx:64-67]
- **posts.test: makeChain upsert mock missing .select()**: `upsert` не использует `.select()` в текущей реализации; mock точен. Если impl изменится, mock сломается тихо. False positive — действий не нужно. [tests/unit/features/admin/api/posts.test.ts:9-19]
- **PostForm edit mode: stale category test missing**: После удаления категории на server-side, форма всё ещё содержит stale slug. Client-side stale detection требует re-fetching при submit (нет API route). Отложено с server-side validation. [tests/unit/features/admin/components/PostForm.test.tsx]
- **Server-side category re-validation test**: Test coverage заблокировано отсутствием кастомного API route. Отложено с server-side validation finding. [tests/unit/features/admin/api/posts.test.ts]
- **Rollback AggregateError propagation test**: AggregateError pattern отложен; test покрывал бы несуществующее поведение. [tests/unit/features/admin/api/posts.test.ts:239-265]
- **Mock chain method-order enforcement**: `makeChain()` использует `mockReturnThis()` без order tracking. Все методы вызываемы в любом порядке. Low-priority code quality improvement. [tests/unit/features/admin/api/categories.test.ts]
- **Delete loading state timeout scenarios**: Pre-existing timeout handling pattern; low priority. [tests/unit/features/admin/components/CategoryManager.test.tsx]
- **LazyMediaWrapper network error scenarios**: Pre-existing media error handling; покрыто в Story 2.3. [tests/unit/components/feed/PostCard.test.tsx]
- **post.likes negative value validation**: Pre-existing data validation; не story-specific. [tests/unit/components/feed/PostCard.test.tsx]
- **Async initialData loading race in PostForm tests**: Pre-existing async pattern, влияющий на множество компонентов. [tests/unit/features/admin/components/PostForm.test.tsx]
- **derivePostType() with invalid media_type**: Pre-existing enum validation; покрыто отдельно. [tests/unit/features/admin/api/posts.test.ts]
- **newIdx tracking with mixed existing/new media items**: Pre-existing algorithm edge case; low-priority optimisation. [tests/unit/features/admin/api/posts.test.ts]
- **Rollback concurrent field overwrite in tests**: Pre-existing concurrency pattern; требует transaction redesign. [tests/unit/features/admin/api/posts.test.ts]
- **toSlug() with unicode characters**: Pre-existing i18n pattern; влияет на форму глобально. [tests/unit/features/admin/components/CategoryManager.test.tsx]

## Deferred from: code review (2026-03-27) - 3-4-automatic-email-notifications-new-posts.md

### Раунды 1 и 2
- **Нет rate limiting / идемпотентности**: At-least-once доставка Supabase Webhook может привести к дубликатам писем при сбоях. [src/app/api/notifications/new-post/route.ts:39]
- **Безопасность Admin Auth**: Проверка роли полагается на колонку 
ole, которая при ошибках в RLS может быть уязвима. [src/app/api/notifications/new-post/route.ts:113]
- **Последовательные batch sends**: При большом количестве подписчиков риск превышения таймаута лямбды (10-15с). [src/lib/email/index.ts:48]
- **Unsubscribe link is not "one-click"**: Текущая ссылка ведет в профиль, а не выполняет мгновенную отписку по токену. Ожидается в Story 3.5. [src/app/api/notifications/new-post/route.ts:132]

## Deferred from: code review of 3-4-automatic-email-notifications-new-posts.md (2026-03-27) - Final Triage
- **Риск переполнения памяти (OOM)**: Функция fetchAllSubscribers собирает всех активных подписчиков в один массив. При росте базы это приведет к падению серверной функции. [src/app/api/notifications/new-post/route.ts:111]
- **Ограниченная конкурентность**: Последовательная отправка батчей по 100 писем рискует превысить таймаут Vercel при большом количестве подписчиков. [src/lib/email/index.ts:48]
- **Отсутствие Retry-логики**: Сбой одного батча из-за сети помечает его как failed навсегда без попыток переотправки. [src/lib/email/index.ts]

## Deferred from: code review of 3-4-automatic-email-notifications-new-posts.md (2026-03-27) - Round 7
- **_resend singleton не сбрасывается при ротации ключа**: Если RESEND_API_KEY меняется в runtime, устаревший клиент используется до следующего cold start — все письма будут падать с 401 от Resend без явного сигнала. [src/lib/email/index.ts:3]
- **etchAllSubscribers без верхнего предела**: Все подписчики накапливаются в один массив в памяти. При 50 000+ записях растёт задержка до первой отправки и расход памяти serverless-функции.  [src/app/api/notifications/new-post/route.ts:49]
- **sendEmailBatch без таймаута на чанк**: Зависание Resend API блокирует функцию до Vercel timeout (504); retry вебхука Supabase дублирует письма подписчикам из уже успешных чанков. [src/lib/email/index.ts:46]

## Deferred from: code review of 3-4-automatic-email-notifications-new-posts.md (2026-03-27) - Round 5
- **excerpt поле зависит от Story 4.1**: post.excerpt принимается route handler'ом и передаётся в шаблон, но таблица posts может не содержать этого поля до реализации Story 4.1. Пока excerpt приходит как undefined — шаблон отображает без excerpta. [src/app/api/notifications/new-post/route.ts:16]

## Deferred from: code review of 4-1-creating-and-editing-multimedia-posts.md (2026-03-29) - Round 4
- Отсутствие генерации миниатюр для видео (жесткий null) — deferred: требует бэкенд процессинга [src/features/admin/api/posts.ts]
- Хрупкая логика отката в createPost при сбое сети — deferred: архитектурное ограничение клиента (недоступность RPC транзакций) [src/features/admin/api/posts.ts]
- Определение MIME-типа по расширению — deferred: идеальное решение (магические числа) требует тяжелых библиотек [src/features/admin/components/MediaUploader.tsx]
- Тихие утечки при удалении старых медиа (best-effort очистка) — deferred: осознанный компромисс из Round 3 для избежания блокировки UI [src/features/admin/api/posts.ts]

## Deferred from: code review of 4-1-creating-and-editing-multimedia-posts.md (2026-03-29)
- Индекс порядка (order_index) может иметь пробелы [src/features/admin/api/posts.ts]
- Тихое проглатывание ошибок при откате [src/features/admin/api/posts.ts]
- Promise.allSettled скрывает индивидуальные ошибки [src/features/admin/api/uploadMedia.ts]
- Жестко закодированное имя бакета для хранилища [src/features/admin/api/uploadMedia.ts]
- Защитная проверка derivePostType скрывает неожиданные типы [src/features/admin/api/posts.ts]
- Отсутствуют заголовки кэширования файлов при загрузке [src/features/admin/api/uploadMedia.ts]
- Отсутствует атомарная транзакция для updatePost [src/features/admin/api/posts.ts]
- Удаление файла во время его загрузки (рассинхронизация) [src/features/admin/components/MediaUploader.tsx]

## Code Review Findings: Profile Setup Feature (2026-03-30)

Adversarial review выявил 13 findings которые требуют внимания:

### HIGH PRIORITY

- **Server-side валидация first_name** — Текущая валидация только на клиенте (HTML5 required + minLength=3). Нужна server-side проверка в API route или middleware перед insert/update в БД. [src/features/auth/components/RegisterContainer.tsx]

- **MIME type validation для avatar** — Нет проверки что загруженный файл действительно изображение. Пользователь может загрузить .jpg.exe или другой опасный файл. Добавить server-side MIME type check через magic numbers или Content-Type header validation. [src/features/profile/api/profileApi.ts:56]

- **Server-side size validation для avatar** — MAX_AVATAR_SIZE проверяется только на клиенте. Пользователь может обойти через curl/postman и загрузить 100MB файл. Добавить server-side check перед uploadSingleFile. [src/features/profile/api/profileApi.ts:56]

- **Race condition: signup → profile update** — После signUp() вызывается updateProfile() но нет гарантии что trigger handle_new_user создал профиль. Если updateProfile выполниться первым, может обновить несуществующий row (0 rows affected). Нужна retry логика или проверка affected rows count. [src/features/auth/components/RegisterContainer.tsx:27]

- **Ошибка profile update не показана пользователю** — После успешного signup, если updateProfile поломается, только console.warn. Пользователь видит "письмо отправлено" но first_name не сохранён в БД. Нужно показать ошибку в UI. [src/features/auth/components/RegisterContainer.tsx:30]

- **Concurrent avatar uploads не заблокированы** — Пользователь может быстро кликнуть на upload несколько раз. isLoading защищает button но не API. Нужна флаг в component state чтобы предотвратить parallel requests. [src/features/profile/components/ProfileEditCard.tsx:68]

### MEDIUM PRIORITY

- **last_name может содержать только пробелы** — Нет trim() перед сохранением. Пользователь может ввести "   " и это сохранится как валидный last_name. Добавить trim() в RegisterContainer и ProfileEditCard. [src/features/auth/components/RegisterContainer.tsx:27, src/features/profile/components/ProfileEditCard.tsx]

- **Отсутствует maxLength валидация для first_name** — Клиентская валидация только minLength=3. Пользователь может ввести 10000+ символов. Добавить maxLength (например, 100) на input и в server-side валидацию. [src/features/auth/components/RegisterForm.tsx:67]

- **Filename санитизация insufficient** — generateAvatarPath() использует file.name без escaping. Пользователь может загрузить файл с "../" в имени и потенциально выгрузить файл вне avatars папки. Добавить более строгую санитизацию (только alphanumeric + . -). [src/features/profile/api/profileApi.ts:13]

- **deleteAvatarFile URL парсинг fragile** — Regex `/\/avatars\/(.+)$/` может провалиться если URL содержит URL-encoded спецсимволы или был изменён. Нужна более robust парсинг или использование URL API. [src/features/profile/api/profileApi.ts:89]

### ARCHITECTURAL

- **Trigger handle_new_user может перезаписать данные** — Migration использует ON CONFLICT но DEFAULT '' может перезаписать existing first_name на пустую строку при повторном trigger срабатывании. Нужно использовать COALESCE чтобы не перезаписывать существующие значения. [supabase/migrations/036_add_user_profile_fields.sql:16]

- **Orphaned files в Storage при ошибке updateProfile** — Если uploadAvatar() успешен но updateProfile() провалится, файл остаётся в Storage. deleteAvatarFile() вызывается только при успехе на old аватаре. Нужна cleanup job для orphaned файлов или retry updateProfile. [src/features/profile/components/ProfileEditCard.tsx:68]

- **Integration тесты отсутствуют** — ProfileEditCard и RegisterContainer тесты используют mocks. Нет real Supabase тестов для валидации что data действительно сохраняется. Нужны integration тесты с real Supabase или testcontainers. [tests/unit/features/profile/ProfileEditCard.test.tsx, tests/unit/features/auth/RegisterForm.test.tsx]

