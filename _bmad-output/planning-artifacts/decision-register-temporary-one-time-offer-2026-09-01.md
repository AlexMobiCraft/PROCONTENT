# Реестр решений и сверка артефактов — временное разовое предложение

**Дата:** 2026-09-01  
**Статус:** требуется утверждение Owner/PM и Architect  
**Область:** Epic 9 — временное предложение с разовым платежом €29 за три календарных месяца доступа.

## 1. Цель сверки

Устранить расхождения между ранним `reconcile-sprint-change-proposal-2026-09-01.md`, актуальными PRD, Architecture и Epic 9 до генерации sprint tracker. Этот документ не утверждает Stripe-конфигурацию, не меняет production-настройки и не разрешает запуск предложения.

## 2. Подтверждённые решения

Следующие решения уже записаны в актуальных артефактах и не требуют нового продуктового выбора:

| Решение | Источник истины | Статус сверки |
|---|---|---|
| В окне `[2026-09-01 00:00, 2026-12-01 00:00)` в `Europe/Ljubljana` новая покупательница получает только разовый платёж €29 за три календарных месяца доступа без автопродления. | PRD: Product Scope, FR1.4–FR1.4.3; Epic 9.2 | Сверено |
| Временное право доступа — отдельный lifecycle; recurring subscription и её Stripe-поля не изменяются. | Architecture: AD-TA1; Epic 9.2, AC 12; Epic 9.3, AC 9 | Сверено |
| Доступ возникает только из подтверждённого Stripe webhook, затем claim связывает его с verified email; redirect не является источником права. | Architecture: AD-TA2–AD-TA5; Epic 9.1–9.2 | Сверено |
| Один access-state resolver обслуживает middleware, RLS, Storage и email-audience; истечение права действует на точной правой границе. | Architecture: AD-TA6–AD-TA7; Epic 9.1 | Сверено |
| Временные участницы с действующим entitlement включаются в рассылку новых постов наравне с recurring-подписчицами при включённых email preferences. | PRD: FR27; Architecture: AD-TA6; Epic 9.1 | Сверено |
| После cutoff возвращается recurring UI/checkout; ранее выданные entitlements сохраняются до индивидуального `access_ends_at`. | PRD: FR5.1; Architecture: AD-TA9; Epic 9.3 | Сверено |

## 3. Расхождения, требующие документальной правки

### 3.1. Устаревший reconciliation report

`reconcile-sprint-change-proposal-2026-09-01.md` перечисляет пять gaps как нерешённые: pricing UI/copy, payment provenance, единый access check, изоляцию recurring lifecycle и email-audience policy. На дату этой сверки они закрыты последующими Architecture и Epic 9; policy для email также внесена в PRD FR27.

**Предлагаемая правка:** сохранить первоначальные findings как исторические, но добавить в файл раздел «Итоговая сверка», который ссылается на решения из раздела 2 этого реестра. Удалять исходные findings не требуется.

### 3.2. UX-спецификация не описывает temporary mode

В `ux-design-specification.md`, раздел `PricingSection`, закреплены две recurring-карточки, selector и текст про €12,99/€34. Это baseline после cutoff, но не контракт для временного окна. Он противоречит Epic 9.2 AC 4–5, где определена одна карточка `€29,00 / 3 mesece`, семантически зачёркнутая `€34,00`, CTA `Pridruži se zdaj`, видимый focus и minimum 44×44 px.

**Предлагаемая правка:** дополнить UX-спецификацию отдельным состоянием `Temporary offer mode` с точным Slovenian copy, accessibility и responsive contract из Epic 9.2; текущий двухтарифный вариант обозначить как `Recurring baseline / after cutoff`.

### 3.3. Текущий код остаётся recurring baseline

`src/features/landing/components/PricingSection.tsx` сейчас рендерит monthly/quarterly selector и вызывает recurring checkout. Это не defect существующего recurring-флоу, но он не реализует утверждённый temporary mode Epic 9.2. До завершения Story 9.2 production temporary offer должен оставаться выключенным.

**Предлагаемая правка:** не менять этот код в рамках сверки. Реализовать server-derived mode, redirect gate и temporary UI только в Story 9.2 после утверждения настоящего реестра и approval gates ниже.

## 4. Approval gates, которые нельзя принять за Owner/PM или Architect

| ID | Решение | Ответственный | Статус до ответа |
|---|---|---|---|
| DG-1 | Утвердить отдельные test/live `payment_link_id`, `price_id`, `offer_code/version`, amount/currency/quantity и allowed payment methods. | Owner/PM + Architect | Блокирует production enablement |
| DG-2 | Утвердить migration-level схему, RLS/GRANT matrix и отсутствие self-service mutation authorization inputs. | Architect | Блокирует production enablement |
| DG-3 | Выбрать executor для возвратов (automatic или manual), SLA, communication и support ownership для duplicate/ineligible/out-of-window payments. | Owner/PM | Блокирует production enablement |
| DG-4 | Утвердить mapping qualifying Stripe event к `paid_at` и DST/month-end semantics для `Europe/Ljubljana`. | Owner/PM + Architect | Блокирует production enablement |
| DG-5 | Утвердить eligibility для VIP/admin; до решения действует fail-closed exclusion. | Owner/PM | Не блокирует разработку Story 9.2 |
| DG-6 | Утвердить Slovenian pricing, post-payment и inactive copy. | Owner/PM | Блокирует финализацию UX/production enablement |
| DG-7 | Назначить rollback operator, способ деактивации Payment Link, evidence и fallback на cutoff. | Owner/Operations | Блокирует production enablement |
| DG-8 | Утвердить GDPR retention/redaction для purchaser email, unclaimed entitlements и exception audit. | Owner/Legal/Data | Блокирует production enablement |
| DG-9 | Перед implementation/launch перепроверить official advisories и обновить Next.js до актуального patched Active LTS; текущая версия в `package.json` — `16.1.6`. | Owner/DEV/Security | Блокирует production enablement |

## 5. Рекомендованный маршрут

**Выбранный подход: прямое уточнение существующих артефактов, без rollback и без изменения MVP.**

1. Утвердить этот реестр и назначить владельцев DG-1…DG-9.
2. Добавить итоговый раздел в reconciliation report и temporary-mode контракт в UX-спецификацию.
3. **Решение Owner, 2026-09-01:** выполнить Epic 9 раньше Epic 8. Последовательность Epic 9 остаётся 9.1 → 9.2 → 9.3; Epic 8 отложен без изменения его требований.
4. В `sprint-status.yaml` Epic 9 переведён в `in-progress`, Story 9.1 — в `ready-for-dev`; Epic 8 и его Story 8.1–8.4 переведены в `backlog`.
5. Перед production enablement пройти отдельный go/no-go по всем DG-1…DG-9 и Epic 9.3 AC 11–14.

## 6. Handoff

- **Owner/PM:** DG-1, DG-3, DG-4, DG-5, DG-6; подтверждает product/commercial policy.
- **Architect:** DG-1, DG-2, DG-4; подтверждает trust boundaries и schema/RLS design.
- **Owner/Operations:** DG-7; подтверждает rollback runbook.
- **Owner/Legal/Data:** DG-8; подтверждает data-retention policy.
- **DEV/Security:** DG-9 и последующая реализация Epic 9 после утверждений.

## 7. Критерии завершения сверки

- [ ] Owner/PM и Architect подтвердили, что раздел 2 — актуальный source of truth.
- [ ] Для DG-1…DG-9 есть решение, владелец или формально принятый blocking status.
- [ ] `reconcile-sprint-change-proposal-2026-09-01.md` дополнен итоговой сверкой.
- [ ] `ux-design-specification.md` различает temporary mode и recurring baseline.
- [ ] После документальных правок `sprint-status.yaml` сгенерирован из `epics.md` без удаления несогласованных записей.
