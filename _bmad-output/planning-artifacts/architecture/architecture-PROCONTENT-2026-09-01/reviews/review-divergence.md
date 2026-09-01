# Adversarial Divergence Review — Temporary One-Time Access

**Target:** `ARCHITECTURE-SPINE.md`  
**Reviewer lens:** построить независимые units уровнем ниже, которые соблюдают каждый AD буквально, но принимают несовместимые решения.  
**Дата:** 2026-09-01

## Verdict

**FAIL — spine не является достаточным consistency contract для независимой реализации.** Найдено восемь пар формально допустимых downstream-реализаций. Они расходятся в shared data shape, выборе owner/mutation path, time/idempotency semantics, resolver/PEP contracts и rollback orchestration. Пять расхождений способны изменить выданное право или сделать independently-built stories несовместимыми на границе.

## Findings

### DIV-1 — [CRITICAL] Grant и payment exception допускают две несовместимые модели хранения

**Unit A — единый ledger:** webhook story пишет каждую paid Session в `access_entitlements`; одна строка имеет granting lifecycle, остальные получают non-granting status/reason. Claim, resolver и reconciliation читают одну таблицу.

**Unit B — разделённые сущности:** schema story хранит в `access_entitlements` только единственный grant, а все Session/payment facts и exceptions — в отдельном audit/event ledger. Claim и resolver никогда не видят exception rows в entitlement table.

Обе реализации соблюдают AD-1, AD-2, AD-3 и AD-9: billing отделён, grant ровно один, последующие платежи остаются non-granting audit exceptions, reconciliation существует. Но независимо построенные webhook, claim, resolver и admin/reconciliation stories выберут разные таблицы, FK, status lifecycle и ownership mutations.

**Hole to close:** spine должен закрепить общий logical record shape и владельца переходов grant/candidate/exception либо явно разделить grant и payment-attribution ledgers и назначить границу между ними. Текущий Deferred «migration-level schema» оставляет feature-level divergence незакрытым.

### DIV-2 — [CRITICAL] `purchaser_email_normalized` не имеет канонического Stripe source

**Unit A — Checkout snapshot:** fulfillment берёт `customer_details.email`, затем применяет `lower(btrim(...))`; отсутствие snapshot делает payment non-granting exception.

**Unit B — customer identity:** fulfillment берёт `customer_email`, Customer object email или allowlisted metadata по собственной precedence, затем применяет ту же нормализацию.

Обе реализации буквально соблюдают AD-3, AD-5 и Email identity convention: ключ называется `purchaser_email_normalized`, используется exact normalization, aliasing отсутствует. Spine не определяет source/precedence и поведение при расхождении полей. Одна и та же Session может получить разные uniqueness keys и claimability, включая привязку к разным Supabase identities.

**Hole to close:** закрепить authoritative Stripe field, допустимые fallbacks, mismatch outcome и missing-email outcome как entitlement identity contract.

### DIV-3 — [HIGH] Claim contract допускает несовместимые cardinality и selector semantics

**Unit A — claim-all:** no-argument authenticated RPC атомарно присоединяет все подходящие `unclaimed` grants для confirmed normalized email; `/auth/confirm` и authenticated return вызывают его одинаково.

**Unit B — claim-hinted:** тот же server contract принимает optional Session/offer hint, выбирает ровно один matching `unclaimed` candidate и всё равно заново доказывает email + `auth.uid()`; hint не является proof.

Обе реализации соблюдают AD-5: claim server-side и atomic, identity verified, Session ID лишь hint, один entitlement не получает двух users. Но auth-confirm story без Checkout context и payment-return story с Session context могут разработать несовместимые RPC signatures и по-разному оставить старые purchases unclaimed.

**Hole to close:** определить claim input contract, selection cardinality, поведение при нескольких offers/candidates и идемпотентный result shape. Вызов из двух entry points сам по себе этого не фиксирует.

### DIV-4 — [CRITICAL] Для двух distinct paid Sessions не определён детерминированный grant winner

**Unit A — fulfillment winner:** первая успешно закоммиченная paid Session для `(offer_code, email)` получает immutable grant candidate; конкурентная/позже доставленная Session сразу становится exception.

**Unit B — claim-time winner:** webhook сохраняет несколько verified payment candidates как не-доступ; при claim выбирается candidate с минимальным `paid_at` (и локальным tie-breaker), остальные становятся exceptions.

Обе реализации обеспечивают один immutable grant, retry no-op по Session ID и не расширяют срок через повторный Session. AD-3 говорит «later paid Sessions», но не определяет, означает ли `later` Stripe time, delivery/commit order или claim-time ordering; `unclaimed` явно объявлен candidate, а не access. Для одного и того же набора out-of-order событий implementations выдадут entitlement с разными `paid_at` и `access_ends_at`.

**Hole to close:** закрепить момент выбора grant, ordering key и tie-breaker для distinct Sessions, включая concurrent delivery и replay. Session-level idempotency AD-2 этот конфликт не решает.

### DIV-5 — [CRITICAL] Resolver fields названы, но их wire semantics не связаны между PEPs

**Unit A — effective-deadline contract:** `sources[]` — unordered set фиксированного enum; `valid_until=NULL`, если хотя бы один effective source не имеет entitlement deadline, иначе это срок всего effective access. Middleware трактует NULL как отсутствие deadline.

**Unit B — source-deadline contract:** `sources[]` имеет priority order; `valid_until` возвращает ближайший либо максимальный известный source deadline даже при параллельном recurring/VIP/admin source. Middleware использует его для cache refresh, email — для filtering.

Обе реализации возвращают обязательные `has_access`, `sources[]`, `valid_until`, `evaluated_at`, используют перечисленные sources и не дублируют raw access conditions в PEPs. AD-6 не задаёт enum/order/null semantics, multi-source aggregation, serialization или error result. Independently-built RPC, middleware, RLS wrapper и recipient selector могут быть type-compatible, но семантически противоположными; AD-7 также не определён при `valid_until=NULL`.

**Hole to close:** закрепить resolver result contract: source vocabulary/set semantics, effective `valid_until` aggregation и NULL meaning, evaluation-time ownership, fail/error behavior и wrapper serialization.

### DIV-6 — [HIGH] Email preference overlay может принадлежать DB RPC или application PEP

**Unit A — recipient-owned RPC:** service-role RPC применяет resolver, `email_notifications_enabled`, audience exclusions и dedupe, возвращая готовые recipient records.

**Unit B — access-only RPC:** service-role RPC возвращает qualifying user IDs/sources; notification unit сама join-ит profiles, применяет preferences, VIP/admin audience rule, pagination и dedupe.

Обе реализации соблюдают AD-6: recipient selection основан на resolver, preferences применены, temporary users добавлены без расширения VIP/admin-only audience. Но разные stories выберут несовместимые result shapes, pagination owner и snapshot boundary; preference может измениться между access selection и send в Unit B, тогда как Unit A даёт единый DB snapshot.

**Hole to close:** определить owner и минимальный shared shape для recipient selection, preference filtering, dedupe и pagination/snapshot semantics.

### DIV-7 — [HIGH] Offer window и allowlist не имеют единого configuration owner

**Unit A — central offer registry:** redirect gate, pricing server render и webhook читают один server-only offer record; sale switch и immutable fulfillment allowlist — разные поля.

**Unit B — independently pinned contracts:** UI/gate используют server constants, webhook имеет собственную exact allowlist, operations отдельно владеет Stripe Link; значения изначально совпадают и cutoff вычисляется server-side.

Обе реализации соблюдают AD-2 и AD-8 при первом deploy: точные IDs/metadata проверяются, client time не используется, recurring path сохранён, retries продолжают валидироваться по историческому allowlist. Но rotation test/live IDs, hotfix окна или cutoff operation может обновить только одного owner и создать sales-without-fulfillment либо fulfillment неизвестного UI offer.

**Hole to close:** закрепить canonical config authority, consumers, environment partitioning и правило сохранения historical fulfillment allowlist. Deferred exact values может оставаться, но ownership не может оставаться свободным для независимых units.

### DIV-8 — [HIGH] Rollback допускает несовместимый порядок действий и двойное владение

**Unit A — app-first:** назначенный deploy owner включает fail-closed cutoff/recurring UI, затем Stripe operator деактивирует Link и фиксирует evidence.

**Unit B — Stripe-first:** назначенный operations owner деактивирует Link в cutoff, затем app owner подтверждает server mode и выполняет smoke checks.

Обе реализации выполняют AD-8/AD-9: Link деактивирован, app fail-closed, recurring checkout и continuing entitlements проверены, operator/evidence существуют. Но два independently-authored runbook могут считать свой шаг gate/trigger для другого, иметь разных owners и оставить окно, где CTA ведёт на disabled Link, либо shared Link остаётся активным после app rollback. Deferred одновременно оставляет owner/runbook открытым, хотя AD-9 требует executable rollback.

**Hole to close:** закрепить одного accountable rollback owner, authoritative cutoff signal, порядок/acknowledgement между app и Stripe operations и критерий полного rollback. Детали automation могут остаться отдельным approval.

## Secondary divergence

### DIV-9 — [MEDIUM] Business exception не имеет webhook acknowledgement contract

**Unit A:** после durable exception write возвращает Stripe `2xx`, исключая дальнейшие retries.  
**Unit B:** durable exception сохраняется, но webhook возвращает retryable error до ручного reconciliation; Session idempotency не создаёт второй record.

Обе реализации сохраняют non-granting context и не выдают доступ; AD-9 явно делает transient failures retryable, но не фиксирует terminal acknowledgement для business exceptions. Unit B создаёт retry storm и иные operational semantics.

**Hole to close:** определить terminal/retry classification и acknowledgement rule для unknown, duplicate, ineligible и late outcomes.

## Coverage matrix

| Required dimension | Divergence findings |
| --- | --- |
| Shared data shapes | DIV-1, DIV-2, DIV-5, DIV-6 |
| Owner / mutation paths | DIV-1, DIV-3, DIV-6, DIV-7 |
| Time / idempotency | DIV-4, DIV-9 |
| Resolver / PEPs | DIV-5, DIV-6 |
| Rollback | DIV-7, DIV-8 |

## Gate conclusion

До передачи независимым implementation stories spine должен как минимум связать DIV-1, DIV-2, DIV-4, DIV-5 и DIV-7/8. Это не migration-level SQL или подробный code design: это feature-level contracts, без которых несколько нижележащих units могут корректно следовать ADs и получить несовместимую систему.

Spine в рамках review не изменялся.
