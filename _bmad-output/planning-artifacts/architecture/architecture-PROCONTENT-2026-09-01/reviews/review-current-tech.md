# Current Technology & Reality-Checked Fit Review

**Дата:** 2026-09-01  
**Объект:** `ARCHITECTURE-SPINE.md`  
**Метод:** каждая technology/assertion Spine проверена против официальной документации Stripe, Supabase, Next.js и локального repository/lockfile/deployment evidence. Spine не изменялся.

## Verdict

**CONDITIONALLY FIT, BUT NOT CURRENTLY BUILD/LAUNCH-READY.**

Архитектурный базис в целом совместим с текущим стеком: Stripe Payment Links действительно создают Checkout Sessions и копируют Link metadata в Session; webhook fulfillment по `checkout.session.completed` + `checkout.session.async_payment_succeeded` является рекомендуемым путем; private Supabase `SECURITY DEFINER` resolver с `search_path=''` и узкими grants является корректным PDP/PEP pattern; PostgreSQL 15 поддерживает нужные constraints, RLS, `timestamptz` и calendar intervals.

Однако текущая формулировка Spine имеет пять technology blockers:

1. зафиксированный Next.js `16.1.6` находится в известных уязвимых ranges, включая middleware/proxy authorization bypass, при том что Spine делает middleware PEP;
2. exact Stripe Price/quantity validation не может надежно выполняться только по event snapshot — official fulfillment flow требует retrieve Session с expanded `line_items`;
3. Payment Link `active=false` гарантирует deactivated page для новых посещений, но не является документированным механизмом expiration уже открытых Checkout Sessions;
4. `first accepted paid-event timestamp` не является детерминированной temporal source при unordered delivery; Stripe прямо запрещает использовать event `created` для определения порядка;
5. Supabase security pattern правильный, но текущая база использует exposed `public` SECURITY DEFINER helpers и не имеет зафиксированной revoke/grant/default-privilege migration matrix.

## Sources and evidence baseline

### Official sources

- [Stripe Payment Link object](https://docs.stripe.com/api/payment-link/object)
- [Stripe Update Payment Link](https://docs.stripe.com/api/payment-link/update)
- [Stripe Checkout fulfillment](https://docs.stripe.com/checkout/fulfillment?payment-ui=stripe-hosted)
- [Stripe Checkout Session object](https://docs.stripe.com/api/checkout/sessions/object)
- [Stripe webhook best practices](https://docs.stripe.com/webhooks)
- [Stripe API versioning](https://docs.stripe.com/api/versioning)
- [Supabase Database Functions](https://supabase.com/docs/guides/database/functions)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Securing your API](https://supabase.com/docs/guides/api/securing-your-api)
- [Supabase Self-Hosting](https://supabase.com/docs/guides/self-hosting)
- [Supabase Self-Hosting with Docker](https://supabase.com/docs/guides/self-hosting/docker)
- [Next.js security advisories](https://github.com/vercel/next.js/security/advisories)
- [Next.js security releases](https://nextjs.org/blog)

### Repository evidence

- `package.json` and `package-lock.json`
- `src/lib/stripe/index.ts`
- `src/app/api/webhooks/stripe/route.ts`
- `src/lib/supabase/auth-middleware.ts`
- `src/lib/notifications/sendNewPostNotification.ts`
- `supabase/migrations/003_add_rpc_functions.sql`
- `supabase/migrations/010_fix_security_definer_and_perf_index.sql`
- `supabase/migrations/046_vip_access_in_rls.sql`
- `hetzner-deploy/docker-compose.yml`
- `hetzner-deploy/env.example`
- `supabase/.temp/*-version`

## Detailed findings

### CT-01 — CRITICAL — Next.js 16.1.6 is not a current safe production baseline for an authorization PEP

**Spine assertion**

- Stack pins Next.js `16.1.6` (Spine:103-112).
- Middleware is an authorization Policy Enforcement Point (Spine:24, 35, 74-83).

**Reality check**

- `package.json:32` and lockfile confirm installed `next@16.1.6`; `npm ls` also resolves exactly `16.1.6`.
- A live `npm audit --omit=dev` on 2026-09-01 reports the direct `next` dependency as **high severity** and a production dependency total of `14 high`, `8 moderate`, `3 low`, `0 critical` at review time.
- Next.js maintainers list multiple 2026 HIGH middleware/proxy bypass advisories, including `GHSA-492v-c6pp-mqqv`, `GHSA-267c-6grr-h53f` and `GHSA-6gpp-xcg3-4w24`; the official July security release required `16.2.11`, and the official August release required `16.3.3`. See [Next.js advisories](https://github.com/vercel/next.js/security/advisories) and [Next.js security release index](https://nextjs.org/blog).
- `npm view next version` returns `16.3.4` at review time; `npm audit` offers `16.3.4` as the fix target.

**Fit**

**FAIL for production launch.** RLS defense-in-depth reduces data exposure only after every protected table/storage path uses the new resolver. It does not make a known middleware bypass acceptable, and it does not cover all route-level behavior, redirects or side effects.

**Required action**

- Upgrade Next.js and `eslint-config-next` to a currently patched release, then rerun build/typecheck/lint/tests and focused proxy/auth regression.
- Keep RLS as the authoritative security boundary; never rely on patched middleware alone.
- Re-run `npm audit --omit=dev` immediately before launch because the audit also reports non-Next production findings outside this feature scope.

### CT-02 — HIGH — Stripe exact Price/quantity assertion requires API retrieval, not only webhook snapshot validation

**Spine assertion**

- AD-2 requires exact allowlist validation of Link, Price, metadata, amount, currency and quantity before fulfillment (Spine:48-52).
- Structural seed shows a signed webhook adapter directly entering fulfillment transaction (Spine:114-127).

**Reality check**

- Stripe confirms Payment Link object metadata is automatically copied to Checkout Sessions created from that Link, so Session `metadata` plus `payment_link` is a valid first filter. See [Payment Link update API](https://docs.stripe.com/api/payment-link/update).
- Stripe's official fulfillment contract explicitly requires the fulfillment function to accept Session ID, **retrieve the Checkout Session from the API with `line_items` expanded**, check `payment_status`, fulfill the actual line items and record fulfillment status. See [Checkout fulfillment](https://docs.stripe.com/checkout/fulfillment?payment-ui=stripe-hosted).
- Checkout Session event snapshots do not guarantee that full `line_items` are embedded. Price and quantity validation therefore needs `stripe.checkout.sessions.retrieve(sessionId, { expand: ['line_items.data.price'] })` or line-item pagination.
- The current webhook handler casts `event.data.object` directly to `Stripe.Checkout.Session` and processes it without retrieve (`route.ts:710-715`), so the new flow cannot safely reuse that pattern for Price/quantity validation.

**Fit**

**PARTIAL.** Metadata inheritance, Link ID, mode, `amount_total`, currency and paid status assertions are supported. The implementation route is underspecified and would be unsafe if interpreted as validating only event payload fields.

**Required action**

- Make `fulfillTemporaryOffer(sessionId)` retrieve canonical Session + complete line items from Stripe inside the idempotent flow.
- Validate `livemode`, Stripe account/context, exact `payment_link`, exact Price ID, non-recurring Price, exactly one line item, quantity `1`, `amount_total=2900`, `currency='eur'`, `mode='payment'`, `payment_status='paid'`, and immutable offer metadata.
- Store the webhook event ID/type as delivery audit, but use Session ID as fulfillment idempotency key.

### CT-03 — HIGH — Payment Link deactivation is not a hard cutoff for already-open Sessions

**Spine assertion**

- AD-8 uses server cutoff plus Owner deactivation of the Payment Link, with out-of-window payments becoming non-granting (Spine:85-90, 139, 149).

**Reality check**

- Stripe documents `active=false` narrowly: customers **visiting the Payment Link URL** see a deactivated page. See [Update a Payment Link](https://docs.stripe.com/api/payment-link/update).
- Stripe documents that opening a reusable Payment Link creates a new Checkout Session. A Session has its own `status`, `expires_at` and URL. Stripe separately provides an `expire` endpoint for an `open` Session; after explicit expiration it cannot be completed. See [Checkout Sessions](https://docs.stripe.com/api/checkout/sessions) and [Expire a Checkout Session](https://docs.stripe.com/api/checkout/sessions/expire).
- Stripe does not state that setting a Link inactive expires Sessions already created while the Link was active.

**Fit**

**FAIL as a zero-exception cutoff guarantee.** A user may open the Link before cutoff and complete the already-created Session after cutoff. Spine intentionally refuses access for out-of-window `paid_at`, so the system can receive money without granting access.

**Required action**

- Treat Link deactivation as prevention of new Payment-Link visits, not cancellation of all open Sessions.
- Choose and approve one explicit late-session policy: grant based on in-window Session creation, expire/track all known open Sessions at cutoff where operationally possible, or accept then automatically refund/manual-review after-cutoff payments.
- Subscribe to and audit relevant expiration/async failure outcomes if used; Link deactivation alone is insufficient rollback evidence.

### CT-04 — HIGH — `first accepted paid-event timestamp` contradicts Stripe event-order guarantees

**Spine assertion**

- AD-4 says `paid_at` is the first accepted Stripe paid-event timestamp (Spine:60-64).
- AD-8 makes cutoff eligibility depend on immutable `paid_at` (Spine:90).

**Reality check**

- Stripe explicitly says webhook event delivery order is not guaranteed and event destinations must not depend on ordering.
- Stripe further states snapshot event `created` has second precision, distinct events may share a timestamp, and `created` must not be used to determine event order or whether an event was already processed. Use event IDs for delivery deduplication and retrieve canonical resources as needed. See [Stripe webhook event ordering](https://docs.stripe.com/webhooks#event-ordering).
- `checkout.session.completed` and `checkout.session.async_payment_succeeded` are the correct qualifying triggers for immediate and delayed payment success. `checkout.session.async_payment_failed` is optional for customer/support handling. See [Checkout fulfillment](https://docs.stripe.com/checkout/fulfillment?payment-ui=stripe-hosted).

**Fit**

**FAIL for deterministic entitlement and cutoff arithmetic.** “First accepted” is processing-order dependent; it can vary between retries, delayed deliveries and concurrent workers. If interpreted as `event.created`, it also conflicts directly with Stripe's warning.

**Required action**

- Define a canonical payment-success timestamp from a retrieved Stripe resource and one mapping per allowed payment method, or explicitly define a deterministic Session-based business timestamp.
- Keep event ID/type/created only as audit/delivery metadata.
- Test reordered and concurrent `completed`/`async_payment_succeeded` deliveries and ensure identical persisted `paid_at`/`access_ends_at`.

### CT-05 — HIGH — Supabase private SECURITY DEFINER pattern is correct, but privileges cannot remain deferred

**Spine assertion**

- AD-6 calls for private helpers, schema-qualified names, `search_path=''`, no arbitrary user-ID public wrapper, least-privilege grants and client read-only access to entitlements (Spine:72-77).
- Migration schema/RPC privileges and RLS/GRANT matrix remain deferred (Spine:144).

**Reality check**

- Supabase official guidance matches the Spine: use `security invoker` by default; when `SECURITY DEFINER` is necessary, set `search_path=''` and schema-qualify every relation. A definer function must not live in an exposed schema. See [Supabase Database Functions](https://supabase.com/docs/guides/database/functions) and [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security#use-security-definer-functions).
- Supabase functions are executable by roles by default. Safe deployment requires explicit `REVOKE EXECUTE` from `PUBLIC`/`anon`/unneeded roles, explicit grants to required roles, and preferably safe default privileges. RLS does not apply to function execution. See [Supabase Database Functions — Function privileges](https://supabase.com/docs/guides/database/functions#function-privileges) and [Securing your API](https://supabase.com/docs/guides/api/securing-your-api).
- Repository self-host config exposes `public,storage,graphql_public` and extra search path `public` (`hetzner-deploy/env.example:105-107`), so a new `private` schema is not exposed by current PostgREST configuration. This is a good fit.
- Current migrations do not yet follow the proposed model consistently: `get_auth_user_id_by_email` and `is_active_subscriber` are `SECURITY DEFINER` in exposed `public`, use `SET search_path=public`, and show no local explicit execute revocation (`003_add_rpc_functions.sql:7-14`, `010_fix_security_definer_and_perf_index.sql:9-20`, `046_vip_access_in_rls.sql:8-19`).

**Fit**

**PASS as architecture, FAIL as deferred implementation detail.** The pattern is correct for Supabase/PostgREST, but the exact DDL/grants are the security boundary and must be approved before implementation.

**Required action**

- Create non-exposed `private` schema; private resolver/claim helpers use `SECURITY DEFINER SET search_path=''`, fully qualified objects, fixed owner and minimal execute grants.
- Put only purpose-specific RPC wrappers in exposed `public`; authenticated wrapper accepts no user ID and derives `(select auth.uid())`.
- Explicitly revoke function execute from `PUBLIC`, `anon` and unneeded roles; grant only `authenticated` or `service_role` per wrapper; set safe default privileges for new functions.
- Ensure middleware calls authenticated RPC with the user's access token. A service key/client with a user session can run under user RLS, while a plain service-role Authorization bypasses RLS; do not blur these call paths.
- Add allow/deny DB tests for anon/authenticated/service_role and direct RPC attempts.

### CT-06 — MEDIUM — Service-role-only recipient RPC is feasible, but current caller model and grants must be explicit

**Spine assertion**

- Email selection uses a service-role-only RPC and preference overlay (Spine:24, 37, 76-77, 138).

**Reality check**

- Supabase documents `service_role` as a PostgREST role with `bypassrls`; secret/service keys must remain server-only. See [Supabase RLS — Bypassing RLS](https://supabase.com/docs/guides/database/postgres/row-level-security#bypassing-row-level-security).
- Current notification code creates a plain `@supabase/supabase-js` admin client with `SUPABASE_SERVICE_ROLE_KEY`, no cookie-backed user session, and directly reads `profiles` (`sendNewPostNotification.ts:1-55`). This can call a service-role-only RPC correctly.
- Because function execution is granted broadly by default, “service-role-only” must be enforced in DDL, not only by application convention.

**Fit**

**PASS with hardening.** The architecture matches the existing server notification path. The explicit service-role execute grant/revokes and safe return columns are mandatory.

**Required action**

- The recipient RPC must return only necessary recipient fields and apply preference/expiry filters server-side.
- Revoke access from `PUBLIC`, `anon`, `authenticated`; grant execute only to `service_role`.
- Do not initialize this client through `@supabase/ssr`, because cookie user sessions can replace the Authorization context.

### CT-07 — MEDIUM — Webhook event/API version must be pinned independently from stripe-node client API version

**Spine assertion**

- Stack declares `stripe@20.4.1` but no Stripe API or webhook endpoint version (Spine:103-112).
- AD-2 assumes stable Session field shapes (Spine:48-52).

**Reality check**

- Repository lockfile resolves `stripe@20.4.1`; `src/lib/stripe/index.ts:11-13` pins outgoing SDK requests to `2026-02-25.clover`.
- Stripe states webhook events use the account default API version unless the endpoint is configured with its own version; changing SDK request version does not change existing Event snapshots. See [Stripe API versioning](https://docs.stripe.com/api/versioning) and [Webhook versioning](https://docs.stripe.com/webhooks/versioning).
- `stripe@20.4.1` and API `2026-02-25.clover` are a valid pair in this repository. At review time `npm view stripe version` returns `22.6.0`, but the old major is not itself a blocker for these stable APIs.
- The current webhook casts event snapshots into local SDK types, so a Dashboard endpoint version mismatch can create runtime/type drift (`route.ts:696-715`).

**Fit**

**PARTIAL.** Client API version is reality-checked; webhook endpoint API version is unrecorded.

**Required action**

- Record and verify test/live webhook endpoint API versions and enabled event types.
- Prefer event object only for signature, event ID/type and Session ID; retrieve canonical Session using the pinned SDK API before fulfillment.
- Validate test/live `livemode` and Stripe account/context to prevent cross-environment fulfillment.

### CT-08 — MEDIUM — Stack versions are repository-accurate but not a “current” production baseline

**Spine assertion**

- Next.js `16.1.6`, React `19.2.3`, `stripe` `20.4.1`, `@supabase/supabase-js` `2.98.0`, `@supabase/ssr` `0.9.0` (Spine:103-112).

**Reality check**

| Package | Spine / installed | Registry current on review date | Fit |
| --- | ---: | ---: | --- |
| `next` | `16.1.6` | `16.3.4` | **Fail:** known security advisories |
| `react` | `19.2.3` | `19.2.8` | Compatible, stale patch |
| `stripe` | `20.4.1` | `22.6.0` | Compatible with pinned Clover API; older supported surface |
| `@supabase/supabase-js` | `2.98.0` | `2.112.4` | Compatible; package requires Node >=20 |
| `@supabase/ssr` | `0.9.0` | `0.12.5` | Compatible pair: `0.9.0` peer requires supabase-js `^2.97.0` |

`npm ls` confirms all Spine versions are exactly installed. Local Node is `v24.13.0`, satisfying `@supabase/supabase-js@2.98.0` Node >=20 and `stripe@20.4.1` Node >=16 requirements.

**Fit**

**PASS for reproducibility, FAIL for security-current claim because of Next.js.** The table should be interpreted as an observed lock snapshot, not a recommendation to pin those versions for launch.

**Required action**

- After Next security upgrade, regenerate lockfile and re-run compatibility tests.
- Avoid unrelated major upgrades of Stripe/Supabase inside the feature unless separately planned; first secure the known vulnerable direct dependency.

### CT-09 — MEDIUM — “existing project runtime” is too ambiguous for self-hosted deployment evidence

**Spine assertion**

- `PostgreSQL / self-hosted Supabase | existing project runtime` (Spine:112).

**Reality check**

- Hetzner deployment compose pins `supabase/postgres:15.8.1.085`, `postgrest/postgrest:v14.8`, `supabase/gotrue:v2.186.0` and `supabase/storage-api:v1.48.26` (`hetzner-deploy/docker-compose.yml:101,157,213,350`).
- Local Supabase CLI temp state reports PostgreSQL `17.6.1.084`, PostgREST `v14.4`, GoTrue `v2.188.1`, Storage `v1.48.20`. This likely describes a linked/local CLI context, not the Hetzner production stack, but it proves “existing runtime” is not unambiguous from the repository.
- Supabase official docs note that self-hosted deployments are responsible for updates, backups, monitoring and disaster recovery; service images are tested as coordinated snapshots and arbitrary per-service version mixing is not guaranteed compatible. See [Self-Hosting](https://supabase.com/docs/guides/self-hosting) and [Self-Hosting with Docker — Updating](https://supabase.com/docs/guides/self-hosting/docker#updating).
- PostgreSQL 15 supports all database primitives proposed by Spine, so there is no SQL feature blocker.

**Fit**

**PARTIAL.** Feature SQL is compatible with the deployment-pinned PG15, but actual live versions and schema/grants cannot be proven from local files alone.

**Required action**

- Capture a read-only live runtime manifest before migration: `server_version`, PostgREST/Auth/Storage image tags, exposed schemas, roles/attributes, function owners, grants/default privileges and applied migrations.
- Pin that manifest in the architecture/runbook; do not use `.temp` versions as production evidence.
- Take verified Postgres + Storage backups before schema rollout; self-hosted Supabase does not provide managed backups/PITR automatically.

### CT-10 — MEDIUM — Deadline-bounded cache rule is technically sound but lacks a signed-token primitive and invalidation semantics

**Spine assertion**

- Token lifetime is `min(configured_ttl, valid_until-now)` and token rejects reached `valid_until` independently of cookie expiry (Spine:79-83).

**Reality check**

- This is implementable in Next.js/Node and correctly prevents an entitlement-only cache extending beyond deadline.
- Spine does not select the signing primitive/key rotation, bind the token to authenticated `user_id`, or define invalidation on revoke/admin/VIP/subscription state changes.
- A token whose `valid_until` represents only the maximum source can retain access after revocation/cancellation of that source until configured TTL. This is a policy choice, not solved by expiry bounding alone.

**Fit**

**PARTIAL.** Correct for time expiry, incomplete for revocation and identity binding.

**Required action**

- Bind signed payload to subject/session, `evaluated_at`, source-state version and `valid_until`; use authenticated encryption or HMAC with rotation.
- Choose maximum acceptable stale-access TTL for revocation/subscription cancellation and add tests for revoke during cache lifetime.

## Assertion-by-assertion fit matrix

| Spine assertion | Fit | Evidence / condition |
| --- | --- | --- |
| DB resolver as PDP; middleware/RLS/email as PEP | **Fit** | Native PostgreSQL RLS/RPC supports this; PEPs must consume wrappers only. |
| One-time flow never mutates subscription lifecycle | **Fit** | Clean domain separation; current recurring handler already rejects non-subscription Session mode. |
| Signed webhook authoritative fulfillment | **Fit** | Current Next App Router handler correctly reads raw `request.text()` and uses `constructEvent`; official Stripe guidance matches. |
| Payment Link metadata copied to Session | **Fit** | Explicitly documented by Stripe. |
| Link deactivation stops new Link visits | **Fit** | `active=false` displays deactivated page. |
| Link deactivation guarantees no late payment | **Not fit** | No documented expiration of already-created open Sessions. |
| `checkout.session.completed` paid + `async_payment_succeeded` | **Fit** | Official qualifying fulfillment events. |
| Exact Price/quantity validation from fulfillment | **Partial** | Requires retrieve Session + expanded/paginated line items. |
| Session ID idempotency | **Fit** | Official guide requires concurrency-safe fulfillment once per Session; DB unique key is appropriate. |
| Event ID as audit constraint | **Fit** | Stripe recommends event IDs for duplicate delivery; object ID + type for separate duplicate events. |
| First accepted event timestamp as `paid_at` | **Not fit** | Processing order is nondeterministic; event `created` must not determine order. |
| One grant per offer/email | **Fit** | PG15 unique/partial constraints can enforce it; payment-attempt audit needs separate compatible schema. |
| Europe/Ljubljana calendar arithmetic | **Fit** | PG15 `timestamptz`, `AT TIME ZONE`, IANA tzdata and interval arithmetic support it; exact SQL still needs fixtures. |
| Verified-email atomic claim | **Fit** | Private definer transaction can query `auth.users` by `(select auth.uid())` and require confirmed email. |
| Private resolver, `search_path=''`, qualified names | **Fit / recommended** | Matches current Supabase security guidance. |
| Public no-user-ID authenticated RPC | **Fit** | Public exposed wrapper can derive `auth.uid()`; caller must use user access token, not service-role auth. |
| Service-role-only recipient RPC | **Fit** | Current server notification client has correct no-cookie service-role shape; explicit grants required. |
| Clients cannot mutate entitlements | **Fit** | No client table grants + RLS + service-only writes is supported. |
| Deadline-bounded access cache | **Partial** | Handles expiry, not revoke/cancellation staleness or key rotation. |
| Server-time half-open offer window | **Fit** | Next server route/config and PostgreSQL timestamps support it. |
| Existing self-hosted runtime | **Partial** | Deploy compose indicates PG15/PostgREST14, but live verification and version manifest are absent. |
| Declared JS package versions | **Accurate snapshot** | Lockfile/npm ls match; Next version is not safe-current. |

## Required technology gates before implementation/launch

- [ ] Upgrade Next.js to a currently patched release and rerun security audit + auth/proxy regressions.
- [ ] Pin test/live Stripe webhook endpoint API version and enabled event types.
- [ ] Retrieve canonical Checkout Session with complete line items before fulfillment.
- [ ] Replace event-order-dependent `paid_at` with an approved deterministic source.
- [ ] Approve late/open-session cutoff behavior and paid-but-non-granting refund/support path.
- [ ] Approve exact Supabase schema/function ownership/revoke/grant/default-privilege matrix.
- [ ] Run DB allow/deny tests for anon/authenticated/service_role and all content/storage surfaces.
- [ ] Verify actual self-hosted production runtime and take DB + Storage backups.
- [ ] Define signed cache token primitive, key rotation and revocation-staleness SLA.

## Final assessment

The chosen Stripe/Supabase architecture does not require a technology replacement. The correct path is to harden and fully specify it:

1. patch the currently vulnerable Next.js runtime;
2. make Stripe Session retrieval and webhook API versioning explicit;
3. stop treating Payment Link deactivation as expiration of open Sessions;
4. remove event-delivery order from the entitlement time contract;
5. promote Supabase privilege DDL and live self-host verification from deferred details to launch-blocking evidence.

After those gates, the spine is technically viable on the repository's Next.js/Node/Stripe and self-hosted Supabase/PostgreSQL architecture.
