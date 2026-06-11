---
title: 'Fix: рассылка о новых постах не доставляется (2 корня — self-fetch через apex→www + pg_cron не установлен)'
type: 'bugfix'
created: '2026-06-11'
baseline_commit: 'bf1be023'
status: 'done'
context:
  - '{project-root}/_bmad-output/project-context.md'
---

## Intent

**Problem:** Email-рассылка о публикации новых постов не доставляется ни для отложенных (scheduled), ни для немедленных (immediate) публикаций — в Resend Dashboard ноль попыток отправки. Диагностикой прода (11 июня 2026) установлено **ДВА независимых корня**; первоначальная гипотеза «только proxy блокирует `/api/notifications/`» оказалась неполной и привела бы к фиксу, не доставляющему письма.

**Корень A — immediate-ветка (и сам HTTP-путь рассылки):** `/api/posts/publish` и `/api/cron/publish` делают серверный self-fetch на `${NEXT_PUBLIC_SITE_URL}/api/notifications/new-post`. В Vercel `NEXT_PUBLIC_SITE_URL=https://procontent.si` (апекс), а канонический домен — `www.procontent.si`. Цепочка: Vercel 307-редиректит апекс→www (**кросс-доменный** редирект → `fetch`/undici срезает заголовок `Authorization: Bearer` по спецификации) → путь `/api/notifications/` отсутствует в `PUBLIC_PATH_PREFIXES`, middleware на www отвечает 307→`/login` → `fetch` (`redirect: 'follow'`) доходит до 200 login-страницы → `response.ok === true` → ветка `if (!ok) throw` НЕ срабатывает → **письмо молча теряется без единой строки в логах**. Это объясняет «ноль в Resend + никто не заметил + нет ошибок».

**Корень B — scheduled-ветка:** на боевой self-hosted БД (Hetzner) расширение `pg_cron` **не установлено** (`installed_version=null`, в `shared_preload_libraries` присутствует, но `CREATE EXTENSION pg_cron` не выполнен). Таблицы `cron.job` нет, `net._http_response` пуст → миграция `038` не применена → cron не срабатывал ни разу → scheduled-посты не автопубликуются (1 пост висел в `scheduled`) и уведомления по ним не шлются. Это следствие миграции Supabase Cloud → Hetzner (в Cloud pg_cron был включён из коробки).

**Approach:**
- **A:** устранить HTTP self-fetch как класс. Вынести логику рассылки из handler'а `new-post/route.ts` в чистую функцию `src/lib/notifications/sendNewPostNotification.ts` и вызывать её **напрямую** из `cron/publish` и `posts/publish`. Это убирает зависимость от домена, апекс→www-редиректа, Bearer и middleware целиком — рассылка перестаёт зависеть от сетевого слоя. Route `/api/notifications/new-post` остаётся тонкой обёрткой (собственная авторизация + парсинг → та же функция) для admin/ручных вызовов и не добавляется в публичные префиксы.
- **B:** инфраструктурный шаг (вне кодовой части, но в scope фикса как задача): установить `pg_cron` на боевой БД и применить миграцию `038` с **каноническим** URL `https://www.procontent.si` и актуальным `CRON_SECRET` (совпадающим с Vercel env). После этого cron публикует посты и — через фикс A — вызывает рассылку напрямую.

## Boundaries & Constraints

**Always:** Рассылка использует service-role Supabase-клиент (как сейчас в route — `SUPABASE_SERVICE_ROLE_KEY`). `sendNewPostNotification` — чистая async-функция без зависимости от `NextRequest`/`NextResponse`. Провал рассылки изолируется и НЕ откатывает публикацию поста. Route `/api/notifications/new-post` сохраняет собственную авторизацию (`Bearer NOTIFICATION_API_SECRET` или admin-session, timing-safe сравнение). snake_case для полей БД. Сохранить List-Unsubscribe/HMAC-подпись unsubscribe-URL.

**Ask First:** Полное удаление route `/api/notifications/new-post` (после того как прямой вызов отстоится в проде) — отдельный тикет. Изменение `NEXT_PUBLIC_SITE_URL` в Vercel на www (рекомендуется, но это infra-решение пользователя). Изменение схемы авторизации route.

**Never:** Не менять логику формирования писем, шаблон `new-post.ts`, фильтр подписчиков (`active`/`trialing` + `email_notifications_enabled`), санитизацию заголовка, нормализацию excerpt. Не ослаблять авторизацию route. Не добавлять `/api/notifications/` в `PUBLIC_PATH_PREFIXES` (после фикса A внутренние вызовы не идут по HTTP, внешних потребителей нет — путь остаётся непубличным). Не трогать timing-safe сравнения секретов. Не трогать cron-расписание `*/5` в 038.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Немедленная публикация | client `POST /api/posts/publish` (cookie/admin auth), пост в `scheduled` | пост → `published`, затем `await sendNewPostNotification({id,title,excerpt})` вызывается **напрямую** (без HTTP), `sendEmailBatch` получает сообщения | ошибка рассылки логируется, публикация НЕ откатывается |
| Отложенная публикация | pg_cron (после установки) → `POST /api/cron/publish` (`Bearer CRON_SECRET`) | посты → `published`, для каждого `sendNewPostNotification()` напрямую → Resend | env-guard внутри функции; ошибка одного поста не валит остальные |
| Прямой/admin вызов route | `POST /api/notifications/new-post` с валидным `Bearer NOTIFICATION_API_SECRET` ИЛИ admin-session | route парсит/валидирует → `sendNewPostNotification()` → Resend | route 401 при неверной авторизации |
| Внешний/неавторизованный вызов route | `POST /api/notifications/new-post` без cookie и без валидного Bearer | middleware 307→`/login` (путь непубличный); даже если бы дошёл — route вернул бы 401 | путь остаётся непубличным намеренно |
| pg_cron не установлен (корень B) | `cron.job` отсутствует | scheduled-посты не публикуются и не рассылаются | устраняется infra-задачей B (`CREATE EXTENSION pg_cron` + 038) |
| env не сконфигурирован | нет `NEXT_PUBLIC_SITE_URL`/`NOTIFICATION_API_SECRET`/`RESEND_API_KEY` | `sendNewPostNotification` ранний возврат с ошибкой, письмо не шлётся | проверяется в Verification (Vercel env) |

## Code Map

- `src/lib/notifications/sendNewPostNotification.ts` -- **НОВЫЙ**: чистая функция рассылки (вынос из handler'а)
- `src/lib/email/index.ts:` -- `sendEmailBatch` (используется как есть, не меняем)
- `src/lib/email/templates/new-post.ts` -- шаблон письма (НЕ меняем)
- `src/app/api/notifications/new-post/route.ts` -- handler: оставить auth (`isAuthorized`) + парсинг/валидацию, делегировать рассылку в новую функцию; удалить дублирующуюся логику (`fetchAllSubscribers`, сборка messages, `sendEmailBatch`)
- `src/app/api/posts/publish/route.ts:100-132` -- заменить self-fetch-блок на прямой `await sendNewPostNotification(...)`
- `src/app/api/cron/publish/route.ts:87-126` -- заменить self-fetch в цикле на прямой `await sendNewPostNotification(...)`
- `src/lib/app-routes.ts:16` -- `PUBLIC_PATH_PREFIXES`: НЕ добавлять `/api/notifications/` (фиксируем решение тестом)
- `supabase/migrations/038_pg_cron_publish_scheduled_posts.sql` -- применить на проде с www-URL (корень B, infra)
- `tests/unit/app/api/notifications/new-post/route.test.ts` -- обновить под делегирование
- `tests/unit/lib/email/email-service.test.ts` -- ориентир для мока `sendEmailBatch`

## Tasks & Acceptance

**Execution — код (корень A):**
- [x] `src/lib/notifications/sendNewPostNotification.ts` -- создать. Сигнатура `sendNewPostNotification(post: { id: string; title: string; excerpt?: string }): Promise<{ sent: number; failed: number }>`. Перенести из route: `createAdminClient` (service-role), `fetchAllSubscribers`, фильтр валидных email, сборку `messages` (postUrl, safeTitle, unsubscribeUrl + List-Unsubscribe заголовки), `sendEmailBatch`. **Контракт ошибок (зафиксировано):** при частичных провалах рассылки — **вернуть** `{ sent, failed }` (сохранить текущую семантику route: partial-fail НЕ должен триггерить ретраи/откат); **бросать** исключение только на hard-ошибках (отсутствует env, ошибка БД при загрузке подписчиков). `NOTIFICATION_API_SECRET` функции **обязателен** даже без self-fetch — он используется для HMAC-подписи unsubscribe-URL (RFC 8058). Env-guard: при отсутствии `NEXT_PUBLIC_SITE_URL` или `NOTIFICATION_API_SECRET` — бросать (НЕ молча). Без `NextRequest`/`NextResponse`.
- [x] `src/app/api/notifications/new-post/route.ts` -- оставить `isAuthorized` + парсинг тела (`record`-формат webhook и прямой) + валидацию (UUID, required fields); заменить тело рассылки на `await sendNewPostNotification(post)`; сохранить семантику ответа (partial-fail → 200).
- [x] `src/app/api/posts/publish/route.ts` -- удалить self-fetch (URL/Bearer/AbortController/`response.ok`), заменить на `await sendNewPostNotification({ id: post.id, title: post.title, excerpt: post.excerpt })` в try/catch; публикация НЕ откатывается при ошибке рассылки.
- [x] `src/app/api/cron/publish/route.ts` -- то же в цикле по `posts`; убрать `siteUrl`/`notificationSecret`-проверки для self-fetch; изоляция ошибок per-post сохраняется (`emailErrors`).

**Execution — инфраструктура (корень B, вне кода):**
- [ ] Боевая БД (`/pg/query` или SSH): `CREATE EXTENSION IF NOT EXISTS pg_cron;` (библиотека уже в `shared_preload_libraries`, `cron.database_name=postgres`).
- [ ] Применить миграцию `038` с `v_url := 'https://www.procontent.si'` (канонический www, НЕ апекс) и `v_secret := <актуальный CRON_SECRET из Vercel>`.
- [ ] Проверить: `SELECT command FROM cron.job WHERE jobname='publish-scheduled-posts';` (URL=www, секрет совпадает) и `cron.job_run_details` / `net._http_response` после первого тика.

**Execution — тесты:**
- [x] `tests/unit/lib/notifications/sendNewPostNotification.test.ts` -- мок supabase + `sendEmailBatch`: подписчики загружены и отфильтрованы, messages собраны с unsubscribe-URL, `sendEmailBatch` вызван; env-guard (нет env → ошибка, batch не вызван).
- [x] `tests/unit/app/api/notifications/new-post/route.test.ts` -- обновить: route делегирует в `sendNewPostNotification` (мок); 401 при неверном/отсутствующем Bearer и без admin-session сохраняется.
- [x] `tests/unit/app/api/posts/publish/route.test.ts` -- `sendNewPostNotification` вызван (НЕ `global.fetch`); при ошибке рассылки публикация не откатывается.
- [x] `tests/unit/app/api/cron/publish/route.test.ts` -- `sendNewPostNotification` вызван per-post; ошибка одного не валит остальные.
- [x] `tests/unit/lib/app-routes.test.ts` (или middleware) -- **инверсный страж**: `isPublicPath('/api/notifications/new-post') === false`; контроль `isPublicPath('/api/cron/publish') === true`.

**Acceptance Criteria:**
- **AC1 (immediate):** Given немедленная публикация поста, when пост опубликован, then `sendNewPostNotification` вызывается **напрямую** (без HTTP self-fetch) и `sendEmailBatch` получает сообщения; провал рассылки НЕ откатывает публикацию.
- **AC2 (scheduled) — ⚠️ проверяется ТОЛЬКО вручную на проде, не автоматизируется в CI:** Given `pg_cron` установлен и `038` применена (www-URL), when `scheduled_at <= now()`, then cron публикует посты и вызывает `sendNewPostNotification` → Resend (в `net._http_response` статус 200 на `/api/cron/publish`, в Resend появляются попытки). Зелёные unit-тесты НЕ закрывают этот AC — закрывается только проверкой `cron.job_run_details`/`net._http_response` + Resend Dashboard после infra-задачи B.
- **AC3 (route auth preserved):** Given `POST /api/notifications/new-post` без валидного Bearer и без admin-session, then 401 (через `isAuthorized`); путь остаётся непубличным.
- **AC4 (no self-fetch regression):** Given кодовая база, then в `cron/publish` и `posts/publish` НЕТ `fetch('${NEXT_PUBLIC_SITE_URL}/api/...')`.
- **AC5 (route stays internal):** Given `isPublicPath('/api/notifications/new-post')`, then `false`.

## Spec Change Log

- **2026-06-11 — readiness-review (bmad-check-implementation-readiness).** Вердикт: GO к реализации. Внесены три уточнения (не блокеры): (1) зафиксирован контракт ошибок `sendNewPostNotification` — return `{sent,failed}` при partial-fail, throw на hard-ошибках; (2) AC2 помечен как ручной (не автоматизируем в CI); (3) явно зафиксировано, что `NOTIFICATION_API_SECRET` остаётся обязателен для функции (HMAC unsubscribe).
- **2026-06-11 — pivot после диагностики прода (party-mode + пробинг).** Исходная спека ставила единственный корень «proxy блокирует `/api/notifications/`» и фикс «добавить префикс в `PUBLIC_PATH_PREFIXES`». Пробинг прода показал: (1) приложение на Vercel, `NEXT_PUBLIC_SITE_URL=апекс`, апекс→www-307 срезает Bearer на кросс-домене → фикс одним префиксом дал бы 401, письма всё равно нет; (2) immediate-ветка тоже сломана (тихий 200 на login-странице, `ok=true`); (3) scheduled сломана по другому корню — `pg_cron` не установлен на боевой БД, `038` не применена. Спека переписана под два корня: прямой вызов `sendNewPostNotification()` вместо self-fetch (A) + установка pg_cron/применение 038 (B). Решение «прямой вызов» — это `Ask First` по прежним Boundaries, авторизовано пользователем.

## Design Notes

**Почему прямой вызов, а не префикс.** Доказано пробингом: self-fetch на `${NEXT_PUBLIC_SITE_URL}` с апекс-доменом проходит цепочку `307 апекс→www` (кросс-домен → срез `Authorization`) и `307 www→/login` (непубличный путь). С `redirect:'follow'` финал — 200 login-страницы, `response.ok===true`, письмо теряется молча. Добавление префикса в публичные сняло бы только второй редирект, но первый (апекс→www) всё равно срезал бы Bearer → handler 401. Прямой вызов функции из того же процесса убирает домен, оба редиректа, Bearer и middleware из критического пути целиком — это устранение класса, а не симптома. Дополнительный выигрыш: исчезает лишний сетевой round-trip и секрет `NOTIFICATION_API_SECRET` перестаёт быть нужен для внутренних публикаций (остаётся только для admin/ручного вызова route).

**Почему два корня независимы.** Immediate-ветка не использует pg_cron, но тоже сломана → общий узел обеих веток — рассылка (корень A). Scheduled дополнительно мертва на инфра-уровне (корень B): без `pg_cron` сам триггер не срабатывает, и фикс A её не оживит, пока cron не запущен. Поэтому B обязателен отдельно.

**Рекомендация (вне scope, в Verification):** привести `NEXT_PUBLIC_SITE_URL` в Vercel к `https://www.procontent.si`. Прямой вызов делает доставку независимой от этого, но апекс-значение порождает апекс→www-редиректы в ссылках писем (postUrl, unsubscribeUrl) и в любых других возможных self-fetch — каноничный www убирает этот класс.

## Verification

**Commands:**
- `npm run typecheck` -- expected: 0 ошибок
- `npm run lint` -- expected: без новых ошибок
- `npm run test -- tests/unit/lib/notifications tests/unit/app/api/notifications tests/unit/app/api/posts tests/unit/app/api/cron tests/unit/lib/app-routes.test.ts` -- expected: все проходят, включая новые кейсы (прямой вызов, env-guard, инверсный страж публичности)
- `npm run build` -- expected: успешная сборка

**Manual checks (корень A):**
- Опубликовать тестовый пост («Опубликовать сейчас») → в Resend Dashboard появляется попытка отправки; в логах — НЕ «Email failed», а успешный `[notifications] Sent N/M`.
- Подтвердить в Vercel env наличие: `NOTIFICATION_API_SECRET`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `NEXT_PUBLIC_SITE_URL`.

**Manual checks (корень B):**
- На боевой БД: `SELECT * FROM pg_extension WHERE extname='pg_cron';` → строка присутствует после `CREATE EXTENSION`.
- `SELECT command FROM cron.job WHERE jobname='publish-scheduled-posts';` → URL=`https://www.procontent.si/api/cron/publish`, Bearer совпадает с Vercel `CRON_SECRET`.
- Дождаться тика (≤5 мин) или вызвать вручную → `SELECT status, status_code, error_msg FROM cron.job_run_details JOIN net._http_response USING(...) ORDER BY start_time DESC LIMIT 5;` → `status_code=200`; scheduled-пост перешёл в `published`; в Resend — попытка.
- Проверить egress из DB-контейнера Hetzner до `www.procontent.si` (pg_net): `status_code IS NOT NULL` в `net._http_response`.

**Recommended (infra, вне scope кода):**
- Vercel: `NEXT_PUBLIC_SITE_URL=https://www.procontent.si` (убирает апекс→www-редиректы в ссылках писем).

## Suggested Review Order

**Ядро рефакторинга — вынесенная функция рассылки (корень A)**

- Точка входа: чистая функция рассылки без NextRequest/NextResponse — design intent всего фикса.
  [`sendNewPostNotification.ts:98`](../../src/lib/notifications/sendNewPostNotification.ts#L98)

- Контракт ошибок: env-guard вне try/catch — hard-ошибки бросают, не замалчиваются.
  [`sendNewPostNotification.ts:101`](../../src/lib/notifications/sendNewPostNotification.ts#L101)

- Финал: partial-fail возвращается как `{ sent, failed }` (sendEmailBatch может бросить — это hard).
  [`sendNewPostNotification.ts:174`](../../src/lib/notifications/sendNewPostNotification.ts#L174)

**Устранение self-fetch у вызывающих (AC1, AC4)**

- Cron: прямой вызов в цикле, изоляция ошибок per-post (один сбой не валит остальные).
  [`route.ts:82`](../../src/app/api/cron/publish/route.ts#L82)

- Immediate: прямой вызов, провал рассылки НЕ откатывает публикацию.
  [`route.ts:100`](../../src/app/api/posts/publish/route.ts#L100)

**Route как тонкая обёртка — auth/валидация сохранены (AC3, AC5)**

- Делегирование рассылки после auth + парсинга + UUID-валидации; partial-fail → 200, throw → 500.
  [`route.ts:65`](../../src/app/api/notifications/new-post/route.ts#L65)

- isAuthorized: timing-safe сравнение Bearer + admin-session — без изменений.
  [`route.ts:86`](../../src/app/api/notifications/new-post/route.ts#L86)

**Тесты (поддержка)**

- Инверсный страж публичности: `/api/notifications/` остаётся непубличным.
  [`app-routes.test.ts:8`](../../tests/unit/lib/app-routes.test.ts#L8)

- Юнит-тесты функции: контракт ошибок, фильтрация, пагинация, unsubscribe.
  [`sendNewPostNotification.test.ts:1`](../../tests/unit/lib/notifications/sendNewPostNotification.test.ts#L1)
