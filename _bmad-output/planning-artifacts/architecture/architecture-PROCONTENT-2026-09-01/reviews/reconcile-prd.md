# Reconciliation Review: PRD vs Architecture Spine

**Дата:** 2026-09-01  
**Scope:** только временное one-time предложение €29 и продолжающиеся трёхмесячные права доступа  
**Сравниваемые документы:**

- `../../prd.md` — product contract, статус `final`.
- `../ARCHITECTURE-SPINE.md` — build substrate, статус `draft`.

Исходные документы не изменялись.

## Verdict

**MUST RECONCILE BEFORE IMPLEMENTATION.** Spine сохраняет основную модель — one-time платёж не является подпиской, доступ выдаётся через отдельный entitlement, текущие recurring-подписки не мутируют, индивидуальный срок не сокращается при rollback. Однако перенос PRD неполон: есть два прямых смысловых расхождения, несколько обязательных требований представлены только частично, а frontmatter ошибочно заявляет полное покрытие `FR1.4.1`, `FR1.4.2`, `FR1.4.3` и `NFR19`.

Критические расхождения:

1. Публичный/direct Payment Link с post-payment fail-closed не обеспечивает требование «действующая подписчица не может оформить предложение».
2. Spine создаёт `unclaimed entitlement` до верификации email, тогда как PRD требует создать временное право только после подтверждённой оплаты **и** верификации того же email.
3. UX-семантика предложения из `FR1.4.1` не закреплена архитектурным инвариантом.
4. Invitation/onboarding flow после оплаты отсутствует в spine.
5. Обязательная ручная проверка сбойных webhook из `NFR19` заменена более слабым «retain safe audit context».

## Матрица трассировки

| PRD contract | Evidence в PRD | Представление в spine | Статус |
| --- | --- | --- | --- |
| €29, только one-time, 3 календарных месяца, campaign window | строки 121, 370 | scope, AD-4, AD-8; exact amount/currency allowlist отложен в строке 143 | **Частично** |
| Только временное предложение для новых покупок в окне | строки 121, 153, 370 | AD-8 переключает server mode; фраза «original recurring UI/checkout contract remains intact» не определяет, недоступны ли старые direct recurring checkout URLs | **Неоднозначно** |
| Нет тарифного выбора, recurring, автопродления, помесячного расчёта, cancellation UX и обещания новых публикаций | строка 371 | AD-1 запрещает mutation subscription lifecycle, но UI/copy/checkout exclusions отсутствуют; copy целиком deferred | **Не перенесено** |
| Право создаётся только после paid + verification того же normalized email | строка 372 | AD-2 создаёт webhook-issued grant; AD-5 затем claim-ит `unclaimed entitlement` после verification | **Искажено / требует определения состояния** |
| Текущие `active`/`trialing` не видят и не могут оформить; бывшие могут | строка 373 | AD-8 скрывает Link для authenticated active/trialing и допускает former; direct ineligible payments обрабатываются лишь после факта оплаты | **Частично, запрет покупки не обеспечен** |
| Текущая recurring subscription не изменяется | строки 121, 370, 373, 379 | AD-1 запрещает mutation subscription/customer billing state | **Покрыто** |
| Доступ `[paid_at, paid_at + 3 calendar months)` и закрытие в deadline | строки 372, 376 | AD-4, AD-7 | **Покрыто**, но точное поле Stripe для `paid_at` остаётся deferred |
| Campaign cutoff не отзывает выданные права; recurring UI/checkouts возвращаются | строки 121, 376, 379 | AD-8 | **Покрыто** |
| После оплаты email invitation, verification, password setup; первая оплата ведёт в onboarding | строки 153, 367, 390 | AD-5 упоминает auth confirmation/return, но нет invitation dispatch, delivery/retry, password setup или onboarding route/state | **Не перенесено** |
| Temporary users получают publication email во время active entitlement с учётом preferences | строки 432–433 | AD-6 recipient RPC + preferences | **Покрыто** |
| Webhook signature verification | строка 466 | AD-2 | **Покрыто** |
| Retry одного webhook не создаёт дубли доступа | строка 487 | AD-2 + Session uniqueness; AD-3 добавляет duplicate purchase policy | **Покрыто** |
| Failed webhook логируется для ручной проверки admin | строка 488 | convention «retain safe audit context»; нет durable failure state, admin queue/visibility или review lifecycle | **Частично / ослаблено** |
| Checkout/init failure показывает friendly retry-later message и снижает double-charge risk | строка 489 | отсутствует и не указан в `binds` | **Не перенесено** |
| GDPR deletion/retention ≤ 3 months для deleted/unsubscribed member | строки 471–474 | purchaser email/exception retention полностью deferred | **Не разрешено** |
| Admin видит всех active participants | glossary строка 55 + FR32 строка 443 | PDP знает temporary access, но admin participant view/API отсутствует в architecture map | **Не перенесено для temporary cohort** |

## Findings

### F1 — Direct Payment Link нарушает строгую eligibility-семантику `FR1.4.3` — Critical

PRD требует одновременно два свойства: действующая `active`/`trialing` подписчица не видит предложение **и не может его оформить**. AD-8 обеспечивает только UI/redirect gate для authenticated user. Если Payment Link известен напрямую, Stripe принимает оплату вне этого gate. AD-8 и error convention затем позволяют признать платёж ineligible, не выдать grant и оставить audit exception; deferred refund/support policy подтверждает, что такой платёж архитектура считает возможным.

Это не эквивалент «не может оформить»: покупка уже состоялась, а доступ и возврат решаются после списания.

**Требуемое согласование:** выбрать одно из двух и отразить одинаково в PRD/spine:

- controlled server-created Checkout Session с pre-check eligibility и отсутствием публичного reusable Link; либо
- осознанно ослабить продуктовый контракт до «не предлагается; direct ineligible payment не предоставляет доступ и проходит автоматический refund/support flow».

До решения нельзя считать `FR1.4.3` bound.

### F2 — `unclaimed entitlement` появляется раньше разрешённого PRD момента — High

`FR1.4.2` говорит, что временное право создаётся только после двух условий: confirmed payment и verification того же normalized email. Spine строит другую state machine:

```text
paid webhook -> unclaimed entitlement -> verified-email claim -> effective access
```

С точки зрения access enforcement это fail-closed: AD-6 учитывает только claimed/unexpired source. Но с точки зрения domain model сущность `access_entitlements` уже создана до email verification, то есть буквальный lifecycle PRD изменён.

**Требуемое согласование:** либо хранить до verification сущность не являющуюся правом (`paid_purchase`, `claimable_purchase`, `pending_grant`) и создавать `access_entitlement` атомарно при claim, либо явно определить в PRD/domain vocabulary, что `unclaimed` запись — не право доступа, а pending evidence, и гарантировать, что она нигде не считается entitlement source.

### F3 — `FR1.4.1` свёрнут до backend separation и потерял UX/offer contract — High

AD-1 предотвращает создание Stripe Subscription, но не фиксирует остальные запреты PRD:

- отсутствие выбора тарифов;
- отсутствие recurring/autorenewal/cancellation/proration semantics в UI;
- отсутствие обещания регулярной публикации нового контента;
- корректная one-time маркировка до перехода в Stripe и после оплаты.

Перенос всей Slovenian copy в Deferred не должен переносить саму обязательную семантику. Текст может быть отдельным approval, но отрицательные продуктовые утверждения должны быть adopted invariant и иметь acceptance surfaces: landing CTA, checkout handoff, success/claim screen, account/access status.

### F4 — Post-payment invitation и onboarding не имеют архитектурного владельца — High

Journey 1, `FR1.1` и `FR10` формируют end-to-end contract: после оплаты пользовательница получает email link, подтверждает тот же email, задаёт пароль и после первой оплаты попадает на onboarding. AD-5 описывает только security condition claim-а. В structural seed и capability map отсутствуют:

- кто и после какого события отправляет invitation;
- идемпотентность и retry invitation;
- связка Supabase verification/password setup с claim;
- поведение для уже существующего verified account;
- post-claim redirect/onboarding eligibility;
- безопасное поведение, если email не доставлен или link истёк.

Без этого spine не является достаточным build substrate для happy path PRD.

### F5 — `NFR19` заявлен как bound, но фактически ослаблен — High

PRD требует логировать webhook failure **для ручной проверки администратором**. Строка 101 spine гарантирует только safe audit context. Это не определяет durable failure record, retry/dead-letter state, admin visibility, review ownership и resolution state. Отдельный deferred refund/support policy также не закрывает технические сбои webhook.

**Требуемое согласование:** добавить обязательный operational path `received -> processing -> fulfilled / ignored / failed_review`, durable error metadata без секретов, повторную обработку и admin/support review surface или формальный runbook. Иначе убрать `NFR19` из `binds`.

### F6 — Exact €29/EUR acceptance остаётся deferred — Medium

PRD фиксирует конкретную цену. AD-2 требует exact server allowlist, но строка 143 откладывает сами Link/Price/amount/currency values. Для draft это допустимый configuration task, однако build substrate должен зафиксировать неизменяемый expected commercial tuple как минимум `amount_total=2900`, `currency='eur'`, `mode='payment'`, `quantity=1`, environment-specific Price/Link IDs. Иначе architecture формально допускает иной amount/currency при ошибочной конфигурации.

### F7 — `paid_at` одновременно «решён» и deferred — Medium

AD-4 определяет `paid_at` как timestamp первого принятого paid-event, но Deferred строка 146 оставляет финальное Stripe timestamp mapping открытым. Это не прямое противоречие PRD, потому что PRD не называет Stripe field, однако downstream implementation остаётся неоднозначной для immediate и delayed payment methods.

Нужно закрепить точный source field/event precedence и доказать fixtures для DST/month-end. До этого нельзя считать формулу срока полностью implementable, хотя её calendar semantics перенесена корректно.

### F8 — Temporary cohort отсутствует в admin participant model — Medium

По glossary временная покупательница является `Subscriber`, а `FR32` требует список всех active participants. Spine выводит temporary users в middleware/RLS/email, но не включает admin list/read model в PEP map. Если существующий admin screen показывает только Stripe subscription status, временные участницы будут невидимы операционно — особенно при failed claim или support exception.

Нужно определить unified admin access status (`recurring`, `temporary`, `VIP/manual`, expiry, claim/review state) без представления one-time grant как Stripe Subscription.

### F9 — `NFR19.1` payment-init failure отсутствует — Medium

Friendly retry-later behavior и minimization двойных списаний применимы к temporary payment path, но spine их не трассирует. Даже при Payment Link остаются failure surfaces: redirect creation/config lookup, Stripe unavailable, stale campaign mode и повторный CTA click. Требуется отдельная UI/error invariant и correlation/idempotency strategy.

### F10 — GDPR contract превращён в незакрытый approval — Medium

PRD уже содержит обязательные `NFR10–NFR13`, включая удаление данных deleted/unsubscribed user не позднее трёх месяцев. Spine откладывает retention/redaction purchaser email и exceptions целиком. Платёжные записи могут иметь отдельное statutory retention основание, но архитектура должна разделить:

- account/profile PII;
- normalized email в claim/pending records;
- Stripe identifiers и финансовые audit records;
- support exceptions.

Нужна data-classification/retention matrix с anonymization strategy; нельзя считать отсутствие решения нейтральным относительно PRD.

## Что перенесено корректно

- One-time payment не меняет Stripe Subscription и существующий recurring lifecycle — AD-1.
- Fulfillment основан на signature-verified paid webhook, а не success redirect — AD-2.
- Повторная доставка одной Session идемпотентна — AD-2.
- Нормализация identity конкретизирована как `lower(btrim(email))`, claim требует verified identity — AD-5.
- Former subscriber допускается; active/trialing исключается на управляемых app surfaces — AD-8.
- Calendar months, `Europe/Ljubljana`, half-open interval и exact-deadline denial — AD-4/AD-7.
- Cutoff возвращает recurring UI, не отзывает ранее выданные права — AD-8.
- Temporary users включены в publication recipients с preference overlay — AD-6.
- Дополнительное решение «один immutable grant на offer + normalized purchaser» не противоречит PRD и предотвращает продление повторной покупкой, но требует согласованного refund/support behavior.

## Минимальный reconciliation gate

Перед детализацией schema/API должны быть явно приняты и отражены в spine следующие решения:

1. Реальный pre-payment eligibility gate или изменение PRD-семантики direct ineligible payments.
2. Domain state до verification: pending purchase либо явно non-effective `unclaimed` record.
3. Adopted UX invariants `FR1.4.1`, независимо от финальной Slovenian copy.
4. Invitation/auth/claim/onboarding state machine и failure recovery.
5. Durable webhook failure review path для `NFR19`.
6. Exact expected commercial tuple и точный Stripe timestamp mapping.
7. Admin visibility временных участниц и exception states.
8. GDPR retention/anonymization matrix.

После этих решений spine может считаться достаточным и непротиворечивым build substrate для временного one-time предложения.
