---
title: 'Устранение шумной ошибки «Auth session missing!» на self-auth API (cron/webhooks/checkout)'
type: 'bugfix'
created: '2026-06-12'
status: 'done'
baseline_commit: 'a504c2ee1d89b4f926255347138b5d000d64b609'
context: ['{project-root}/_bmad-output/project-context.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Vercel cron дёргает `POST /api/cron/publish` без cookies. Proxy (`updateSession`) всё равно вызывает `supabase.auth.getUser()`, который для запроса без сессии возвращает `AuthSessionMissingError` и логирует `[middleware] User check error: Auth session missing!`. Публикация при этом работает (путь публичный, редиректа на `/login` нет), но лог засоряет ошибки на Vercel ложным error.

**Approach:** В `updateSession` добавить ранний `return NextResponse.next({ request })` для self-authenticating серверных эндпоинтов (`/api/webhooks/`, `/api/checkout`, `/api/cron/`) — до создания Supabase-клиента и вызова `getUser`. Эти роуты авторизуются сами (CRON_SECRET, подпись Stripe) и не используют пользовательскую сессию, поэтому прогон auth-логики для них лишний.

## Boundaries & Constraints

**Always:** Skip должен стоять в самом начале `updateSession` — до env-guard и до `getUser`, чтобы при любом состоянии (в т.ч. отсутствии env) self-auth API проходил насквозь, а не редиректился. Список self-auth префиксов держать отдельной константой/хелпером в `app-routes.ts`, не дублируя строки. Self-auth API всегда возвращает `NextResponse.next` (passthrough), никогда не редирект.

**Ask First:** Расширение списка self-auth префиксов за пределы трёх (`/api/webhooks/`, `/api/checkout`, `/api/cron/`) — например, добавление `/api/email/unsubscribe`.

**Never:** НЕ трогать `/auth/` префикс (auth callbacks используют сессию). НЕ менять поведение редиректа для защищённых не-публичных API-роутов (`/api/email/other` и т.п. должны по-прежнему редиректиться на `/login`). НЕ убирать сам `console.error` на строке 140 (он полезен для реальных ошибок на страницах). НЕ менять матчер в `proxy.ts`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Cron без cookies | `POST /api/cron/publish`, нет сессии | `NextResponse.next` (passthrough), `getUser` НЕ вызван, лог НЕ пишется | N/A |
| Webhook Stripe | `POST /api/webhooks/stripe` | passthrough, `getUser` НЕ вызван | N/A |
| Checkout | `POST /api/checkout` | passthrough, `getUser` НЕ вызван | N/A |
| Self-auth API без env | self-auth путь, нет `NEXT_PUBLIC_SUPABASE_URL` | passthrough (НЕ редирект на `/login`) | N/A |
| Защищённый API | `GET /api/email/other`, нет сессии | редирект 307 на `/login` (поведение без изменений) | N/A |
| Защищённая страница | `GET /feed`, нет сессии | редирект 307 на `/login` (без изменений) | N/A |
| Публичная unsubscribe | `GET /api/email/unsubscribe?...` | passthrough (без изменений; вне self-auth списка) | N/A |

</frozen-after-approval>

## Code Map

- `src/lib/supabase/auth-middleware.ts` -- `updateSession`: строка 136 `getUser()`, строки 139-141 — источник лога. Сюда добавить ранний skip.
- `src/lib/app-routes.ts` -- `PUBLIC_PATH_PREFIXES`, `isPublicPath`. Добавить `SELF_AUTHENTICATED_API_PREFIXES` + хелпер.
- `src/proxy.ts` -- точка входа; матчер ловит `/api/*`. Без изменений (контекст).
- `src/app/api/cron/publish/route.ts` -- затронутый cron-эндпоинт, авторизуется через `CRON_SECRET` (контекст).
- `tests/unit/middleware.test.ts` -- тесты `updateSession`, паттерн `expect(mockGetUser).not.toHaveBeenCalled()`. Сюда добавить кейсы.

## Tasks & Acceptance

**Execution:**
- [x] `src/lib/app-routes.ts` -- добавить `export const SELF_AUTHENTICATED_API_PREFIXES = ['/api/webhooks/', '/api/checkout', '/api/cron/'] as const` и `export function isSelfAuthenticatedApiPath(pathname: string)`, проверяющий `startsWith` по префиксам -- единый источник правды для self-auth путей.
- [x] `src/lib/supabase/auth-middleware.ts` -- в самом начале `updateSession` (до env-guard) добавить: если `isSelfAuthenticatedApiPath(request.nextUrl.pathname)` → `return NextResponse.next({ request })` -- self-auth API проходит без auth-логики и логов.
- [x] `tests/unit/middleware.test.ts` -- добавить describe-блок: для каждого self-auth префикса проверить `response.status !== 307` и `expect(mockGetUser).not.toHaveBeenCalled()`; отдельный кейс — self-auth путь при отсутствии env даёт passthrough (не 307); регресс-кейс — `/api/email/other` без сессии по-прежнему редиректит на `/login` (он уже есть, убедиться, что не сломан) -- покрыть I/O Matrix.

**Acceptance Criteria:**
- Given cron-запрос `POST /api/cron/publish` без cookies, when проходит через `updateSession`, then `getUser` не вызывается и `[middleware] User check error` не логируется.
- Given любой self-auth префикс из списка, when обрабатывается прокси, then возвращается passthrough (не редирект), даже если Supabase env не задан.
- Given защищённый не-публичный маршрут (`/feed`, `/api/email/other`) без сессии, when обрабатывается прокси, then поведение редиректа на `/login` сохраняется без изменений.

## Verification

**Commands:**
- `npm run test -- middleware` -- expected: новые и существующие кейсы `updateSession` зелёные.
- `npm run typecheck` -- expected: без ошибок типов.
- `npm run lint` -- expected: без новых предупреждений.

## Suggested Review Order

**Skip-логика (entry point)**

- Точка входа: ранний passthrough self-auth API до env-guard и `getUser`.
  [`auth-middleware.ts:108`](../../src/lib/supabase/auth-middleware.ts#L108)

- Единый источник правды: список self-auth префиксов (без `/auth/`).
  [`app-routes.ts:23`](../../src/lib/app-routes.ts#L23)

- Хелпер-предикат `startsWith` по префиксам.
  [`app-routes.ts:47`](../../src/lib/app-routes.ts#L47)

**Тесты**

- Passthrough + `getUser` не вызван для каждого префикса; passthrough без env; `/auth/` не затронут.
  [`middleware.test.ts:170`](../../tests/unit/middleware.test.ts#L170)
