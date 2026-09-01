# Targeted Divergence Close Re-check

**Target:** updated `ARCHITECTURE-SPINE.md`  
**Дата:** 2026-09-01

## Verdict

**FAIL — прежние 3 High закрыты, но recent fixes оставили 3 новых High integration divergences.** Wire identifiers/NULL cache semantics, fail-closed test/live selection и rollback roles/order теперь однозначны. Новые расхождения касаются epoch unit, ownership refund state и middleware RPC boundary.

## Closed targeted findings

- **Resolver identifiers / NULL cache:** AD-6 фиксирует ordered identifiers `admin`, `vip`, `recurring`, `temporary_one_time`; AD-7 фиксирует canonical token fields и short TTL при NULL.
- **Environment selection:** AD-8 требует одному `TemporaryOfferConfig` загрузить ровно один explicit `test`/`live` namespace и fail closed при mixed/missing configuration.
- **Rollback:** AD-9 фиксирует Accountable/Responsible roles, app-first order, evidence/smoke scope и go/no-go conditions.

## Remaining High findings

### CLOSE-DIV-1 — [HIGH] `valid_until_epoch` не фиксирует единицу времени

**Unit A:** DB/RPC adapter сериализует Unix epoch seconds; middleware сравнивает с `Math.floor(Date.now() / 1000)` и вычисляет cookie `maxAge` в seconds.

**Unit B:** resolver adapter сериализует JavaScript epoch milliseconds; middleware сравнивает с `Date.now()` и затем передаёт вычисленное значение в cookie API как seconds.

Обе реализации используют canonical `valid_until_epoch: number|null`, canonical sources, configured short TTL при NULL и отклоняют reached deadline в собственной unit-системе. Spine не говорит seconds или milliseconds. Независимо построенные token producer/parser либо истолкуют deadline в 1000 раз позже, либо немедленно инвалидируют доступ.

**Binding required:** закрепить Unix epoch seconds или milliseconds для wire field и единицы всех TTL/deadline arithmetic.

### CLOSE-DIV-2 — [HIGH] Append-only fulfillment attempt несовместим с неразмещённым refund lifecycle

**Unit A — immutable audit:** `payment_fulfillment_attempts` запрещает UPDATE; reconciliation пишет `refund_pending/refunded/refund_failed_manual` в отдельный append-only refund event ledger, связанный с Session attempt.

**Unit B — mutable workflow state:** один attempt row остаётся audit record платежа, но service-role reconciliation обновляет на нём `refund_status` по AD-9; строка не удаляется и Session key остаётся идемпотентным.

Unit A строго следует «append-only attempts». Unit B опирается на AD-9 lifecycle и AD-10, который разрешает service-role DML без DELETE, но не запрещает UPDATE. Оба сохраняют non-granting access и Session-derived idempotency, однако independently-built webhook schema и reconciliation worker несовместимы по table shape, privileges и audit semantics.

**Binding required:** назначить владельца refund lifecycle и явно выбрать отдельный immutable refund ledger либо разрешённые mutable поля attempt row; согласовать это с `append-only` и GRANT contract.

### CLOSE-DIV-3 — [HIGH] Middleware RPC остаётся неназванным shared contract

**Unit A:** DB migration публикует отдельный `get_my_content_access_state()` с full resolver state; middleware вызывает его и строит token.

**Unit B:** DB migration публикует иной no-argument RPC/shape либо пытается переиспользовать boolean `public.has_current_content_access()`; middleware story ожидает выбранное ею имя и full state.

Обе units могут заявить соответствие AD-6: RLS использует названный boolean wrapper, middleware обслуживается no-argument authenticated RPC, PEP не читает raw fields. Но spine именует только RLS function и не связывает middleware function name, exact returned SQL/wire shape или error outcome. Раздельные DB и middleware stories не имеют общего integration contract; boolean wrapper также недостаточен для AD-7 token fields.

**Binding required:** назвать middleware RPC и зафиксировать его full result contract (`has_access`, canonical `sources`, deadline/evaluation wire types) и fail-closed error outcome.

## Close conclusion

Новых Critical findings нет. PASS возможен после закрытия CLOSE-DIV-1..3; spine в рамках проверки не изменялся.
