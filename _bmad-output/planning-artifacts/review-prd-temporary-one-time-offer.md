# PRD Quality Review — temporary one-time offer

- **Reviewed artifact:** `C:\Users\1\DEV\PROCONTENT\_bmad-output\planning-artifacts\prd.md`
- **Change source checked:** `C:\Users\1\DEV\PROCONTENT\_bmad-output\planning-artifacts\sprint-change-proposal-2026-09-01.md`
- **Scope:** update at `Product Scope` and FR1–FR5.1; no PRD edits made.

## Overall verdict

**Fair — do not treat the PRD update as fully decision-ready yet.** It preserves the permanent recurring baseline, expresses a precise half-open sale window, distinguishes entitlement expiry from offer rollback, and explicitly protects existing subscriptions. However, the pre-existing primary journey now contradicts the temporary offer, and two product-policy decisions that change the affected user's experience are still being inherited implicitly rather than stated.

## Decision-readiness — adequate

The commercial decision is explicit in `Product Scope` and FR1.4: the temporary offer is `€29`, has no renewal, and runs in `[2026-09-01 00:00, 2026-12-01 00:00) Europe/Ljubljana`. FR5.1 gives an operational rollback date and retains each previously granted entitlement until its individual expiry. The scope of the exception and the invariant for existing subscribers are therefore visible to an approver.

The remaining decision gap is whether a buyer with a current or former account/subscription is eligible to purchase the temporary offer. “Для новых покупок” identifies the transaction window, but does not define the eligible customer state or the expected UI/result for an already authenticated subscriber.

### Findings

- **[medium] Eligibility of “new purchases” is undefined (§ Product Scope, line 117; FR1.4, line 366)** — The PRD does not say whether the temporary checkout is available only to a new visitor, to a user without an active recurring subscription, or to any user making a new payment. Those alternatives produce different checkout, claim, and support outcomes. *Fix:* add one business rule that defines eligible and ineligible account/subscription states, plus the user-visible outcome for an ineligible buyer.

## Substance over theater — strong

The new wording is operational rather than decorative: it binds price, duration, auto-renewal, content promise, cutoff, and the continuing-recurring invariant. Each added constraint serves a product or rollout decision from the change proposal.

## Strategic coherence — thin

The temporary offer coheres with the stated business need to suspend recurring sales while protecting existing subscribers. But the principal conversion journey still describes a €12.99 recurring purchase and a later renewal as the normal path; this undermines the time-bound product thesis during the offer window.

### Findings

- **[high] The primary conversion journey contradicts the offer (§ Journey 1, lines 149–153; FR1.4, line 366)** — Journey 1 says Anna sees “Цена 12,99€” and later “Продлевает подписку на 3 месяца,” while FR1.4 requires a single €29 non-recurring option and explicitly excludes recurring copy during the offer. The change proposal itself identifies Journey 1 as temporarily inaccurate. *Fix:* make Journey 1 explicitly the permanent-model journey and add a concise temporary-offer journey, or condition its price and renewal steps on being outside the offer window.

## Done-ness clarity — adequate

FR1.4, FR3.1, and FR5.1 give testable temporal boundaries: payment plus verified matching email creates access; `access_ends_at` is exclusive; the public offer stops at the rollback moment while granted access persists. The exact `Europe/Ljubljana` timezone makes DST behavior implementable.

FR1.4 is nevertheless a dense bundle of checkout, marketing copy, identity claim, entitlement lifecycle, expiry, and subscriber regression requirements. The conditions are individually testable, but their single identifier makes coverage and change tracking harder than necessary.

### Findings

- **[medium] One FR combines six independently verifiable contracts (§ FR1.4, line 366)** — A single requirement currently owns offer selection, prohibited copy, payment mode/autorenewal, non-interference with subscribers, email-matched claim, and exact entitlement expiration. A test or later change can satisfy one clause while obscuring a regression in another. *Fix:* keep FR1.4 as the top-level offer rule, then place the checkout/copy, claim/access, and non-interference clauses in separately numbered child FRs; retain expiry in FR3.1 and rollback in FR5.1.

## Scope honesty — thin

The PRD clearly excludes recurring changes and post-offer conversion of entitlements. It does not, however, explicitly resolve notification treatment for a temporary participant. The glossary treats her as an “Участница” with full access (line 51), so existing FR27’s automatic new-post email requirement applies by inheritance. The change proposal marks that recipient-selection decision as one that cannot be silently inherited (line 44).

No additional finding is raised because the concrete policy decision can be recorded while resolving the eligibility finding above: either include temporary participants in FR27 or mark notifications as a non-goal for the entitlement period.

## Downstream usability — adequate

The glossary introduces the entitlement term and FR identifiers are unique. The permanent and temporary access paths are readable in isolation through FR1/FR1.4, FR3/FR3.1, and FR5/FR5.1. Splitting the overloaded FR1.4 would improve traceability into the proposed Epic 9 acceptance criteria.

## Shape fit — adequate

For a consumer, revenue MVP the document has a suitable mix of product scope, named journeys, access rules, and measurable NFRs. The temporary pricing exception does warrant a journey amendment because conversion and post-payment expectations are load-bearing for this form factor.

## Mechanical notes

- The scope prose “с 01.09.2026 по 01.12.2026” (line 117) is less precise than the half-open interval in FR1.4. Rephrase it as “до 01.12.2026 00:00 Europe/Ljubljana (exclusive)” to prevent a reader from interpreting 1 December as included.
- `Payment Link` in FR5.1 is an integration mechanism. Keeping the behavioral rollback requirement in the PRD is appropriate; its specific Stripe operation can be cross-referenced to the architecture/runbook rather than become the only way to satisfy the product outcome.
