# Sprint Change Proposal — временное разовое предложение на 3 месяца

**Дата:** 2026-09-01  
**Статус:** предложение; не утверждено, реализация не начата  
**Триггер:** декрет автора; нужно на время приостановить продажу recurring-подписок новым пользователям, сохранив действующих подписчиков без изменений.

## 1. Краткое описание и границы

С 01.09.2026 на `procontent.si` для **новых покупок** предлагается только один вариант: разовый платеж **€29,00 за доступ на 3 месяца**, с зачеркнутой прежней ценой **€34,00**. Повторяющихся платежей, автопродления, выбора `MESEČNO`, расчета «в месяц» и обещания новых материалов 3–4 раза в неделю нет.

Период публичного предложения: **[2026-09-01 00:00, 2026-12-01 00:00) Europe/Ljubljana**. Дата возврата — **01.12.2026**, то есть ровно через три календарных месяца. У пользователя, оплатившего в период действия предложения, доступ длится три календарных месяца от подтвержденной оплаты; окончание предложения не сокращает уже выданный доступ.

Не входит в change:

- отмена, миграция, изменение цены, периода или автопродления любой существующей Stripe subscription;
- редактирование существующих Stripe Price/Payment Link для recurring-тарифов;
- выдача доступа только по редиректу Stripe или только по клиентскому времени;
- изменение кода, Stripe, Supabase, PRD, epics, stories или `sprint-status.yaml` до отдельного утверждения.

## 2. Доказательства и impact analysis

### Триггер и текущая модель

| Область | Факт | Последствие |
|---|---|---|
| PRD / Epic 1 | FR1 фиксирует только €12,99/месяц и €34/3 месяца как Stripe-подписки; FR2–FR5 и Journey 1 предполагают renewal/cancellation. | Нужна временная product-оговорка, а не подмена исходных FR навсегда. |
| Pricing UI | `PricingSection` показывает переключатель `monthly` / `quarterly`, `€12,99`, `€34`, «≈ €11,33 / mes.», «Prihranek €4,97», «Izobraževalne vsebine 3-4x na teden» и CTA через `onCheckout(plan)`. | Изменяется контент, interaction model и назначение CTA; требуется один вариант без radiogroup. |
| Checkout | `/api/checkout` принимает только `monthly|quarterly`, выбирает recurring Price и всегда создает Checkout Session с `mode: 'subscription'`. | Его нельзя использовать для разового Payment Link без явного отдельного пути; текущие recurring-тарифы должны остаться неизменны. |
| Webhook | `checkout.session.completed` намеренно выходит, когда `session.mode !== 'subscription'`. | Новый `mode: 'payment'` сейчас не создает доступ; нужен изолированный idempotent fulfillment. |
| Auth / middleware | `/auth/confirm` и fallback на `/inactive` ищут только активные/триальные Stripe subscriptions. `auth-middleware` разрешает доступ по `is_vip` или `subscription_status in ('active','trialing')`. | Разовая покупка не пройдет onboarding и gate. Нельзя решать это записью `subscription_status='active'`: это смешает независимые lifecycle и не даст безопасного истечения. |
| Supabase RLS | `is_active_subscriber()` также разрешает только VIP либо `active/trialing`. | Одной правки middleware недостаточно: иначе UI пропустит, а RLS вернет пустые данные. |
| Stripe / Payment Links | Payment Link можно деактивировать; Link создает Checkout Session и metadata Link наследуется Session. Stripe требует server-side, idempotent fulfillment по webhook; при delayed payment methods нужен `checkout.session.async_payment_succeeded`. | Уже созданный one-time Price/Payment Link должен быть идентифицирован по Link ID/Price ID и metadata; завершение и rollback должны быть управляемыми. |

### Влияние на артефакты

**PRD.** MVP не отменяется, но FR1–FR5 и Journey 1 становятся временно неточными. После утверждения добавить отдельный раздел «Временное коммерческое исключение 01.09–01.12.2026»: новое предложение относится только к новым покупкам, а существующие recurring subscriptions сохраняют весь исходный контракт. Добавить определение `time-limited one-time entitlement` и правило доступа/истечения.

**Epics.** Epic 1 уже `done`, поэтому не следует ретроактивно менять завершенные Stories 1.4/1.5. Добавить новый изолированный **Epic 9** после Epic 8; его первая история расширяет access model, но не изменяет завершенные AC существующих recurring flows.

**Architecture.** Нужны явные компоненты: `temporary offer configuration`, `one-time entitlement fulfillment`, `entitlement claim during verified onboarding`, единый access predicate для Edge middleware, RLS и recipient-selection. Existing Stripe subscription поля остаются source of truth только для recurring subscriptions.

**UX.** Pricing screen переходит от выбора плана к одной карточке. Должны измениться post-payment journey, inactive state и copy: без обещания частоты новых материалов и без ложного «Odpoved z 1 klikom». На desktop сохраняются keyboard/focus requirements, на mobile — минимум 44×44 px и отсутствие горизонтального переполнения.

**Остальные поверхности.** Нужны тесты checkout/link routing, webhook, `/auth/confirm`, middleware, RLS и e2e. Выборка адресатов новых-постов должна быть отдельно проверена: включать ли временных участников в email — продуктовое решение, которое нельзя неявно наследовать из текущего фильтра `subscription_status`.

## 3. Рекомендуемый безопасный дизайн

### 3.1. Изоляция предложений и Stripe configuration

Использовать уже созданный Owner разовый Stripe-объект €29,00 и зафиксировать его идентификаторы в закрытом runbook/config. Не создавать и не менять recurring-объекты Stripe. До реализации подтвердить, что существующий объект соответствует следующим условиям:

- отдельный one-time Price: `€29.00 EUR`, `recurring` отсутствует;
- отдельный Payment Link с `mode=payment`, ровно одной quantity, без trial и без subscription;
- Link metadata: `offer_code=temporary_archive_access_2026_09`, `access_months=3`, `offer_version=2026-09`; backend также allowlist-ит точные `payment_link_id` и `price_id` из server config;
- redirect после оплаты на существующий безопасный onboarding/register entry point с `{CHECKOUT_SESSION_ID}`;
- отдельные test и live Link/Price IDs и URL; test IDs никогда не попадают в production config;
- CTA ведет через короткий server-side time gate к этому Link. Gate разрешает редирект только в заданном окне; URL Link остается внешним Stripe URL, но приложение не отдает его после окончания предложения.

Причина time gate: один только UI не защищает от старой вкладки/закэшированного JS. В момент rollback дополнительно деактивируется Payment Link в Stripe, поэтому сохраненный прямой Link также больше не принимает оплату.

### 3.2. Модель entitlement — отдельная от subscriptions

Добавить таблицу уровня доступа, например `access_entitlements`, со следующими минимальными полями:

- `id`, `user_id nullable -> auth.users(id)`, `source`, `status`;
- `stripe_checkout_session_id unique`, `stripe_payment_intent_id unique nullable`, `stripe_customer_id nullable`, `stripe_payment_link_id`;
- нормализованный `purchaser_email`, `paid_at`, `access_starts_at`, `access_ends_at`, `claimed_at`, `revoked_at`, `created_at`;
- immutable audit attribution: `offer_code`, `price_id`, `currency`, `amount_total`.

Создать entitlement может только service role webhook. `access_ends_at` рассчитывается на сервере/в PostgreSQL как `paid_at + interval '3 months'`, не как `90 days`; доступ действует при `access_starts_at <= now() AND now() < access_ends_at AND revoked_at IS NULL`.

Webhook получает Payment Link Session, проверяет signature, `mode='payment'`, `payment_status='paid'`, allowlisted Link/Price/metadata и только затем делает idempotent insert/upsert по Checkout Session ID. Неизвестный разовый платеж не должен менять `profiles` и не должен активировать доступ.

Для delayed payment methods обработать оба триггера как один `fulfillTemporaryOffer(sessionId)`: `checkout.session.completed` только при `payment_status='paid'`, а при асинхронном успехе — `checkout.session.async_payment_succeeded`. Общая транзакционная операция должна быть безопасна при retry и параллельной доставке.

### 3.3. Связь с аккаунтом и единый access predicate

После подтверждения Supabase email пользователь получает entitlement только при точном нормализованном совпадении подтвержденного `auth.users.email` с `purchaser_email`. Claim выполняется серверно и атомарно, один entitlement не может быть присоединен к двум `user_id`. Покупатель без аккаунта сначала получает запись entitlement, затем проходит обычную верификацию email; покупатель с существующим verified account может claim-нуть соответствующую неоплаченную запись после login/confirm. `session_id` в redirect — указатель для UX, не единственное доказательство права.

Ввести один DB predicate, например `has_active_content_access()`, который возвращает true для admin, VIP, `subscription_status in ('active','trialing')` **или** неистекшего claimed entitlement. Этот predicate применяется в RLS; middleware использует тот же критерий, а не дублирующую business logic. Cache-token должен содержать защищенный deadline entitlement или обходиться до него, чтобы cache не продлевал доступ после `access_ends_at`.

Не менять `stripe_subscription_id`, `subscription_status` и `current_period_end` при обработке временного разового платежа. Subscription webhooks продолжают обрабатывать только subscriptions. Это сохраняет pricing, billing period, portal и auto-renewal всех действующих подписчиков.

## 4. Предлагаемый Epic 9 и isolated story

**Epic 9: Временное предложение и ограниченный по сроку разовый доступ**  
**Story 9.1: Временный разовый доступ к архиву на 3 месяца (01.09–01.12.2026)**  
**Расположение:** новый Epic 9 после Epic 8; статус при утверждении: `backlog`.  
**Классификация:** **Major** по change-management (меняется security/access architecture и внешняя payment integration), хотя delivery ограничен одной изолированной story. Нужны совместные approval PM/Owner + Architect до начала и DEV после него.

**User story:**

> As a новая посетительница, I want один раз оплатить €29,00 и получить доступ к существующей базе на три календарных месяца, so that я не оформляю recurring subscription во время временного предложения.

### Acceptance Criteria

1. **Время и конфигурация.** При server time `2026-09-01T00:00:00+02:00 <= now < 2026-12-01T00:00:00+01:00` лендинг показывает ровно один вариант; вне окна — исходные two recurring plans. Time zone и границы проверяются автоматизированно.
2. **UI и copy.** Карточка показывает `€29,00 / 3 mesece`, `€34,00` зачеркнутой, не содержит `MESEČNO`, `€12,99`, «/ mesec», «≈», `Prihranek`, «Odpoved ...» и `Izobraževalne vsebine 3-4x na teden`. Вместо последнего допустимая строка: `Dostop do obstoječe baze znanja za 3 mesece.`
3. **CTA.** `Pridruži se zdaj` ведет только к allowlisted new Stripe Payment Link; Network/Stripe Session подтверждает `mode='payment'`, один item €29.00 EUR и отсутствие subscription / recurring / auto-renewal.
4. **Разделение с existing plans.** `/api/checkout` и его `monthly|quarterly` contract остаются функционально прежними для rollback. Обработчик разовой оплаты не создает, не обновляет и не отменяет Stripe Subscription.
5. **Webhook validation.** Только signed Stripe event с подходящими `payment_link_id`, `price_id`, metadata, `mode='payment'` и paid status создает entitlement. Неверный Link/Price/mode/status не выдает доступ и логируется с безопасным event/session context.
6. **Idempotency.** Повтор и параллельная доставка одного Session ID создают максимум одну entitlement запись и не продлевают `access_ends_at`.
7. **Onboarding claim.** Новой покупательнице без аккаунта после подтверждения того же email создается/claim-ится entitlement и открывается onboarding. Несовпадающий email, неоплаченная сессия, чужой/повторно claimed Session ID не дают доступ.
8. **Дата окончания.** Entitlement, оплаченный в `paid_at`, заканчивается ровно через `interval '3 months'`; `now() == access_ends_at` уже не дает доступа. Cache и RLS не позволяют продлить этот доступ.
9. **Все gates.** Неистекший entitlement разрешает middleware и RLS к posts/media/comments; истекший запрещает оба пути. Действующие `active`, `trialing`, VIP и admin сохраняют текущий доступ.
10. **Existing subscribers.** Regression fixtures подтверждают неизменность их Stripe customer/subscription IDs, `subscription_status`, `current_period_end`, price, billing interval и `cancel_at_period_end`; temporal-offer handler к ним не пишет.
11. **Post-offer rollback.** С `2026-12-01T00:00:00+01:00` public UI возвращает €12,99/месяц и €34,00/3 месяца, старый checkout path и тексты; app gate больше не редиректит на temporary Link, а этот Link деактивирован в Stripe. Ранее созданные entitlements остаются валидными до своего `access_ends_at`.
12. **Accessibility/responsiveness.** На 375px и desktop CTA имеет доступное имя `Pridruži se zdaj`, keyboard focus видим, touch target не меньше 44×44 px, зачеркнутая цена доступна семантически, а visual change не зависит только от цвета.

## 5. Изменения артефактов после approval (old → new)

Это предложения к будущему утвержденному change; в рамках данного документа ни один исходный артефакт не изменен.

### PRD — Product Scope и FR1–FR5

**OLD:** `Stripe-подписка (12,99€/мес и 34€/3 мес) с автоотключением`; FR1 описывает только два recurring плана.

**NEW:** сохранить исходный текст как постоянный baseline и добавить time-boxed exception: «с 01.09.2026 до 01.12.2026 для новых покупок доступен только разовый €29.00 платеж за 3 календарных месяца доступа к существующей базе; без автопродления. Действующие recurring subscriptions не изменяются. С 01.12.2026 исходные планы и copy возвращаются». Добавить FR1.4 (one-time entitlement), FR3.1 (expiry), FR5.1 (отсутствие изменения existing subscriptions).

**Rationale:** ограничение временное, но реализация должна быть формально задана и проверяема.

### Architecture — Stripe/Auth/RLS integration

**OLD:** access source — active/trialing Stripe subscription или VIP; Checkout webhook обрабатывает subscription mode.

**NEW:** отдельный payment-mode fulfillment и `access_entitlements`; единый time-aware predicate применяется в RLS и middleware; verified-email claim; старые subscription fields/handlers остаются dedicated recurring domain.

**Rationale:** исключает смешивание billing lifecycle и one-time access, закрывает RLS/middleware parity.

### UX — Pricing и post-payment flow

**OLD:** radiogroup из `Mesečno` и `3 mesece`, per-month math, saving, promise регулярного нового контента, cancellation copy.

**NEW:** одна карточка и copy из AC2; success redirect объясняет доступ к существующей базе, email verification/claim, дату истечения доступа и отсутствие автопродления. На rollback возвращается исходная двухтарифная interaction model.

**Rationale:** предложения и ожидания покупателя не расходятся.

### Epic 9 / tracker

**OLD:** Epic 1 и Stories 1.4/1.5 — `done`; последняя существующая история — Story 8.4.

**NEW:** добавить Epic 9 и Story 9.1 как `backlog` только после approval; не переписывать completed stories. В `sprint-status.yaml` добавить epic entry и `9-1-temporary-one-time-archive-access: backlog` после утверждения proposal.

**Rationale:** сохранение истории выполненной работы и минимальная, ревьюируемая очередь.

## 6. Launch и rollback runbook

### До test validation

1. Owner передает DEV идентификаторы уже созданного live Price/Payment Link €29,00 для read-only верификации. Для test-mode используется отдельный тестовый эквивалент только при его наличии и с теми же metadata/redirect; создание Stripe-объектов этим proposal не предполагается.
2. DEV реализует за feature flag/config, с отдельными test/live allowlists; секреты остаются server-only.
3. PM/Owner утверждает словенский copy, opt-in email-notification policy и точные Link IDs; Architect утверждает schema/RLS/access predicate.

### Test mode verification

- Stripe CLI/Dashboard: valid paid event, duplicate delivery, invalid signature, wrong mode/price/link, `unpaid`, async success, delayed failure.
- DB: одна запись на Session ID, audit fields корректны, atomic claim, expiry для дат 30/31 числа и DST, повтор claim невозможен.
- App/RLS: access до конца срока; отказ на точном deadline; subscriber/VIP/admin unaffected; no writes в subscription fields от one-time handler.
- UI: 375px Android Chrome, iOS Safari, 768px и ≥1024px; keyboard/axe/Lighthouse для pricing; network failure не дублирует переход/оплату.
- Recurring regression: current `/api/checkout` monthly/quarterly tests и subscription webhook suite остаются зелеными.

### Live launch — 01.09.2026

1. Снять immutable screenshot/экспорт current recurring Price IDs, Link IDs и sample subscription state; это контроль, а не mutation.
2. Read-only проверить уже созданный **live** one-time Price/Link: `mode=payment`, €29.00, metadata, redirect и отсутствие recurring fields.
3. Deploy app config/code, затем выполнить одну controlled real/test-live purchase по согласованному process; сверить Stripe event, DB entitlement, verified-email claim, RLS и audit log.
4. Наблюдать webhook failures, unmatched entitlements и checkout conversion без логирования секретов/полных платежных данных.

### Rollback — 01.12.2026

1. До `00:00 Europe/Ljubljana` подготовить возврат original pricing config/copy и проверить в preview.
2. В `00:00` переключить app gate/UI на baseline €12,99/месяц и €34,00/3 месяца; smoke test, что CTA использует original `/api/checkout` recurring flow.
3. Деактивировать temporary Payment Link в Stripe и записать ID/timestamp в runbook. Не менять ни одной existing subscription.
4. Проверить: старый Link недоступен, existing subscriptions неизменны, а ранее выданные entitlements продолжают работать до своего individual `access_ends_at` и затем истекают.
5. Сохранить entitlement/audit записи для support/reconciliation; не удалять и не «конвертировать» их в subscriptions.

## 7. Оценка путей и handoff

| Вариант | Оценка | Решение |
|---|---|---|
| 1. Только подменить CTA/UI | Нежизнеспособен: payment-mode Session игнорируется, access не истекает и RLS не пропустит пользователя. | Отклонить. |
| 2. Пометить разовую оплату как `subscription_status='active'` | Нежизнеспособен: смешивает источники истины, не дает точного expiry и рискует existing recurring lifecycle. | Отклонить. |
| 3. Новая isolated Story с payment-mode entitlement и scheduled rollback | Средняя реализация, высокий security/payment risk, но узкие границы и обратимость. | Рекомендовать. |
| 4. Откатить completed Stories 1.4/1.5 | Высокая стоимость, не снижает риск. | Не требуется. |

**Рекомендуемый путь:** вариант 3. Scope — **Major change**; handoff: Owner/PM утверждает коммерческую политику, Slovene copy и email policy; Architect утверждает entitlement schema, RLS и identity claim; DEV реализует Story 9.1 с тестами; QA/Owner проходит Stripe test/live и rollback checklist. Оценка разработки: medium; операционный риск: high до прохождения Stripe/RLS verification, после — controlled.

## 8. Checklist status

- [x] Триггер, срок и business constraints определены.
- [x] Impact проанализирован для PRD, Epic 1, architecture, UX, Stripe/Supabase flow.
- [x] Direct UI-only и subscription-status варианты отклонены с доказательством.
- [x] Выбраны новый Epic 9, изолированная Story 9.1 и конфигурационный rollback.
- [x] Acceptance criteria и test/live verification plan сформулированы.
- [!] Нужны явные approval Owner/PM и Architect перед изменением документации, tracker, Stripe, Supabase или кода.
- [N/A] Изменение существующих subscriptions — запрещено данным change.
