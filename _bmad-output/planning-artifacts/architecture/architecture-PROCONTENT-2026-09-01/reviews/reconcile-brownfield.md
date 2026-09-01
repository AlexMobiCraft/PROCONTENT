# Brownfield reconciliation — Temporary One-Time Access

**Дата:** 2026-09-01  
**Scope:** `ARCHITECTURE-SPINE.md`, текущая `architecture.md` и целевые brownfield-точки Stripe webhook, auth middleware, auth confirm, new-post notifications и RLS helper.

## Verdict

**NOT MIGRATION-READY.** Spine и текущая архитектура согласованы по основному продуктово-архитектурному решению: один immutable grant на `(offer_code, purchaser_email_normalized)`, последующая paid Session не продлевает доступ и сохраняется как non-granting exception. Это решение уже принято в `ARCHITECTURE-SPINE.md` AD-3 и `architecture.md` AD-TA3; повторная элицитация не нужна.

Brownfield реализация пока содержит пять обязательных migration seams. Самый серьёзный — доступ к опубликованному контенту всё ещё имеет anonymous RLS surface, поэтому замена только `is_active_subscriber()` не создаст заявленный единый access PDP.

## Findings

### 1. [CRITICAL] Canonical resolver не закроет существующий anonymous content surface

- `supabase/migrations/046_vip_access_in_rls.sql` меняет только `public.is_active_subscriber()` и учитывает VIP/recurring; admin остаётся отдельной policy-композицией в миграции 047.
- При этом миграции 033 и 034 разрешают роли `anon` читать published `posts` и `post_media`. Эти permissive policies обходят subscriber/resolver policy для прямых Data API запросов. Текущий public storage pattern дополнительно требует отдельной проверки на утечку media URL.
- `post_comments` также имеет неодинаковую policy-композицию: SELECT/INSERT учитывают доступ, а UPDATE/DELETE собственного комментария не везде требуют active access.
- Это прямой конфликт с AD-TA6/AD-6, где RLS должен потреблять одно решение resolver. Нужен явный inventory и переход всех content policies, а не точечное переопределение функции из миграции 046.

### 2. [HIGH] Middleware содержит три независимых access path и старый cache contract

- `src/lib/supabase/auth-middleware.ts` отдельно вычисляет доступ на `/inactive`, в protected-route branch и в signed-cookie fast path. Условия `role/is_vip/subscription_status` дублируются.
- `/inactive` дополнительно обращается к Stripe и мутирует recurring profile state; это brownfield reconciliation behavior, которое нельзя незаметно смешать с entitlement resolver.
- `__sub_status` подписывает только `userId:status`; token не содержит `evaluated_at`/`valid_until`, а parser не может отклонить достигнутый entitlement deadline.
- Переход на AD-TA6/AD-TA7 должен охватить все три ветки и предусмотреть successor/versioning либо принудительную инвалидизацию старого cookie. Замена только основной profile query оставит расходящиеся решения.

### 3. [HIGH] Claim lifecycle не имеет полного server-side trigger coverage

- `src/app/auth/confirm/route.ts` после успешной verification синхронизирует только recurring Stripe subscription с `profiles`; atomic entitlement claim отсутствует.
- Этот Stripe lookup намеренно пропускается для `recovery`/`invite`, а уже подтверждённый purchaser может вообще не проходить `/auth/confirm` после оплаты.
- Архитектура уже требует claim после verified confirmation и на authenticated post-payment/login return. Следовательно, реализация только в `/auth/confirm` оставит unclaimed entitlements у ранее зарегистрированных покупателей. Нужен явный перечень серверных entry points, вызывающих один idempotent claim RPC; Checkout Session ID остаётся только UX hint.

### 4. [HIGH] Webhook envelope пригоден, но one-time dispatch и atomic fulfillment отсутствуют

- `src/app/api/webhooks/stripe/route.ts` корректно читает raw body и проверяет Stripe signature, но текущий `checkout.session.completed` handler немедленно игнорирует любой `mode != 'subscription'`.
- Switch не обрабатывает `checkout.session.async_payment_succeeded`. Текущая idempotency относится к recurring profile updates и не создаёт immutable payment/audit record.
- One-time path должен быть отдельной mode/event веткой, сохранив существующие recurring handlers без изменений. Fulfillment, Session idempotency, one-grant constraint, duplicate/ineligible exception и календарный expiry должны завершаться одной DB transaction; последовательные Supabase writes текущего handler такого контракта не дают.
- Отдельно остаётся уже задокументированный approval gate: семантика `paid_at` принята, но точный Stripe field/event mapping и DST/month-end fixtures ещё не утверждены.

### 5. [MEDIUM] Email audience сейчас знает только recurring status

- `src/lib/notifications/sendNewPostNotification.ts` service-role запросом выбирает только `profiles.subscription_status IN ('active','trialing')` и `email_notifications_enabled=true`.
- Temporary users не попадут в рассылку, пока pipeline не перейдёт на service-role-only recipient RPC, основанный на resolver.
- При миграции нужно сохранить текущую audience policy: recurring recipients остаются, temporary source добавляется, VIP/admin-only не добавляются автоматически; preferences, pagination и дедупликация пользователя с несколькими access sources должны сохраниться.

## Decision/status precision

- AD-3 и AD-4 в spine не имеют метки `[ADOPTED]`, хотя соответствующие правила уже записаны как обязательные в текущей `architecture.md`. Это status-label drift, а не отсутствие решения.
- Для `paid_at` принято правило «immutable Stripe-origin timestamp первого принятого paid-event», но `architecture.md` одновременно оставляет exact event-field mapping в approval gate. Поэтому повторно выбирать общую семантику не нужно; до реализации требуется только закрыть точное техническое отображение и fixtures.
- Пункт Storage Architecture «public URLs через `createSignedUrl()` или `public: true`» слишком широкий для платного контента и должен быть согласован с RLS/PDP до implementation readiness.

## Reconciliation outcome

Spine можно использовать как design substrate после фиксации перечисленных migration seams в implementation stories/migrations. Исходные документы в рамках этой проверки не изменялись.
