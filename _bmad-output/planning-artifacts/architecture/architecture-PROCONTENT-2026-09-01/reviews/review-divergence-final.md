# Final Adversarial Divergence Re-check

**Target:** updated `ARCHITECTURE-SPINE.md`  
**Lens:** повторная попытка построить независимые, формально compliant, но несовместимые реализации для ранее найденных divergence pairs.  
**Дата:** 2026-09-01

## Verdict

**PARTIAL PASS — прежние Critical divergences закрыты; остаются 3 High.** Обновлённые AD однозначно связывают two-table grant/attempt model, authoritative purchaser email и конкурентного grant winner. Однако resolver wire contract, active test/live selection внутри общего offer config и accountable rollback orchestration всё ещё позволяют независимо построить несовместимые units.

## Closed on re-check

### Grant / attempt model — closed

AD-3 теперь фиксирует append-only `payment_fulfillment_attempts` для всех qualifying/exception Sessions и отдельный `access_entitlements`, содержащий только grants. Реализации «exceptions в entitlement table» и «отдельный audit ledger» больше не обе compliant.

### Canonical purchaser email — closed

AD-3 фиксирует retrieved `Checkout Session.customer_details.email`, единственную нормализацию `lower(btrim())`, missing-email exception и запрет substitute из metadata/redirect/PaymentIntent. Альтернативная source precedence больше не compliant.

### Concurrent grant winner — closed

AD-3 фиксирует DB unique key и первый atomic `INSERT ... ON CONFLICT DO NOTHING` как authoritative winner. Claim-time ordering, minimum `paid_at` и replacement winner больше не compliant.

## Remaining High findings

### FINAL-DIV-1 — [HIGH] `sources[]` не имеет стабильного wire vocabulary, а AD-7 не определён для `valid_until=NULL`

**Unit A:** resolver сериализует sources как `['admin', 'vip', 'recurring', 'temporary_one_time']`; middleware трактует `valid_until=NULL` как «использовать configured TTL», а email RPC проверяет `temporary_one_time` для audience expansion.

**Unit B:** resolver сериализует те же active sources как `['role_admin', 'vip_access', 'stripe_subscription', 'entitlement']`; middleware при NULL не создаёт cache token, а email PEP ожидает `entitlement`.

Обе реализации соблюдают AD-6: `sources[]` содержит все active sources без PEP-defined priority; `valid_until` aggregation и NULL для admin/VIP/recurring совпадают. Обе безопасны относительно deadline, но независимо построенные resolver и PEP units несовместимы по source identifiers и cache behavior. Формула AD-7 `min(configured_ttl, valid_until - now)` не имеет результата при NULL.

**Required binding:** закрепить source enum/wire identifiers и правило AD-7 для NULL (`configured_ttl` либо явный no-cache outcome), а не оставлять это каждому PEP.

### FINAL-DIV-2 — [HIGH] Единый `TemporaryOfferConfig` не владеет выбором active test/live environment

**Unit A:** общий config экспортирует `test` и `live` records; pricing/redirect выбирают branch по deployment environment, webhook независимо выбирает branch по Stripe key mode. Constants не дублируются, все consumers читают один config.

**Unit B:** общий config централизованно вычисляет один `active` record из explicit server-only mode и отдаёт consumers уже выбранную identity.

Обе реализации соблюдают AD-8 буквально: существует один server-only config, владеющий exact test/live IDs, все consumers используют его без duplicated constants. Но Unit A допускает mixed environment selection: UI выдаёт test Link, а webhook валидирует live allowlist, либо наоборот. Unit B fail-closed централизованно. Наличие общей структуры не связывает authority выбора active branch.

**Required binding:** `TemporaryOfferConfig` должен владеть не только обоими наборами IDs, но и единственным fail-closed active-environment selection; consumers не выбирают test/live самостоятельно.

### FINAL-DIV-3 — [HIGH] Rollback owner и порядок app/Stripe операций всё ещё оставлены двум runbooks

**Unit A — app-first:** deploy owner включает recurring mode/fail-closed cutoff, подтверждает прекращение выдачи Link, затем Stripe operator деактивирует Link и прикладывает evidence.

**Unit B — Stripe-first:** operations owner деактивирует Link по cutoff, затем app owner подтверждает recurring mode и запускает smoke checks.

Обе реализации выполняют AD-8/AD-9: app cutoff fail-closed, Link деактивирован, operator назван внутри локального runbook, evidence и smoke checks присутствуют, continuing entitlements не отзываются. Но independently-authored runbooks могут назначить разных accountable owners и считать чужой шаг precondition/acknowledgement, оставляя CTA на disabled Link либо активный shared Link после app rollback. Deferred по-прежнему откладывает именно owner/runbook, который нужен до безопасной декомпозиции operations story.

**Required binding:** закрепить одного accountable rollback owner, authoritative cutoff signal, обязательный порядок или handshake между app и Stripe operations и единый completion criterion. Конкретная automation может остаться отдельным approval.

## Final gate conclusion

Новых Critical findings по шести повторно проверенным областям нет. Перед передачей независимым implementation units требуется закрыть FINAL-DIV-1 и FINAL-DIV-2; перед production/operations handoff — FINAL-DIV-3.

Spine в рамках re-check не изменялся.
