# Reviewer Gate — Rubric Walker

**Artifact:** `../ARCHITECTURE-SPINE.md`  
**Gate:** good-spine checklist + adversarial lens + payment/RLS security and data-integrity lens  
**Intent:** Validate; spine не изменялся  
**Дата:** 2026-09-01

## Gate verdict

**NOT READY FOR HANDOFF.** Mechanical shape is clean, core one-time/subscription separation is sound, and repository package versions match the pinned application stack. The spine is not yet an enforceable brownfield build substrate: current profile and anonymous/storage RLS surfaces bypass the proposed PDP, concurrency constraints that make AD-3 true are deferred, Payment Link eligibility cannot satisfy the stated rule, and the operational/payment reversal envelope is materially incomplete.

Deterministic check:

```text
lint_spine.py: ok=true, total_findings=0
```

This settles placeholders, duplicate AD IDs, missing `Binds/Prevents/Rule`, and obvious unpinned application versions only. It does not settle the semantic findings below.

## Good-spine checklist walk

| Checklist dimension | Result | Evidence |
| --- | --- | --- |
| Real divergence points | Incomplete | Billing/entitlement split and calendar cutoff are decided, but trusted profile fields, public content/storage access, payment reversal, source aggregation, and rollout order remain divergent. |
| Enforceable ADs | Incomplete | AD-1/2/4/5/7 are directionally enforceable; AD-3 depends on deferred uniqueness; AD-6 assumes RLS closure absent in brownfield; AD-8 promises eligibility a reusable Payment Link cannot enforce. |
| Deferred blockers | Fails gate | Schema uniqueness/privileges, exact payment allowlist, timestamp mapping, refund policy, cutoff operation, and retention can change behavior across independent units. |
| Capability coverage | Incomplete | Access, fulfillment, claim, email inclusion, campaign switch and rollback are mapped; invitation/onboarding, admin temporary-member visibility, account access status, payment failure UX, and exception operations are absent. |
| Brownfield fit | Fails gate | Existing `profiles` write policy, anon table policies, public Storage policy, existing `SECURITY DEFINER` functions and subscription webhook routing are not given an explicit replacement/migration contract. |
| Operational envelope | Fails gate | No deployment sequence, environment matrix, monitoring/SLO, reconciliation cadence, reversal handling, rollback of schema rollout, or proven cutoff automation. |
| Named technology | Partially verified | Next.js `16.1.6`, React `19.2.3`, `stripe` `20.4.1`, `@supabase/supabase-js` `2.98.0`, and `@supabase/ssr` `0.9.0` match `package.json`; PostgreSQL/self-hosted Supabase runtime remains unspecified. |
| Payment/RLS security and integrity | Fails gate | Access-source fields are client-writable in current RLS; protected rows/objects have bypass policies; grant uniqueness and reversal state transitions are not fixed. |

## Findings

### Adversarial and rubric findings

- **Location:** AD-6 — Canonical access-state resolver; brownfield `supabase/migrations/001_create_profiles.sql`, `024_admin_rls_for_profiles.sql`, `031_fix_profiles_select_rls.sql`  
  **Trigger condition:** The resolver trusts `profiles.role` and `subscription_status`, while the current self-update policy authorizes an authenticated user to update her own entire profile row; only `is_vip` has a separate server-role trigger guard.  
  **Guard snippet:** Make every access-producing profile field server-write-only at the database boundary: revoke broad column update privileges or replace the policy/API with an allowlisted profile-update RPC; add trigger/constraint guards for `role`, `subscription_status`, Stripe IDs, `current_period_end`, and any future access source. State this as an adopted AD, not an implementation note.  
  **Potential consequence:** A user can self-promote to admin or set an active subscription, and the new canonical PDP will faithfully turn that forged value into protected-content access.

- **Location:** AD-6 and consistency convention `Authorization`; brownfield migrations `033_add_posts_anon_read_policy.sql`, `034_add_post_media_anon_read_policy.sql`, `035_add_profiles_anon_read_policy.sql`  
  **Trigger condition:** Existing anon policies allow all published `posts`, associated `post_media`, and all `profiles` rows to be selected. `posts` includes full `content`, and `profiles` includes email, access and Stripe identifiers. The spine says anonymous policies are allowed only for an explicit preview contract but does not name the policies to remove or the safe replacement surface.  
  **Guard snippet:** Add a brownfield migration invariant that drops these three broad anon policies before feature activation, preserves only the field-limited landing-preview RPC/view, and verifies anon cannot select protected body, media, profile email, subscription, role or Stripe columns.  
  **Potential consequence:** Middleware and the canonical resolver appear correct while direct PostgREST calls continue to disclose paid content and personal/payment-attribution data without authentication.

- **Location:** AD-6; brownfield `supabase/migrations/022_create_post_media_bucket.sql`  
  **Trigger condition:** The spine maps content enforcement to table RLS, but the existing Storage bucket permits public reads of uploaded post media and broad authenticated upload/delete operations. Table policy changes do not revoke direct object URLs.  
  **Guard snippet:** Include Storage objects in the PEP inventory. Decide private bucket/object policy, signed URL issuance and expiry, admin-only write/delete authorization, migration of existing public objects, and cache/CDN invalidation behavior. Verify direct object access after entitlement expiry.  
  **Potential consequence:** Expired, inactive or anonymous users retain media access through public object URLs even when `posts` and `post_media` table RLS denies them.

- **Location:** AD-3 — One immutable grant per offer and purchaser; Deferred line 144  
  **Trigger condition:** The business invariant is one grant per `(offer_code, purchaser_email_normalized)`, but partial uniqueness and transaction-level schema are deferred. Two qualifying Sessions can race through independent fulfillment workers and both observe no grant. Session-ID uniqueness only deduplicates delivery of one Session, not concurrent purchases.  
  **Guard snippet:** Fix the database constraint now: define a unique partial index or exclusion strategy over granting states, insert/classify in one SQL transaction, and map unique-conflict losers deterministically to non-granting audit exceptions. Specify how duplicate-review rows retain each Session without violating the granting constraint.  
  **Potential consequence:** Access can stack or extend despite AD-3, and webhook workers can disagree about which payment is the immutable grant.

- **Location:** AD-8 — Server-time offer switch and non-revoking rollback  
  **Trigger condition:** The rule says active/trialing users and existing grant holders do not receive the Link, but a reusable direct Payment Link remains payable outside the application gate. The deferred refund/support item acknowledges that direct ineligible payments can occur.  
  **Guard snippet:** Either use server-created Checkout Sessions behind an authenticated/pre-payment eligibility check, or rewrite the invariant to the enforceable contract: the app does not offer the Link; direct payment may occur, never grants access, and enters a fully defined automatic refund/support flow.  
  **Potential consequence:** A prohibited purchaser can still be charged, contradicting the stated eligibility rule and creating support, consumer-protection and reconciliation debt.

- **Location:** AD-2/AD-3 and Deferred refund/support policy  
  **Trigger condition:** The spine grants on paid events but defines no state transition for a legitimate grant whose PaymentIntent is later refunded, reversed or disputed. `revoked_at` is not part of the spine's minimal contract, and recurring-event isolation does not answer one-time reversals.  
  **Guard snippet:** Decide and bind handling for refund, partial refund, chargeback/dispute and fraudulent-payment events. Define immutable payment facts, revocation/access policy, event idempotency, effective timestamp, operator override and notification behavior without mutating recurring fields.  
  **Potential consequence:** A fully refunded or disputed one-time purchase can retain three months of access, or different handlers can revoke inconsistently.

- **Location:** AD-6 return contract and AD-7 cache contract  
  **Trigger condition:** `valid_until` aggregation is undefined when a user has multiple simultaneous sources, such as temporary entitlement plus active recurring, VIP or admin; it is also undefined across multiple offer codes.  
  **Guard snippet:** Define source aggregation explicitly: `sources[]` ordering/deduplication, `has_access`, whether any non-expiring/externally revoked source makes `valid_until=NULL`, and whether multiple finite entitlements use maximum effective expiry. Bind the cache behavior for each combination.  
  **Potential consequence:** Middleware can expire or retain its cache differently from RLS and email selection, recreating the exact policy divergence AD-6 intends to prevent.

- **Location:** AD-5 — Verified-email claim  
  **Trigger condition:** The webhook creates an `unclaimed entitlement` before verified-email claim, but the spine does not formally state whether this row is a paid purchase candidate or an access right, nor whether an already-expired candidate may still be claimed.  
  **Guard snippet:** Give pre-claim data a non-entitlement domain state/name or explicitly define `unclaimed` as non-effective payment evidence. Fix claim preconditions, expired-claim behavior, already-claimed idempotency, concurrent claim outcome, and email-change behavior.  
  **Potential consequence:** Implementers can expose pending rows as access rights, send onboarding for an expired purchase, or produce inconsistent claim state under retries.

- **Location:** AD-4 — Calendar expiry; Deferred line 146  
  **Trigger condition:** `paid_at` is called the first accepted Stripe paid-event timestamp, while final Stripe timestamp mapping remains deferred. Immediate and delayed handlers can therefore choose different source fields or receipt time.  
  **Guard snippet:** Adopt exact event precedence and field mapping for `checkout.session.completed` and `checkout.session.async_payment_succeeded`, including replay/out-of-order rules, and retain `event.id/event.created` as immutable evidence. Add DST and month-end fixtures to the binding decision.  
  **Potential consequence:** The same payment can receive different start/end dates depending on handler implementation or delivery order.

- **Location:** AD-6 capability map; brownfield `post_likes`, Storage, preview and search surfaces  
  **Trigger condition:** The PEP inventory names middleware, generic RLS and email, but not every access path: `post_likes` mutations/RPCs, Storage objects, `SECURITY DEFINER` preview/search functions, relational joins and future public views.  
  **Guard snippet:** Add an exhaustive protected-surface matrix with read/write action, role, PDP consumer and expected denial. Require a migration audit over every policy, RPC, view, bucket and route that can reveal or mutate protected content or engagement data.  
  **Potential consequence:** A single omitted RPC or object policy becomes an authorization bypass while each named PEP remains internally correct.

- **Location:** AD-6 security rules; brownfield `SECURITY DEFINER` functions  
  **Trigger condition:** The spine requires private helpers with `search_path=''`, but existing functions such as `is_active_subscriber()` use public schema and `SET search_path=public`, while some existing definer functions omit a hardened search path and have broad execute grants. No replacement/drop sequence is specified.  
  **Guard snippet:** Enumerate old helpers to replace, revoke their execute grants, use schema-qualified references with empty search path, move private logic out of exposed schemas, and regression-test function ownership and `proacl`/schema USAGE after migration.  
  **Potential consequence:** Legacy helpers remain callable or continue authorizing with old rules, and definer functions preserve search-path or privilege-escalation risk.

- **Location:** AD-2 structural seed; brownfield `src/app/api/webhooks/stripe/route.ts`  
  **Trigger condition:** The existing `checkout.session.completed` handler explicitly handles only `mode='subscription'` and returns for other modes. The spine defines a signed adapter but does not decide dispatch order, isolation, or how both lifecycles share the same endpoint without one handler swallowing or misclassifying the event.  
  **Guard snippet:** Bind an event-router contract keyed by event type plus `Session.mode`, with separate subscription and one-time handlers, one signature verification/raw-body boundary, independent idempotency domains and tests proving payment-mode events never mutate profiles while subscription-mode events never create entitlements.  
  **Potential consequence:** One-time payments can be silently ignored or accidentally processed by recurring logic during brownfield integration.

- **Location:** AD-6 resolver implementation envelope  
  **Trigger condition:** RLS may evaluate a resolver for every candidate row; the spine neither defines the init-plan/wrapper pattern nor indexes for claimed entitlements by user/status/time.  
  **Guard snippet:** Specify a STABLE private resolver and policy call shape that PostgreSQL can evaluate once per statement where safe, plus indexes supporting `(user_id, status, access_starts_at, access_ends_at)` and the grant uniqueness lookup. Require `EXPLAIN` checks on feed, detail, comments and recipient queries.  
  **Potential consequence:** Replacing the cheap existing boolean helper can turn feed/media joins into repeated entitlement scans and cause avoidable latency or database load.

- **Location:** Capability → Architecture Map  
  **Trigger condition:** The map stops at fulfillment, grant, claim, content, email and rollback. PRD-required invitation/verification/password setup, post-claim onboarding, temporary access status in profile/admin, and friendly payment-init failure have no architectural owner.  
  **Guard snippet:** Add capability rows and state transitions for invitation/auth return/onboarding, user-visible temporary expiry, admin reconciliation/member view, and checkout failure/retry behavior.  
  **Potential consequence:** Teams can implement the secure backend while the paid happy path remains incomplete or incompatible with existing auth/profile UI.

- **Location:** Deferred exact allowlist and Stack/environment declarations  
  **Trigger condition:** Test/live Link, Price, metadata, amount, currency, quantity and payment methods are deferred, and there is no environment-scoped configuration schema or startup/deploy validation.  
  **Guard snippet:** Define typed server-only configuration per environment, exact `2900/EUR/payment/quantity=1` invariants, distinct test/live IDs and webhook secrets, no client exposure, fail-fast env guards, and deployment validation against Stripe before enabling the CTA.  
  **Potential consequence:** A wrong-environment or wrong-price Link can pass locally chosen checks, or production can sell a configuration that the webhook later rejects after charging.

- **Location:** AD-8 cutoff and Deferred line 149  
  **Trigger condition:** Exact-midnight sales prevention depends on an unnamed Owner manually deactivating a Payment Link; automation/runbook, evidence and fallback are deferred. The app gate fails closed for access but cannot prevent Stripe from charging via a still-live direct link.  
  **Guard snippet:** Name an accountable operator and automated/scheduled mechanism, clock source, pre-cutoff rehearsal, post-cutoff verification, alert, evidence retention and emergency deactivation fallback. Define how long webhook acceptance remains deployed after CTA removal.  
  **Potential consequence:** Out-of-window users are charged and routed into exception handling at campaign cutoff, exactly when staffing may be lowest.

- **Location:** general operational envelope  
  **Trigger condition:** No rollout order, backward-compatible migration sequence, feature flag, rollback of code/schema, backfill validation, monitoring, alert thresholds, reconciliation cadence, backup/restore check or incident runbook is owned by the spine.  
  **Guard snippet:** Add an operations section covering expand/migrate/switch/contract order, reversible code flag, non-revoking rollback, metrics for webhook lag/failure/pending claims/exceptions/RPC denial, scheduled Stripe-to-ledger reconciliation, and tested restore behavior.  
  **Potential consequence:** A correct design can still ship with access outages, temporary content exposure, orphaned payments or an irreversible partial deployment.

- **Location:** Deferred GDPR/payment-record retention  
  **Trigger condition:** Purchaser email and exception retention are left for separate approval even though they are required for claim, uniqueness, support and audit, and the brownfield profiles table is broadly readable.  
  **Guard snippet:** Decide a data classification and retention matrix before schema creation: purpose, lawful basis, access role, encryption/log redaction, deletion/anonymization, statutory payment-record separation and behavior after account deletion.  
  **Potential consequence:** The schema can encode personally identifying payment data in keys and logs that cannot later satisfy deletion/minimization requirements without breaking idempotency or audit.

- **Location:** Stack  
  **Trigger condition:** Application package versions are pinned and match `package.json`, but PostgreSQL/self-hosted Supabase is described only as the existing runtime and no deployed version/extension/timezone evidence is recorded.  
  **Guard snippet:** Record the actual deployed PostgreSQL/Supabase versions and required extensions/settings; verify `timestamptz`, timezone conversion, partial indexes, RLS/function privileges and migration syntax against that runtime.  
  **Potential consequence:** The spine can pass local review while production differs in migration support, timezone configuration or privilege behavior.

## Ratified strengths

- AD-1 establishes a necessary hard boundary between recurring billing fields and the one-time ledger.
- AD-2 correctly makes signed paid webhook evidence authoritative and rejects redirect/client state as proof.
- AD-4 and AD-7 use explicit calendar arithmetic, half-open access intervals and deadline-bounded cache semantics.
- AD-5 uses verified Supabase identity, normalized email matching and atomic server-side claim instead of possession of a Session URL.
- AD-6 correctly chooses one PDP for middleware, RLS and email rather than duplicating business rules.
- AD-8 correctly separates campaign cutoff from entitlement expiry and keeps late retries processable by payment time.
- The stack versions named for Next.js, React, Stripe and Supabase JavaScript packages match the current repository manifest.

## Gate exit conditions

The next spine revision is ready for another gate when it:

- makes all resolver inputs server-write-only and closes existing anon/Storage bypasses;
- fixes grant uniqueness and claim/payment state transitions at the database level;
- resolves Payment Link eligibility and payment reversal/refund/dispute behavior;
- enumerates every RLS/RPC/Storage PEP and defines source aggregation;
- moves behavior-changing schema, timestamp, allowlist and operational items out of Deferred;
- maps invitation/onboarding/admin/status capabilities;
- defines deploy, environment, monitoring, reconciliation, cutoff and rollback operations;
- records deployed database runtime and GDPR retention/access controls.
