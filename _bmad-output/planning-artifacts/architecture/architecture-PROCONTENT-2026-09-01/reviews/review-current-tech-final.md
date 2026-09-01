# Final Current-Technology Re-check

**Дата:** 2026-09-01  
**Проверен:** обновленный `ARCHITECTURE-SPINE.md` против findings из `review-current-tech.md`  
**Scope:** Next patched target, Stripe Session retrieval/line items, direct-Link/open-Session cutoff, qualifying event timestamp, Supabase table/function privilege invariants. Spine не изменялся.

## Verdict

**NEEDS TWO HIGH-SEVERITY RECONCILIATIONS.**

Обновленный Spine закрыл три из пяти целевых technology blockers:

- patched Next.js target теперь является явным launch gate;
- fulfillment обязан retrieve canonical Checkout Session server-side с expanded `line_items`;
- direct/shared Payment Link признан bypass app redirect gate, а non-granting payment направляется в refund/support exception path.

Остаются два High findings: temporal/cutoff contract внутренне противоречив и private resolver privilege rule несовместим с прямым вызовом из RLS.

## Verification matrix

| Re-check item | Result | Evidence |
| --- | --- | --- |
| Next patched target | **RESOLVED IN SPINE** | Stack требует `16.3.3`, current `16.1.6` объявлен launch-blocked; Deferred требует `16.3.3 or newer` before implementation/launch (Spine:126, 173). Official August 2026 Next.js security release names `16.3.3` as patched Active LTS target; `or newer` prevents accidental ceiling. Actual dependency upgrade remains delivery evidence, not architecture finding. |
| Retrieved Session + expanded line items | **RESOLVED IN SPINE** | AD-2 теперь требует signature verification, server-side Session retrieval и expanded `line_items` before exact Link/Price/metadata/amount/currency/quantity validation (Spine:48-52). Это соответствует [Stripe fulfillment contract](https://docs.stripe.com/checkout/fulfillment?payment-ui=stripe-hosted). |
| Direct-Link bypass | **RESOLVED IN SPINE** | AD-8 прямо признает, что saved/shared direct Link bypass-ит app gate; ineligible/duplicate payment не grants и требует approved refund/support path (Spine:93-96, 166). |
| Open Session at cutoff | **PARTIAL / HIGH REMAINS** | Link deactivation и late payment semantics все еще не дают непротиворечивого classification; см. F-01. |
| Qualifying event timestamp | **PARTIAL / HIGH REMAINS** | AD-2 выбирает `event.created`, AD-4 использует другое/неутвержденное wording; см. F-01. |
| Table privileges | **RESOLVED IN SPINE** | AD-10 фиксирует RLS, no anon/authenticated table privileges, service-role DML without DELETE, trusted-server mutation boundary (Spine:104-109). |
| Function/RPC privileges | **PARTIAL / HIGH REMAINS** | Public wrapper grants описаны, но private resolver execution rule конфликтует с direct RLS call; см. F-02. |

## Remaining Critical/High findings

### F-01 — HIGH — `paid_at`, qualifying event и cutoff/open-Session semantics противоречат друг другу

**Evidence**

- AD-2 теперь говорит, что `paid_at` равен `event.created` qualifying event: paid `checkout.session.completed` либо `checkout.session.async_payment_succeeded` (Spine:52).
- AD-4 одновременно говорит, что `paid_at` — `first accepted Stripe paid-event timestamp`, остается `[REQUIRES APPROVAL]`, а final Stripe mapping отдельно deferred (Spine:61-65, 167).
- AD-8 говорит: `Webhook retries remain processable by immutable paid_at: in-window payments may finish after cutoff, out-of-window payments do not grant` (Spine:96).
- Для delayed payment Session, завершенной checkout до cutoff с `payment_status='unpaid'`, единственный qualifying event — `checkout.session.async_payment_succeeded` после cutoff. По AD-2 его `event.created` находится после cutoff, поэтому это out-of-window payment и grant невозможен. Это противоречит формулировке, что in-window payment может finish after cutoff.
- Для заранее открытой direct-Link Session, оплаченной после cutoff, происходит та же неоднозначность: Session creation была in-window, но qualifying paid event — after-cutoff.
- Stripe гарантирует neither event delivery ordering nor uniqueness of event timestamps and прямо говорит не использовать snapshot event `created` для определения порядка; event IDs предназначены для delivery deduplication. См. [Stripe webhook event ordering](https://docs.stripe.com/webhooks#event-ordering).
- Payment Link `active=false` документирован только как deactivated page для последующих visits; открытая Checkout Session имеет собственный lifecycle и отдельно может быть expired. См. [Update Payment Link](https://docs.stripe.com/api/payment-link/update) и [Expire Checkout Session](https://docs.stripe.com/api/checkout/sessions/expire).

**Impact**

Одинаковый реальный payment journey нельзя однозначно классифицировать как grant/refund по тексту Spine. Реализация может либо отказать purchaser, который начал payment вовремя, либо grant-ить after-cutoff purchase, либо использовать processing order как скрытое правило. AD-4 при этом еще не approved.

**Required reconciliation**

Выбрать один неизменный contract и применить его одинаково в AD-2, AD-4, AD-8 и Deferred:

1. **Payment-success window:** eligibility определяется canonical paid-success time; любое success после cutoff non-granting/refund, даже если Session создана раньше. Тогда удалить `in-window payments may finish after cutoff` либо определить его только как webhook retry уже случившейся in-window оплаты.
2. **Session-creation window:** Session, созданная до cutoff, может async-succeed после cutoff и grant-ить; тогда cutoff key — canonical `session.created`, а `paid_at` остается отдельным payment-success/audit time и не определяет offer eligibility.

В обоих вариантах duplicate webhook delivery должна dedupe-иться по Session ID и event/object audit keys; `first accepted` processing order нужно удалить. Open-Session late-payment refund/support behavior должен быть explicit, а не выводиться из Link deactivation.

### F-02 — HIGH — Private resolver запрещен для `authenticated`, но RLS должен вызывать его напрямую

**Evidence**

- AD-6 говорит: `RLS calls it with auth.uid()` и private helpers используют `search_path=''` (Spine:78-80).
- AD-10 говорит: `private core resolver is not executable by PUBLIC/anon/authenticated` (Spine:109).
- PostgreSQL проверяет `EXECUTE` privilege функции, вызываемой policy expression, для invoking role. Если authenticated RLS policy напрямую вызывает `private.resolve_access(auth.uid())`, отсутствие `USAGE`/`EXECUTE` приводит к `permission denied`, а не к скрытому безопасному вызову.
- Supabase official RLS example для private `SECURITY DEFINER` helper явно делает `GRANT USAGE ON SCHEMA private TO authenticated` и `GRANT EXECUTE ON FUNCTION private... TO authenticated`; private schema при этом не exposed через Data API. См. [Supabase RLS — security definer functions](https://supabase.com/docs/guides/database/postgres/row-level-security#use-security-definer-functions).

**Impact**

При буквальной реализации все authenticated queries к protected posts/media/comments/storage могут fail closed с permission error. Попытка обойти это неописанным public definer wrapper создаст новую exposed privileged surface и нарушит claim, что PEP directly calls the private resolver.

**Required reconciliation**

Выбрать и явно закрепить один topology:

1. **Recommended direct-RLS helper:** private schema не входит в `PGRST_DB_SCHEMAS`; `authenticated` получает только `USAGE private` + `EXECUTE` конкретного subject-bound helper без произвольного user ID; `PUBLIC/anon` revoked. Data API не exposes private RPC, но RLS может его вызвать.
2. **Public wrapper topology:** RLS вызывает отдельный no-argument public boolean wrapper; wrapper строго subject-bound и безопасно вызывает private core under a justified definer chain. Тогда AD-6 должен называть wrapper, а не private resolver, и privilege/tests должны учитывать exposed RPC.

Для service-role recipient/exception RPC остаются отдельные public wrappers с `EXECUTE service_role` only. `REVOKE EXECUTE FROM PUBLIC, anon, authenticated` корректен для них, но не может одновременно применяться к private helper, который напрямую нужен authenticated RLS.

## Final status

**Critical: 0. High: 2.**

После согласования F-01 и F-02 пять targeted current-technology blockers будут закрыты на уровне architecture spine. Фактическое обновление Next.js, live Stripe endpoint/config verification и применение tested Supabase migration останутся обязательными implementation/launch evidence.
