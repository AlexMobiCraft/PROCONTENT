# Current Technology Targeted Close Review

**Дата:** 2026-09-01  
**Scope:** только cutoff/async `paid_at`, RLS public-wrapper/private-core privileges, retrieved Checkout Session `line_items`, patched Next.js target.  
**Исходный Spine не изменялся.**

## Verdict

**PASS — remaining Critical: 0, High: 0.**

Предыдущие targeted Critical/High findings закрыты на уровне architecture spine. Фактические dependency upgrade, Stripe test/live verification и migration privilege tests остаются обязательными delivery/launch evidence, но больше не являются противоречиями architecture contract.

## Targeted verification

### 1. Cutoff / async `paid_at` semantics — PASS

- AD-2 фиксирует единственный qualifying paid-event path для каждой payment shape: immediate `checkout.session.completed` только при `payment_status='paid'`; delayed payment — `checkout.session.async_payment_succeeded` (Spine:48-52).
- `paid_at` берётся из `event.created` qualifying event, а Session ID является fulfillment idempotency key (Spine:52, 117).
- AD-8 теперь однозначно использует payment-success window: post-cutoff delivery может grant-ить только если qualifying event timestamp был in-window; новый async success после cutoff является out-of-window и входит в refund handling (Spine:96).
- Direct/shared Link bypass app gate и его non-granting exception/refund path явно признаны (Spine:95, 102, 166-167).

Это устраняет прежнее противоречие «начал до cutoff / async succeeded после cutoff». Выбранный contract: entitlement eligibility определяется qualifying paid-success timestamp, а не Session creation time или webhook receipt time.

AD-4 и final timestamp mapping по-прежнему требуют формального approval (Spine:61-65, 168), но implementation не имеет двух конфликтующих cutoff interpretations.

### 2. RLS public wrapper / private core EXECUTE compatibility — PASS

- RLS больше не вызывает private resolver напрямую. Он вызывает no-argument `public.has_current_content_access()` (Spine:79).
- Public wrapper является authenticated-only definer и сам передаёт `auth.uid()` и DB time private core; caller не может подставить произвольный user ID (Spine:79-80).
- Private core не исполняется `PUBLIC/anon/authenticated`; public self-state wrapper исполняется только `authenticated`; recipient/exception wrappers — только `service_role` (Spine:109-110).

Этот topology совместим с PostgreSQL privilege evaluation: RLS caller имеет `EXECUTE` только на public wrapper; внутри `SECURITY DEFINER` body private core вызывается с privileges фиксированного owner wrapper, поэтому caller role не нуждается в direct private-core `EXECUTE`.

Migration approval обязан подтвердить:

- fixed non-login owner для wrapper/private core и owner-side `USAGE/EXECUTE` private schema/function;
- `SECURITY DEFINER SET search_path=''` и fully schema-qualified names на каждом definer function, включая exposed wrapper;
- `REVOKE EXECUTE FROM PUBLIC/anon` и exact grants из AD-10;
- authenticated allow/deny tests через direct RPC и protected RLS policy.

Это implementation evidence для уже совместимого contract, не оставшийся High architecture finding.

### 3. Retrieved Session with expanded `line_items` — PASS

AD-2 требует после signature verification server-side retrieve Checkout Session с expanded `line_items` и проверку retrieved Link, Price, metadata, amount, currency, quantity, `mode` и paid status до transaction (Spine:52). Это соответствует [Stripe Checkout fulfillment](https://docs.stripe.com/checkout/fulfillment?payment-ui=stripe-hosted) и закрывает риск validation только по incomplete webhook snapshot.

### 4. Patched Next.js target — PASS

- Stack фиксирует `Next.js 16.3.3 required; current 16.1.6 is launch-blocked` (Spine:127).
- Dependency gate требует `16.3.3 or newer` before implementation/launch и повторную проверку актуальных advisories (Spine:174).

Target соответствует официальному patched Active LTS baseline на дату документа и не задаёт version ceiling. Реальный lockfile пока остается `16.1.6`; launch возможен только после upgrade и regression/security verification, как уже требует Spine.

## Close status

| Target | Result |
| --- | --- |
| Cutoff / delayed async success | PASS |
| Qualifying `paid_at` vs receipt time | PASS |
| RLS public wrapper → private core privileges | PASS |
| Retrieved Session + expanded `line_items` | PASS |
| Patched Next.js launch target | PASS |

**Final: PASS. No remaining Critical/High findings in the requested targeted scope.**
