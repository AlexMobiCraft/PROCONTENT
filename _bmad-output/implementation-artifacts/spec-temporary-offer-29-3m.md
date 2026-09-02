---
title: 'Временное предложение €29 за 3 месяца без автопродления на лендинге'
type: 'feature'
created: '2026-09-01'
status: 'done'
review_loop_iteration: 0
context: []
baseline_commit: 'a8508f01d8e2fbaab3c0082741e0a32bba9a651e'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** На лендинге сейчас показываются два recurring-тарифа (€12,99/мес и €34,00/3 мес) с переключателем. На время акции нужно оставить единственный вариант — €29,00 за 3 месяца без автопродления, со старой ценой €34,00 зачёркнутой.

**Approach:** Ввести server-derived promo-режим, включаемый переменной окружения `STRIPE_PROMO_PRICE_ID`. При включённом режиме `PricingSection` рендерит одну карточку без radiogroup, а `/api/checkout` создаёт subscription-сессию на новой recurring-цене €29/3 мес с меткой `metadata.offer = 'promo_29_3m'`. Checkout API не умеет задавать отмену при создании, поэтому вебхук после подтверждённой оплаты проставляет подписке `cancel_at_period_end: true`. Дальше Stripe сам отменяет её через 3 месяца и присылает `customer.subscription.deleted`, который уже обрабатывается. Ни миграций БД, ни нового lifecycle не требуется.

## Boundaries & Constraints

**Always:**
- Promo-режим выводится только на сервере (`src/app/page.tsx` — RSC) и передаётся вниз пропсом. Клиентское время или кэш не могут его включить.
- Fail-closed: если `STRIPE_PROMO_PRICE_ID` не задан — лендинг показывает исходные recurring-тарифы, а `plan: 'promo'` в `/api/checkout` отвечает ошибкой.
- Существующие тарифы `monthly`/`quarterly` и их код остаются рабочими и покрытыми тестами — режим переключается только переменной окружения, без деплоя кода.
- Весь UI-текст — на словенском, поля БД — `snake_case`.

**Ask First:**
- ~~Любое изменение вебхука `src/app/api/webhooks/stripe/route.ts`~~ — **согласовано 2026-09-01**: разрешена одна аддитивная вставка в `handleCheckoutSessionCompleted`, отключающая автопродление promo-подписке. Любая другая правка вебхука по-прежнему требует согласования.
- Любое изменение логики доступа `src/lib/supabase/auth-middleware.ts`.
- Любая запись в live-аккаунт Stripe через API (цены, payment links, подписки).
- Изменение состава списка преимуществ (6 строк `features`) — по текущему решению он остаётся без изменений.

**Never:**
- Не использовать существующую разовую цену `price_1UAnWo06opmqEqpLtcIW4aqE` (`type: one_time`) — вебхук игнорирует не-subscription платежи (`route.ts:149`, `:322`), доступ не откроется.
- Не создавать Stripe Payment Link и не вести на него с лендинга.
- Не создавать таблицу entitlements, поле `access_ends_at` и cron истечения (полный вариант Epic 9.1/9.2 намеренно не реализуется).
- Не трогать подписки действующих участниц.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Promo включён, UI | `STRIPE_PROMO_PRICE_ID` задан | Одна карточка: `€29,00` + `/ 3 mesece`, зачёркнутая `€34,00`; нет radiogroup, `MESEČNO`, `€12,99`, `≈`, `Prihranek` | N/A |
| Promo выключен, UI | Переменная не задана | Прежние две карточки с переключателем | N/A |
| Promo checkout | `POST /api/checkout {plan:'promo'}` | 200 + `url`; сессия `mode:'subscription'`, price из `STRIPE_PROMO_PRICE_ID`, `metadata.offer` и `subscription_data.metadata.offer` = `promo_29_3m`, `allow_promotion_codes: false` | N/A |
| Отмена автопродления | Вебхук: `checkout.session.completed`, `metadata.offer='promo_29_3m'`, оплачено | Вызывается `stripe.subscriptions.update(subId, { cancel_at_period_end: true })`; профиль обновляется как обычно | Сбой Stripe логируется, выдача доступа не прерывается |
| Обычная подписка в вебхуке | То же событие без `metadata.offer` | `subscriptions.update` не вызывается | N/A |
| Отложенная оплата | Вебхук: `invoice.payment_succeeded`, `parent.subscription_details.metadata.offer='promo_29_3m'` | Автопродление снимается и на этом пути — доступ при отложенной оплате выдаётся именно здесь | Сбой Stripe логируется, доступ выдаётся |
| Обычное продление | `invoice.payment_succeeded` без метки | Ни `retrieve`, ни `update` — метка читается из снимка в инвойсе, без запросов к Stripe | N/A |
| Promo без конфигурации | `plan:'promo'`; переменная не задана, пустая или плейсхолдер `price_...` | 500 `{ error }`, Stripe не вызывается; лендинг остаётся на обычных тарифах | Лог `[checkout]`, тост на клиенте |
| Старые тарифы, акция выключена | `plan:'monthly' \| 'quarterly'` | Прежнее поведение без promo-полей | Прежнее |
| Старые тарифы, акция включена | `plan:'monthly' \| 'quarterly'` | 400 «Некорректный тариф» — прямой POST в обход UI не создаёт recurring-подписку | Stripe не вызывается |
| Невалидный план | `plan:'promo2'` | 400 «Некорректный тариф» | Stripe не вызывается |

</frozen-after-approval>

## Code Map

- `src/app/page.tsx` — RSC, `force-dynamic`; строка 54 рендерит `<PricingCheckoutWrapper />`; строки 25–35 уже редиректят `active`/`trialing` на `/feed`, поэтому отдельный eligibility-гейт не нужен. Здесь читаем `process.env.STRIPE_PROMO_PRICE_ID`.
- `src/features/landing/components/PricingSection.tsx` — целевой UI. `plans` (17–30), radiogroup (93–134), блок цены (83–90), features (6–13), CTA (147–163), подзаголовок `Odpoved kadar koli.` (74–76), футер `Odpoved z 1 klikom.` (160–162).
- `src/features/landing/components/PricingCheckoutWrapper.tsx` — smart container; `handleCheckout(plan)` (11), toast на ошибку (17–23).
- `src/features/landing/api/checkout.ts` — `startCheckout(plan)`, тип плана в сигнатуре (1).
- `src/app/api/checkout/route.ts` — `type Plan` (6), `isPlan` (8–10), выбор price id (35–43), `sessions.create` (53–60).
- `src/app/api/webhooks/stripe/route.ts` — `mode !== 'subscription'` → return; `!subscriptionId` → return; `customer.subscription.deleted` обрабатывается. Именно поэтому выбран subscription-режим. Правки: хелпер `disablePromoAutoRenewal` + вызовы из `handleCheckoutSessionCompleted` (переиспользует уже полученную подписку) и из `handleInvoicePaymentSucceeded` (метка из снимка в инвойсе).
- `src/lib/stripe/promoOffer.ts` — новый файл: `PROMO_OFFER_CODE` и `isPromoPriceId` — общие для страницы, checkout-роута и вебхука (вебхук не должен импортировать роут).
- `src/lib/supabase/auth-middleware.ts` — **read-only**. Доступ = `isVip || status active|trialing` (347); Stripe-fallback ищет `subscriptions.list` (237).
- `src/components/landing/PricingSection.tsx` — **мёртвый код**, нигде не импортируется. Не трогать.
- `tests/unit/app/api/checkout/route.test.ts` — паттерн мока `@/lib/stripe` через `vi.hoisted`, env в `beforeEach` (27–30).
- `tests/unit/features/landing/components/PricingSection.checkout.test.tsx` — строка 32 ожидает `monthly|quarterly`; потребует расширения под `promo`.
- `.env.example:10-15` — блок Stripe-переменных.

## Tasks & Acceptance

**Execution:**
- [x] `.env.example` — добавить `STRIPE_PROMO_PRICE_ID=price_...` с комментарием «recurring €29 / 3 мес; задан = promo-режим включён» — документируем флаг.
- [x] `src/lib/stripe/promoOffer.ts` — новый файл с `PROMO_OFFER_CODE` — общая метка для роута и вебхука.
- [x] `src/app/api/checkout/route.ts` — расширить `Plan` до `'monthly' | 'quarterly' | 'promo'`; для `promo` брать `STRIPE_PROMO_PRICE_ID`, проставить `metadata.offer` и `subscription_data.metadata.offer`, `allow_promotion_codes: false` и `custom_text.submit.message` на словенском про отсутствие автопродления — единственный источник promo-цены.
- [x] `src/app/api/webhooks/stripe/route.ts` — в `handleCheckoutSessionCompleted` после проверки активности подписки отключать автопродление promo-подписке через `subscriptions.update`, в try/catch — Checkout не умеет этого при создании.
- [x] `src/features/landing/api/checkout.ts` — расширить тип аргумента `startCheckout` — сквозная типизация.
- [x] `src/features/landing/components/PricingSection.tsx` — добавить проп `isPromoActive`; при `true` рендерить одну карточку без radiogroup, семантически зачёркнутую `€34,00` через видимый `<s>` с подписью `Namesto` (доступно без `aria-hidden`/`sr-only`, скринридер не читает цену дважды), `€29,00 / 3 mesece`, promo-варианты подзаголовка и футера, CTA вызывает `onCheckout('promo')` — целевой UI.
- [x] `src/features/landing/components/PricingCheckoutWrapper.tsx` — принять и пробросить `isPromoActive`, расширить тип плана в `handleCheckout` — smart container.
- [x] `src/app/page.tsx` — передать `isPromoActive={isPromoPriceId(process.env.STRIPE_PROMO_PRICE_ID)}` — server-derived режим.
- [x] `tests/unit/app/api/checkout/route.test.ts` — покрыть promo-строки I/O-матрицы (happy path с метками, отсутствующая переменная, отсутствие promo-полей у старых тарифов).
- [x] `tests/unit/app/api/webhooks/stripe/route.test.ts` — покрыть отмену автопродления: вызывается при метке акции, не вызывается без неё, сбой Stripe не ломает обновление профиля.
- [x] `tests/unit/features/landing/components/PricingSection.checkout.test.tsx` — покрыть оба режима UI: наличие/отсутствие radiogroup, зачёркнутая цена, аргумент `onCheckout`.

**Acceptance Criteria:**
- Given `STRIPE_PROMO_PRICE_ID` задан, when посетительница открывает `/#pricing`, then видит одну карточку `€29,00 / 3 mesece` с зачёркнутой `€34,00` и не видит ни переключателя, ни `€12,99`.
- Given promo-режим активен, when посетительница нажимает `Pridruži se zdaj`, then попадает в Stripe Checkout на подписку €29/3 мес, которая не продлевается автоматически.
- Given участница оплатила promo, when Stripe шлёт `checkout.session.completed`, then `subscription_status` становится `active` без изменений в коде вебхука.
- Given прошло 3 месяца, when Stripe отменяет подписку и шлёт `customer.subscription.deleted`, then доступ снимается существующим обработчиком.
- Given переменная удалена из окружения, when страница перерендерена, then лендинг снова показывает €12,99 и €34,00 без деплоя кода.
- Given CTA в promo-режиме, when проверяется доступность, then доступное имя `Pridruži se zdaj`, `min-h-[48px]` сохранён, фокус видим.

## Spec Change Log

### 2026-09-01 — механизм отмены автопродления

**Находка:** план опирался на `subscription_data.cancel_at_period_end` при создании Checkout-сессии. Такого поля нет ни у Checkout Sessions, ни у Payment Links (Stripe SDK v20, API `2026-02-25.clover`) — `cancel_at_period_end` существует только на `subscriptions.create/update`. Ошибка поймана `npm run typecheck` до написания тестов.

**Правка:** promo-сессия помечается `metadata.offer = 'promo_29_3m'` (и на сессии, и на подписке); вебхук после подтверждённой оплаты вызывает `subscriptions.update(subId, { cancel_at_period_end: true })`. Метка вынесена в `src/lib/stripe/promoOffer.ts`, чтобы вебхук не импортировал роут. Правка вебхука согласована с владельцем 2026-09-01, ограничение «Ask First» ослаблено точечно.

**Чего избегаем:** молчаливо оставить подписку с автопродлением — участница списала бы €29 повторно через 3 месяца, ожидая разовой покупки.

**KEEP (после первой правки):** выбор subscription-режима вместо разового платежа остаётся верным — он единственный даёт истечение доступа силами Stripe без новых таблиц; вставка в вебхуке аддитивна, закрыта проверкой метки и обёрнута в try/catch, чтобы сбой Stripe не блокировал выдачу оплаченного доступа.

### 2026-09-02 — второй путь активации доступа (по итогам ревью)

**Находка:** все три ревьюера независимо нашли одно и то же. Снятие автопродления стояло только в `handleCheckoutSessionCompleted`, а доступ выдаётся из двух мест. При отложенной оплате (банковский перевод, зависший 3DS) checkout приходит с `payment_status: 'unpaid'`, доступ открывает `handleInvoicePaymentSucceeded`, и флаг не проставлялся — участница получила бы повторное списание €29 через 3 месяца. Метка `subscription_data.metadata.offer` при этом писалась и не читалась ни одной строкой кода: она предназначалась ровно для этого пути.

**Правка:** общий хелпер `disablePromoAutoRenewal` вызывается из обоих мест. В invoice-пути метка читается из `invoice.parent.subscription_details.metadata` — это снимок метаданных подписки на момент выпуска инвойса, поэтому обычные продления распознаются без единого лишнего запроса к Stripe. Хелпер идемпотентен: при уже снятом автопродлении Stripe не дёргается. Правка вебхука согласована с владельцем 2026-09-02.

**Сопутствующие патчи ревью:** во время акции `/api/checkout` отклоняет `monthly`/`quarterly` (иначе прямой POST в обход UI создавал бы recurring-подписку, которую акция должна была убрать); `isPromoPriceId` вместо `Boolean()` — плейсхолдер `price_...` из `.env.example` включал акцию с нерабочим id; литеральное чтение `process.env` вместо динамического; `isPromoActive` сделан обязательным пропом, чтобы оборванный проброс ломал типы; лог при promo-сессии без подписки.

**Чего избегаем:** зелёной сюиты при сломанном продакшене. До правок можно было удалить проброс `isPromoActive` или инвертировать рубильник в `page.tsx` — ни один тест бы не упал, а лендинг молча вернулся бы к €34,00. Теперь это ловят типы и три новых теста.

**KEEP:** хелпер обязан оставаться идемпотентным и не прерывать выдачу доступа при сбое Stripe — оплата уже прошла. Метка проверяется и на сессии, и на подписке; убирать любую из двух проверок нельзя, они покрывают разные пути активации. Проверка `invoice.parent.subscription_details.metadata` должна оставаться до обращения к Stripe, иначе каждое обычное продление начнёт стоить лишний вызов API.

## Design Notes

**Почему подписка, а не разовый платёж.** Разовая цена €29 в Stripe уже создана (`price_1UAnWo06opmqEqpLtcIW4aqE`), но не годится: доступ в приложении держится на `subscription_status`, который ставится только из subscription-событий. Recurring-цена €29 с интервалом 3 месяца + отключённое сразу после оплаты автопродление даёт ровно требуемое поведение — одно списание, автоматическое истечение силами Stripe, ноль новых сущностей.

**Расхождение с Epic 9.2.** AC 6 требует Payment Link с `mode='payment'` и таблицу entitlements из 9.1. Владелец сознательно выбрал упрощённый путь; entitlement-архитектура остаётся нереализованной.

**Побочный эффект.** Страница оплаты Stripe покажет «€29,00 every 3 months». Смягчается через `custom_text.submit.message`, например: `Enkratno plačilo za 3 mesece dostopa. Naročnina se ne podaljša samodejno.`

**Зачёркнутая цена (a11y):**
```tsx
<s className="font-serif text-2xl text-muted-foreground" aria-hidden>€34,00</s>
<span className="sr-only">Redna cena 34,00 EUR, akcijska cena 29,00 EUR za 3 mesece</span>
```

**Внешняя предпосылка:** recurring-цену €29/3 мес владелец создаёт в дашборде Stripe сам и подставляет её id в `.env.local` и в переменные Vercel. До этого promo-режим выключен и лендинг работает по-старому.

## Verification

**Commands:**
- `npm run typecheck` — без ошибок
- `npm run lint` — без новых предупреждений
- `npm run test` — все тесты зелёные, включая новые promo-кейсы
- `npm run build` — успешная сборка

**Manual checks:**
- `npm run dev` с заданным `STRIPE_PROMO_PRICE_ID` → на `/#pricing` одна карточка, зачёркнутая `€34,00`, нет переключателя; без переменной — прежние два тарифа.
- Ширины 375 / 768 / ≥1024 px — нет горизонтального переполнения.

## Suggested Review Order

**Механизм акции**

- Точка входа: что вообще считается включённой акцией и как помечаются promo-платежи
  [`promoOffer.ts:12`](../../src/lib/stripe/promoOffer.ts#L12)

- Рубильник: единственное место, где режим выводится на сервере
  [`page.tsx:56`](../../src/app/page.tsx#L56)

**Деньги: создание сессии**

- Во время акции старые тарифы недоступны даже прямым POST в обход UI
  [`checkout/route.ts:43`](../../src/app/api/checkout/route.ts#L43)

- Литеральное чтение env вместо динамического ключа; promo — только при валидном id
  [`checkout/route.ts:49`](../../src/app/api/checkout/route.ts#L49)

- Метка кладётся и на сессию, и на подписку — её читают оба пути активации
  [`checkout/route.ts:85`](../../src/app/api/checkout/route.ts#L85)

**Деньги: отмена автопродления**

- Общий хелпер: идемпотентен, при сбое Stripe не блокирует выдачу оплаченного доступа
  [`webhooks/stripe/route.ts:144`](../../src/app/api/webhooks/stripe/route.ts#L144)

- Обычный путь: подписка переиспользуется из уже сделанного запроса
  [`webhooks/stripe/route.ts:250`](../../src/app/api/webhooks/stripe/route.ts#L250)

- Отложенная оплата: метка из снимка в инвойсе, без лишних вызовов Stripe
  [`webhooks/stripe/route.ts:397`](../../src/app/api/webhooks/stripe/route.ts#L397)

**Интерфейс**

- Тексты акции: старая цена берётся из квартального тарифа, чтобы не разъехаться
  [`PricingSection.tsx:20`](../../src/features/landing/components/PricingSection.tsx#L20)

- Проп обязателен намеренно: оборванный проброс ломает типы, а не цену на лендинге
  [`PricingSection.tsx:52`](../../src/features/landing/components/PricingSection.tsx#L52)

- Ветка одной карточки вместо переключателя тарифов
  [`PricingSection.tsx:100`](../../src/features/landing/components/PricingSection.tsx#L100)

**Тесты и конфигурация**

- Рубильник акции: включён, выключен, плейсхолдер, пробелы
  [`page.test.tsx:49`](../../tests/unit/app/page.test.tsx#L49)

- Отложенная оплата и идемпотентность отмены
  [`webhooks/stripe/route.test.ts:1385`](../../tests/unit/app/api/webhooks/stripe/route.test.ts#L1385)

- Блокировка старых тарифов и отказ на плейсхолдере
  [`checkout/route.test.ts:69`](../../tests/unit/app/api/checkout/route.test.ts#L69)

- Проводка пропа до самого вызова API
  [`PricingCheckoutWrapper.test.tsx:110`](../../tests/unit/features/landing/components/PricingCheckoutWrapper.test.tsx#L110)

- Переключатель акции для деплоя
  [`.env.example:16`](../../.env.example#L16)
