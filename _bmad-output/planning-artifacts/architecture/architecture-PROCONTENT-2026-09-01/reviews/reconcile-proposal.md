# Reconciliation review — Sprint Change Proposal vs Architecture Spine

**Дата проверки:** 2026-09-01  
**Проверенные документы:**

- `sprint-change-proposal-2026-09-01.md` (далее — Proposal)
- `architecture-PROCONTENT-2026-09-01/ARCHITECTURE-SPINE.md` (далее — Spine)

**Метод:** построчное сопоставление обязательных product/security/payment constraints, edge cases, launch/rollback controls и approval boundaries. Исходные документы не изменялись.

## Verdict

**NEEDS RECONCILIATION / NOT YET BUILD-READY.** Spine правильно переносит базовую изоляцию one-time entitlement от recurring subscriptions, webhook-authoritative fulfillment, verified-email claim, единый access resolver, deadline-bounded cache и non-revoking rollback. Однако он одновременно:

1. принимает одно продуктовое решение, которое Proposal явно оставляет на отдельное approval;
2. объявляет часть правил обязательными, но оставляет те же вопросы в `Deferred / Separate Approval`;
3. вводит новые eligibility/duplicate-payment решения без полной support/refund и operational semantics;
4. не переносит несколько обязательных rollback, environment-isolation, access-surface и launch controls Proposal.

До реализации нужен единый decision register с источником, approver/date и состоянием каждого AD. Неутвержденные решения должны fail closed либо быть явно помечены как implementation blockers.

## Findings

### R-01 — HIGH — Approval state в Spine неоднозначен и конфликтует с общим gate Proposal

**Evidence**

- Proposal имеет статус «предложение; не утверждено, реализация не начата» и запрещает менять код, Stripe, Supabase и плановые артефакты до отдельного утверждения (Proposal:4, 18).
- Изменение классифицировано как Major и требует совместных approval PM/Owner + Architect до DEV (Proposal:89, 142, 152, 186, 195).
- Spine остается `status: draft` (Spine:8), но AD-1, AD-2, AD-5 и AD-8 уже помечены `[ADOPTED]`, тогда как AD-3, AD-4, AD-6 и AD-7 не имеют статуса (Spine:42-90).
- При этом ключевые детали schema/RLS, refund/support, `paid_at`, VIP/admin eligibility и Link rollback operation остаются deferred (Spine:141-150).

**Impact**

Команда не может однозначно определить, какие правила разрешено реализовывать, а какие требуют решения. Метка `build-substrate` в Spine не согласуется с draft/partial-approval состоянием. Это особенно опасно для платежей и RLS: реализация может начаться по правилу, которое юридически/продуктово еще не утверждено.

**Required reconciliation**

- Добавить decision ledger: `AD`, source decision, status (`proposed|approved|blocked|deferred`), approver, date, implementation gate.
- Явно записать общий Major-change gate из Proposal.
- Не считать Spine build-ready, пока migration/RLS privileges, payment exception policy, timestamp mapping и rollback ownership не утверждены.

### R-02 — HIGH — Email recipient policy преждевременно принята в Spine

**Evidence**

- Proposal прямо говорит, что включение временных участников в email-рассылку — отдельное продуктовое решение, которое нельзя неявно наследовать из `subscription_status` (Proposal:44).
- До test validation PM/Owner должен утвердить `opt-in email-notification policy`; handoff повторяет эту ответственность (Proposal:152, 186).
- Spine уже предписывает: `Email applies preferences and adds temporary users without changing the existing VIP/admin audience` (Spine:76), и не перечисляет email eligibility policy в Deferred (Spine:141-150).

**Impact**

Это прямой конфликт с approval boundary Proposal. Recipient RPC может начать рассылать контент аудитории, для которой opt-in/legal/product policy не утверждена.

**Required reconciliation**

- До явного решения заменить inclusion rule на fail-closed/pending policy.
- После approval зафиксировать: opt-in source, preference precedence, unsubscribe behavior, expiry behavior и обработку unclaimed purchasers.

### R-03 — HIGH — `paid_at` и calendar-expiry rule одновременно заданы и оставлены deferred; результат зависит от event delivery

**Evidence**

- Proposal требует `access_ends_at = paid_at + interval '3 months'`, half-open access и тесты 30/31/DST, но не определяет канонический Stripe timestamp (Proposal:70, 74, 104, 157).
- Spine AD-4 задает `paid_at` как timestamp первого принятого Stripe paid event и Europe/Ljubljana wall-clock arithmetic (Spine:60-64).
- Тот же Spine оставляет «Final Stripe timestamp mapping for paid_at» на separate approval (Spine:146); сам AD-4 не помечен `[ADOPTED]`.
- `first accepted` описывает порядок обработки, а не обязательно детерминированное свойство Session. При параллельной/переупорядоченной доставке eligible событий разные обработки могут выбрать разный timestamp, а AD-3 запрещает последующую коррекцию grant (Spine:58).

**Impact**

Срок доступа может различаться при retry/reordering, особенно для delayed methods. Нельзя доказать AC о неизменном трехмесячном сроке, пока не определены canonical source, tie-break и transaction behavior.

**Required reconciliation**

- Утвердить один детерминированный timestamp source и mapping для sync/async payment.
- Зафиксировать behavior при более раннем eligible event, доставленном после insert, и при несовпадении event/session/payment timestamps.
- Утвердить точную SQL/timezone формулу и DST/month-end fixtures до миграции.

### R-04 — HIGH — Duplicate-purchase и eligibility rules в Spine сильнее Proposal, но платный exception path не завершен

**Evidence**

- Proposal гарантирует idempotency только для одного Checkout Session ID (Proposal:72-74, 102) и не определяет, что делать с двумя разными успешно оплаченными Sessions одного purchaser/offer.
- Spine вводит один immutable grant на `(offer_code, purchaser_email_normalized)`; последующие paid Sessions становятся non-granting audit exceptions (Spine:54-58).
- Spine AD-8 дополнительно решает, что active/trialing subscribers и обладатель existing grant Link не получают, former subscribers могут получить, а VIP/admin eligibility остается undecided/fail-closed (Spine:89, 147).
- Refund/support policy для duplicate, ineligible и after-cutoff delayed payments остается deferred (Spine:145).
- Proposal называет offer вариантом для «новых покупок» и требует отдельный Owner/PM approval коммерческой политики, но не содержит полной eligibility matrix (Proposal:9, 89, 186).

**Impact**

Система может принять реальную оплату по сохраненному прямому Stripe Link, не выдать доступ и не иметь утвержденного автоматического refund/support SLA. App-level hiding Link не предотвращает прямую повторную оплату до Stripe deactivation.

**Required reconciliation**

- Зафиксировать решение AD-3 в Proposal/decision ledger как отдельное approved rule.
- До live launch утвердить eligibility matrix: anonymous/new, active/trialing, expired/canceled, VIP, admin, existing unclaimed/claimed/expired/revoked grant.
- Для каждого paid-but-non-granting исхода определить automatic refund/manual review, owner, deadline, customer message и audit status.

### R-05 — HIGH — Rollback в Spine не является исполнимым runbook

**Evidence**

- Proposal требует preview до cutoff, точное переключение app gate/UI, smoke test original `/api/checkout`, Stripe Link deactivation с ID/timestamp, проверку недоступности Link, неизменности subscriptions, продолжения entitlements и сохранения audit records (Proposal:169-175).
- Proposal также требует pre-launch immutable snapshot recurring state, live read-only validation, controlled purchase и monitoring webhook failures/unmatched entitlements (Proposal:162-167).
- Spine содержит только policy-level cutoff/deactivation rule (Spine:85-90, 139) и откладывает owner, automation/runbook, evidence и fallback (Spine:149).

**Impact**

Есть race между server-time cutoff и ручной Stripe deactivation, нет назначенного исполнителя/резервного механизма и нет обязательного evidence pack. Архитектурный rollback нельзя считать проверяемым или operationally safe.

**Required reconciliation**

- Сослаться из Spine на обязательный versioned runbook либо перенести минимальный ordered checklist как binding companion.
- Назначить Owner/backup, scheduled time, evidence fields и fallback при Stripe/API/deploy failure.
- Отдельно описать pending async payments at cutoff и post-cutoff webhook retry window.

### R-06 — MEDIUM — Test/live Stripe isolation и production config safety не закреплены как invariant

**Evidence**

- Proposal требует разные test/live Link/Price IDs и URL и запрещает test IDs в production config (Proposal:56, 151).
- Перед реализацией должны быть read-only проверены exact Price/Link, metadata, quantity, redirect и отсутствие recurring fields (Proposal:50-57, 150, 165).
- Spine говорит об exact server allowlist (Spine:52), но сами test/live values и allowlist оставляет deferred (Spine:143), не фиксируя environment separation или startup/deploy validation.

**Impact**

Ошибочная конфигурация может направить production CTA в test mode либо принять event не из того Stripe mode/account.

**Required reconciliation**

- Добавить invariant: environment-scoped config, mode/account consistency validation, production startup fail-closed при test ID и запрет client exposure кроме публичного Link URL через server gate.

### R-07 — MEDIUM — Exact access surfaces Proposal сведены к абстрактному `RLS`, поэтому coverage не доказана

**Evidence**

- Proposal требует parity middleware/RLS для posts, media и comments и запрещает доступ на exact deadline (Proposal:80, 105).
- Spine определяет PDP/PEP pattern и generic RLS wrapper (Spine:24, 72-83), но не перечисляет конкретные защищаемые relations/storage/media delivery paths.
- Capability map содержит только общий `Content access` (Spine:136).

**Impact**

Можно корректно внедрить resolver в часть SQL policies и оставить media/storage или comments на старом predicate. Общие слова про RLS не являются coverage matrix.

**Required reconciliation**

- Добавить access-surface matrix: route/middleware, table/view/function, storage/media delivery, current policy, target resolver wrapper и regression test.
- Проверить, что raw fields не читаются ни одним PEP, включая recipient selection.

### R-08 — MEDIUM — Claim/onboarding edge cases перенесены не полностью

**Evidence**

- Proposal требует два пути: purchaser без аккаунта создает account и claim после email verification; existing verified account claim после login/confirm. Mismatch, unpaid и already-claimed не дают доступ (Proposal:78, 103).
- Proposal фиксирует safe redirect entry point с `{CHECKOUT_SESSION_ID}` и post-payment/inactive copy с объяснением expiry/no-renewal (Proposal:55, 134).
- Spine AD-5 задает verified-email atomic claim и session ID как UX hint (Spine:66-70), но не описывает routing/idempotent UX для обеих account states, inactive fallback и recovery при claim failure.

**Impact**

Security predicate может быть верным, но пользователь останется в `/inactive` или не сможет повторить безопасный claim после transient failure.

**Required reconciliation**

- Добавить state/route matrix для anonymous, unverified, existing verified, email mismatch, already claimed и transient DB failure.
- Зафиксировать retry-safe claim entry point и безопасную UX индикацию без раскрытия purchaser email/payment details.

### R-09 — MEDIUM — Минимальная entitlement/audit schema Proposal не связана с AD rules

**Evidence**

- Proposal перечисляет обязательные identity, Stripe, lifecycle и immutable audit fields, включая `revoked_at`, `amount_total`, `currency`, Price/Link/Intent IDs (Proposal:63-70).
- Spine показывает только `access_entitlements`, а migration-level schema/uniqueness/RLS/GRANT matrix целиком deferred (Spine:29, 98, 114-127, 144).
- AD-3 требует uniqueness на offer+email, а AD-2 — Session idempotency и exact audit validation; без schema contract их совместимость не доказана (Spine:52, 58).

**Impact**

Можно реализовать logical rules без необходимых constraints, event audit или revoke/reconciliation lifecycle. Особенно неясно, где хранить все paid non-granting Sessions, если grant table уникальна по purchaser/offer.

**Required reconciliation**

- До Story implementation утвердить ERD/state machine и разделить grant от payment-attempt/audit exception при необходимости.
- Определить partial unique constraints, nullable semantics, immutable columns, revoke transition, retention/redaction и service-role-only writes.

### R-10 — LOW — UI/accessibility и exact rollback copy отсутствуют в capability map Spine

**Evidence**

- Proposal содержит binding UI/copy prohibitions, accessibility, 44×44 px, semantic strikethrough, keyboard focus и responsive checks (Proposal:97-99, 108, 159).
- Spine отражает только temporary pricing window/server gate (Spine:137) и не ссылается на UX/story companion с этими acceptance criteria.

**Impact**

Architecture handoff не гарантирует, что delivery сохранила commercial truth и accessibility constraints, хотя server flow будет корректен.

**Required reconciliation**

- Добавить binding companion/reference на Story/UX acceptance criteria и rollback copy baseline; не обязательно дублировать весь UI текст в architecture spine.

## Correctly preserved constraints

Следующие обязательные решения Proposal перенесены без существенного конфликта:

- one-time lifecycle не пишет в Stripe subscription/profile subscription fields (Proposal:82, 100, 106; Spine:42-46);
- signed, allowlisted, paid webhook fulfillment и async success handling (Proposal:72-74, 101; Spine:48-52);
- redirect/session possession не является доказательством entitlement, claim требует verified normalized email (Proposal:78; Spine:66-70);
- единый time-aware access resolver и deadline-bounded cache (Proposal:80, 104-105; Spine:72-83);
- offer использует server-time half-open interval, recurring flow сохраняется, cutoff не отзывает выданные entitlements (Proposal:97, 100, 107; Spine:85-90).

## Required approval checklist before implementation

- [ ] Owner/PM: commercial eligibility matrix и duplicate/ineligible payment policy.
- [ ] Owner/PM: email recipient opt-in/preferences/unsubscribe/expiry policy.
- [ ] Owner/PM: final Slovenian offer, post-payment и inactive copy.
- [ ] Architect: deterministic `paid_at` source, timezone formula, concurrency behavior.
- [ ] Architect: entitlement/payment-audit schema, uniqueness, state machine, RLS/GRANT matrix and access-surface coverage.
- [ ] Owner + DEV/Operations: Link deactivation owner/backup, scheduled rollback, evidence and fallback.
- [ ] DEV/QA/Owner: isolated test/live configuration, Stripe end-to-end checks, recurring regression and exact cutoff/pending-payment scenarios.

## Minimum reconciliation outcome

Spine может стать build-ready, когда:

1. все AD имеют однозначный статус и provenance;
2. R-02 email conflict устранен;
3. R-03/R-04 payment timestamp, duplicate and paid-exception policies утверждены;
4. R-05 rollback/runbook и R-06 environment isolation являются binding;
5. schema/access-surface matrices имеют approved companion artifacts;
6. общий Major-change approval gate Proposal выполнен и зафиксирован.
