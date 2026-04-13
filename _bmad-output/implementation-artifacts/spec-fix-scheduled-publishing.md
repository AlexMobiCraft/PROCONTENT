---
title: 'Fix: scheduled publishing не работает'
type: 'bugfix'
created: '2026-04-13'
baseline_commit: '4199bad9'
status: 'done'
context:
  - '{project-root}/_bmad-output/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Запланированные посты не публикуются автоматически. Пост остаётся в `status: scheduled` спустя 5 дней после `scheduled_at`. Два корневых бага: (1) миграция 038 (pg_cron задача) не применена к продакшн-базе, (2) прокси блокирует cron-эндпоинт, потому что `/api/cron/` не в списке публичных маршрутов.

**Approach:** Добавить `/api/cron/` в публичные пути, применить миграцию 038 с реальными значениями, немедленно опубликовать застрявший пост.

## Boundaries & Constraints

**Always:** Использовать service_role_key для публикации постов (обход RLS). Сохранять timing-safe сравнение для CRON_SECRET. snake_case для полей БД.

**Ask First:** Изменение расписания cron (сейчас */5 мин). Удаление/замена миграции 038.

**Never:** Не менять логику cron-эндпоинта. Не трогать email-нотификации. Не менять UI планирования.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Proxy + cron request | `POST /api/cron/publish` с `Authorization: Bearer <CRON_SECRET>`, без session cookie | ПроксИ пропускает запрос, cron handler выполняет публикацию | Handler сам проверяет CRON_SECRET и возвращает 401/500 |
| Застрявший пост | `status=scheduled, scheduled_at < now()` | `status=published, published_at=now(), is_published=true` | Idempotent через `published_at IS NULL` |

</frozen-after-approval>

## Code Map

- `src/proxy.ts` -- перехватывает все запросы, вызывает updateSession
- `src/lib/app-routes.ts:16` -- PUBLIC_PATH_PREFIXES, отсутствует `/api/cron/`
- `src/lib/supabase/auth-middleware.ts` -- updateSession, проверяет auth и подписку
- `src/app/api/cron/publish/route.ts` -- cron handler, атомарный UPDATE + email нотификации
- `supabase/migrations/038_pg_cron_publish_scheduled_posts.sql` -- pg_cron задача (не применена)

## Tasks & Acceptance

**Execution:**
- [x] `src/lib/app-routes.ts` -- добавить `/api/cron/` в PUBLIC_PATH_PREFIXES, чтобы прокси пропускал cron-запросы без Supabase сессии
- [x] `supabase/migrations/038_pg_cron_publish_scheduled_posts.sql` -- применить миграцию к продакшн-базе с реальными значениями: `v_url := 'https://procontent.si'`, `v_secret := <CRON_SECRET>`. Перед применением убедиться, что pg_cron и pg_net расширения включены в Supabase Dashboard
- [x] немедленно опубликовать застрявший пост — вызвать `POST /api/cron/publish` с `Authorization: Bearer <CRON_SECRET>` после деплоя фикса прокси (cron handler атомарно обновит все посты с `status=scheduled, scheduled_at <= now()`)

**Acceptance Criteria:**
- Given запрос `POST /api/cron/publish` с Bearer токеном, when без session cookie, then прокси пропускает, handler возвращает 200
- Given pg_cron задача `publish-scheduled-posts`, when `scheduled_at <= now()`, then пост получает `status=published` в течение 5 минут
- Given застрявший пост с `id=277f5141...`, when выполняется публикация, then `status=published, published_at IS NOT NULL, is_published=true`

## Verification

**Commands:**
- `npm run build` -- expected: успешная сборка
- `npm run typecheck` -- expected: 0 ошибок
- `npm run test -- tests/unit/app/api/cron/publish/route.test.ts` -- expected: все тесты проходят

**Manual checks:**
- В Supabase Dashboard → Extensions: `pg_cron` и `pg_net` включены
- В Supabase Dashboard → SQL Editor: `SELECT * FROM cron.job WHERE jobname = 'publish-scheduled-posts'` возвращает 1 строку
- В Supabase Dashboard → Table Editor → posts: застрявший пост имеет `status=published`

## Suggested Review Order

- Добавление `/api/cron/` в публичные пути — прокси пропускает cron-запросы без Supabase сессии
  [`app-routes.ts:16`](../../src/lib/app-routes.ts#L16)

- Cron handler с собственной Bearer-токен авторизацией (timingSafeEqual) — подтверждение защиты
  [`route.ts:19`](../../src/app/api/cron/publish/route.ts#L19)
