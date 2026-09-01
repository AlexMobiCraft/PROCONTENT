# Reconciliation — sprint-change-proposal-2026-09-01

**Вход:** `sprint-change-proposal-2026-09-01.md`  
**Сверены:** `Product Scope`, FR1–FR5.1 в `prd.md`  
**Итог:** основная коммерческая политика перенесена; ниже 5 остающихся gaps, которые исходный proposal задаёт явно, а обновлённые фрагменты PRD не фиксируют либо фиксируют недостаточно проверяемо.

1. **UI/copy временного оффера не задан как проверяемый контракт.** PRD фиксирует запреты в FR1.4, но не требует единственную карточку с зачёркнутыми `€34,00` и не закрепляет словенский текст, доступное представление зачёркнутой цены, видимый focus и минимум 44×44 px. Это оставляет риск, что предложение будет формально «разовым», но UX будет содержать устаревшие pricing-элементы. Источник: proposal:97–99, 108; PRD:117, 366.

2. **Нет trust boundary для payment-mode fulfillment.** FR1.4 требует подтверждённую оплату, но не требует signed webhook, allowlist `payment_link_id`/`price_id`/metadata, `mode='payment'`, paid status, а также единого idempotent handler для async payment success. Общий NFR18 про повторы webhook не исключает выдачу доступа по чужому или неподходящему one-time платежу. Источник: proposal:50–59, 70–74, 101–102; PRD:366.

3. **Не определена единая проверка доступа во всех gates.** FR3.1 описывает expiry, однако не требует, чтобы неистекшее entitlement одинаково открывало middleware и RLS для posts/media/comments, а cache не продлевал доступ после `access_ends_at`. Следовательно, остаётся риск расхождения UI и данных или доступа после срока. Источник: proposal:80, 104–105; PRD:369.

4. **Изоляция recurring lifecycle выражена неполно.** FR5.1 говорит, что параметры действующих подписчиц не изменяются, но не запрещает one-time handler изменять `stripe_subscription_id`, `subscription_status` или `current_period_end`, а также не фиксирует сохранение старого `/api/checkout` contract для rollback. Источник: proposal:82, 100, 106–107; PRD:372.

5. **Не принято продуктовое решение об email-уведомлениях для временных участниц.** Proposal требует отдельной policy, а FR27 по-прежнему говорит об автоматических уведомлениях «участнице» без определения, входят ли в эту аудиторию временные entitlements. До решения recipient-selection остаётся двусмысленным. Источник: proposal:44, 152, 186; PRD:425.

**Покрыто без gap:** только новые покупки получают один разовый платёж 29€ на 3 календарных месяца; нет recurring/autorenewal и обещаний новых материалов; доступ привязан к оплате и тому же нормализованному email, истекает на точном `access_ends_at`; с 01.12.2026 возвращаются постоянные тарифы, а ранее выданные права продолжаются до индивидуального срока. Источник: proposal:9–18, 97–107; PRD:117, 366–372.

## Итоговая сверка после Architecture и Epic 9

**Дата сверки:** 2026-09-01  
**Статус:** findings 1–5 выше сохранены как исторические; их требуемые контракты внесены в последующие артефакты.

| Исходный finding | Актуальное покрытие | Итог |
|---|---|---|
| 1. UI/copy временного оффера | Epic 9.2, AC 4–5: одна карточка `€29,00 / 3 mesece`, семантически зачёркнутая `€34,00`, точный CTA, focus, 44×44 px и responsive contract. | Закрыт в Epic; UX-спецификация должна отразить temporary mode. |
| 2. Payment-mode fulfillment | Architecture AD-TA2–AD-TA3; Epic 9.2, AC 6–10: signed webhook, retrieved Checkout Session и server-side allowlist. | Закрыт. |
| 3. Единая проверка доступа | Architecture AD-TA6–AD-TA7; Epic 9.1, AC 7–11: canonical resolver для middleware, RLS, Storage и email с `valid_until`. | Закрыт. |
| 4. Изоляция recurring lifecycle | Architecture AD-TA1 и AD-TA9; Epic 9.2, AC 12; Epic 9.3, AC 9. | Закрыт. |
| 5. Email-аудитория временных участниц | PRD FR27; Architecture AD-TA6; Epic 9.1, AC 9. | Закрыт. |

Нерешёнными остаются только approval gates, вынесенные в `decision-register-temporary-one-time-offer-2026-09-01.md`: Stripe identifiers/config, migration и RLS/GRANT matrix, refund policy, `paid_at` semantics, VIP/admin eligibility, Slovenian copy, rollback operator, GDPR retention/redaction и security verification dependencies. Они блокируют production enablement, но не отменяют декомпозицию Epic 9.
