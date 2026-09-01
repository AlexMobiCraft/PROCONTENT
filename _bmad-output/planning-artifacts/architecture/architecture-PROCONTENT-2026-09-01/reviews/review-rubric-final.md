# Reviewer Gate — Final Recheck

**Artifact:** `../ARCHITECTURE-SPINE.md`  
**Compared against:** `review-rubric.md` top findings  
**Scope:** trusted authorization inputs, RLS/Storage inventory, DB-enforced uniqueness, direct-link/refund launch gate, operational envelope  
**Intent:** Validate; spine не изменялся  
**Дата:** 2026-09-01

## Verdict

**NOT READY FOR HANDOFF, WITH THREE REMAINING BLOCKERS.** The update resolves the two most dangerous data-integrity defects: access-producing profile fields are now explicitly trusted-server-only, and one grant per offer/purchaser is enforced by a database key plus atomic conflict handling. It also explicitly acknowledges the reusable direct-Link limitation. The gate remains open because authorization surface inventory is still incomplete, the required refund path is still only deferred, and cutoff/deployment operations are not executable yet.

Deterministic shape remains clean:

```text
lint_spine.py: ok=true, total_findings=0
```

## Recheck matrix

| Area | Result | Evidence |
| --- | --- | --- |
| Authorization inputs | Resolved in spine | AD-10 limits authenticated UPDATE to named safe columns and makes `role`, `is_vip`, recurring Stripe/status, entitlement and fulfillment fields trusted-server-only; RPC/table grants are explicitly constrained. |
| RLS/Storage inventory | Partially resolved | AD-6 now includes protected posts/media/comments, `storage.objects`, public assets and profile exposure, but omits known `post_likes` policies/RPCs and does not require a complete public `SECURITY DEFINER` function/view audit. |
| DB-enforced uniqueness | Resolved in spine | AD-3 defines append-only attempts, a DB unique key on `(offer_code, purchaser_email_normalized)`, atomic `INSERT ... ON CONFLICT DO NOTHING`, first-winner semantics and non-granting duplicates. |
| Direct-link limitation/refund gate | Partially resolved | AD-8 truthfully states that a saved/shared Link bypasses app eligibility and requires an approved refund/support path; that path remains unresolved in Deferred. |
| Operational envelope | Partially resolved | AD-9 adds durable exception review and rollback evidence; operator, automation/runbook, cutoff evidence/fallback and deployment/runtime prerequisites remain deferred. |

## Remaining blockers

- **Location:** AD-6 line 81; brownfield `supabase/migrations/014_create_post_likes.sql` and public RPC/function inventory  
  **Trigger condition:** The protected-surface rule enumerates posts, media, comments and Storage, but the existing repository also exposes engagement mutation through `post_likes` RLS and `toggle_like`, plus multiple public/authenticated `SECURITY DEFINER` functions. Those surfaces are not required to consume the PDP or be explicitly classified as public.  
  **Guard snippet:** Expand AD-6 to require a complete PEP inventory across tables, views, RPC/functions, routes and Storage. Explicitly bind `post_likes` INSERT/DELETE and `toggle_like` to active access, and require an allowlisted audit of every executable `SECURITY DEFINER` function and public view before resolver rollout.  
  **Potential consequence:** An inactive or expired user can still mutate protected engagement data, and an omitted RPC/view can bypass otherwise-correct content RLS.

- **Location:** AD-8 line 95 and Deferred line 166  
  **Trigger condition:** The spine correctly admits that a direct Payment Link can charge an ineligible, duplicate or late purchaser, but the mandatory refund/support path is not defined or explicitly made an automated launch condition.  
  **Guard snippet:** State `launch_enabled=false` until Owner/Finance approve an executable policy covering eligibility classes, automatic versus manual refund, deadline, partial/full refund, Stripe fee treatment, idempotency, customer notification, reconciliation ownership and evidence. Make the configuration/CTA gate consume that approval state.  
  **Potential consequence:** The product can launch with a known path that takes prohibited payments but no deterministic remediation, leaving consumer and accounting outcomes dependent on ad-hoc support decisions.

- **Location:** AD-9 line 102; AD-8 line 96; Deferred lines 170, 172–173  
  **Trigger condition:** AD-9 says rollback names an operator and produces evidence, while the actual operator, automation/runbook, fallback and dependency change are still deferred. No expand/switch/contract migration order, pre-cutoff rehearsal, monitoring thresholds or automated go/no-go check is fixed.  
  **Guard snippet:** Add an explicit launch/rollback checklist owned by named roles: dependency upgrade verification, database expand migration, grants/RLS audit, resolver shadow comparison, feature switch, Stripe config verification, monitoring/alerts, cutoff automation rehearsal, Link deactivation evidence, recurring checkout smoke test and non-revoking rollback. Make each unresolved item a machine- or owner-verifiable launch gate.  
  **Potential consequence:** Teams can hand off a semantically correct spine yet deploy in an order that causes access escalation/outage, or reach cutoff with a live direct Link and no accountable executable response.

## Confirmed closures

- AD-10 now closes the prior privilege-escalation design gap for user-writable `role` and recurring status fields.
- AD-6 now explicitly includes protected Storage and forbids public exposure of protected body/media/comments or profile authorization/payment fields.
- AD-3 now makes duplicate-session and concurrent-purchase behavior database-enforceable rather than application-conventional.
- AD-6 now defines `sources[]` and `valid_until` aggregation across finite and non-finite access sources.
- AD-2 now fixes server-side Session retrieval, line-item validation and paid-event timestamp precedence.
- AD-8 now states the actual direct-Link limitation instead of claiming the app gate prevents all purchases.
- AD-9 now defines retryable technical failures, durable business exception states, reconciliation access and rollback evidence.

The gate can close after the three remaining blockers are promoted from descriptive/deferred intent into exhaustive authorization inventory and executable launch conditions.
