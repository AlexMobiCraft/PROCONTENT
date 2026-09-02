---
title: 'Письмо со ссылкой на регистрацию после оплаты + корректный финал регистрации'
type: 'bugfix'
created: '2026-09-02'
status: 'done'
review_loop_iteration: 0
context: []
baseline_commit: '1bb66b4afa03ca5ce91d29493bf1909709928518'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Единственный путь от оплаты к аккаунту — redirect на `success_url` → `/register?session_id=…`. Писем после оплаты система не шлёт вообще. 2026-09-02 `lauramaja.stevanovic@icloud.com` оплатила €29 (`cs_live_a1QDjY…`, `sub_1UB8UZ…`, paid/active), закрыла вкладку и осталась без аккаунта и без единого уведомления. Параллельно `RegisterContainer` после `signUp` показывает «Potrditveno sporočilo je bilo poslano…», хотя на боевом GoTrue стоит `ENABLE_EMAIL_AUTOCONFIRM=true` — письма не будет никогда, а пользовательница уже залогинена и застревает на этом экране (так вышло с `klara.zupanc.1@gmail.com`, разблокировалась через восстановление пароля).

**Approach:** Вебхук `checkout.session.completed` после подтверждённой оплаты проверяет, есть ли плательщица в `auth.users`, и если нет — шлёт через Resend письмо со ссылкой `{siteUrl}/register?session_id={session.id}` (Stripe-сессия читается бессрочно, ссылка не протухает). `RegisterContainer` вместо ложного «проверьте почту» ориентируется на наличие сессии: есть → редирект в `/onboarding`, нет → сообщение о письме. `NEXT_PUBLIC_SITE_URL` переводится на канонический `https://www.procontent.si`, чтобы ссылка в письме не шла через апекс-редирект.

## Boundaries & Constraints

**Always:**
- Письмо шлётся только при `mode === 'subscription'` и подтверждённой оплате, и только если плательщицы нет в `auth.users` (RPC `get_auth_user_id_by_email`) и нет `client_reference_id`.
- Сбой отправки письма НЕ роняет вебхук: `catch` + `console.error`, ответ Stripe остаётся 200. Выдача доступа важнее письма.
- Дедупликации писем нет намеренно — повторная доставка события Stripe должна повторно слать письмо, это штатный способ добить уже оплативших клиенток.
- Весь текст письма и UI — на словенском, поля БД — `snake_case`, дизайн письма — как `src/lib/email/templates/new-post.ts`.
- Существующая логика привязки профиля (шаги 0/1/2, email-spoofing guard, VIP, promo-автопродление) остаётся без изменений.

**Ask First:**
- Изменение `NEXT_PUBLIC_SITE_URL` в Vercel Project Settings (боевое окружение) — в репозитории правки делаются, применение на Vercel только после явного согласия.
- Любая правка `src/lib/supabase/auth-middleware.ts` или логики доступа.
- Любая запись в live-аккаунт Stripe помимо уже существующей `subscriptions.update`.

**Never:**
- Не отключать `ENABLE_EMAIL_AUTOCONFIRM` на боевом GoTrue и не менять серверный стек — фикс живёт в приложении.
- Не слать письмо действующим участницам (нашлась в `auth.users`) и не слать при неоплаченной сессии.
- Не заводить аккаунт за клиентку из вебхука (`auth.admin.createUser` / `inviteUserByEmail`) — она сама задаёт пароль на `/register`.
- Не трогать `success_url`/`cancel_url` в `src/app/api/checkout/route.ts` и не вводить новых env-переменных.
- Не изменять существующие рассылки — `src/lib/email/templates/new-post.ts`, `new-comment.ts`, `src/lib/notifications/sendNewPostNotification.ts`, `sendNewCommentNotification.ts`, `src/lib/email/index.ts`. Они работают исправно и используются только как READ-ONLY образцы структуры. Ни один из них не появляется в списке Execution.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Новая клиентка оплатила | `checkout.session.completed`, mode=subscription, paid, email не найден в `auth.users` | Письмо на `customer_details.email` со ссылкой `{siteUrl}/register?session_id={id}` | N/A |
| Действующая участница продлилась | то же, но email найден в `auth.users` | Письмо не отправляется, привязка профиля идёт как раньше | N/A |
| Оплата не подтверждена | `payment_status = 'unpaid'` | Письма нет; IDs привязываются как раньше | N/A |
| Разовый платёж | `mode !== 'subscription'` | Ранний выход, письма нет | N/A |
| Resend недоступен / нет `RESEND_API_KEY` | отправка бросает | Вебхук отвечает 200, в логах `[webhook] Не удалось отправить приглашение…` | catch внутри вебхука |
| Нет email в сессии | `customer_details.email` пуст | Письма нет, существующий `console.error` сохраняется | N/A |
| Регистрация при autoconfirm | `signUp` вернул `data.session` | Профиль обновлён, редирект на `/onboarding` | ошибка update → инлайн-текст, без редиректа |
| Регистрация без autoconfirm | `signUp` вернул user без session | Сообщение «Potrditveno sporočilo je bilo poslano…», редиректа нет | N/A |

</frozen-after-approval>

## Code Map

- `src/app/api/webhooks/stripe/route.ts` -- `handleCheckoutSessionCompleted` (:171). Точка вставки — сразу после promo-блока (:250-260) и до `applyVipRevocation` (:264): ниже начинаются ветки с ранними `return` (:289, :313, :335). Готовые локальные значения: `email` (:175), `customerId`, `subscriptionId`, `paymentStatus` (:203), `updateData.subscription_status` (:205), `session.client_reference_id` (:271). RPC-поиск пользователя по email — образец на :320-329. `disablePromoAutoRenewal` (:144) — образец «сбой не ломает вебхук».
- `src/lib/notifications/sendNewCommentNotification.ts` -- READ-ONLY, не изменять. Эталон модуля отправки одного письма: env-guard вне try/catch (:55), нормализация `siteUrl` (`replace(/\/+$/, '')`, :99), срезание `\r\n` из подставляемых строк (:102), возврат `sendEmailBatch([message])`.
- `src/lib/email/index.ts` -- READ-ONLY, не изменять. `sendEmailBatch(messages)`, интерфейс `EmailMessage {to, subject, html, text}`; бросает при отсутствии `RESEND_API_KEY` / `RESEND_FROM_EMAIL`.
- `src/lib/email/templates/new-post.ts` -- READ-ONLY, не изменять. Эталон вёрстки: сигнатура `generate*Html/Text`, приватные `escapeHtml` (:112) и `sanitizeHref` (:126) — они локальные в каждом шаблоне, новый файл заводит свои копии (третья копия; общий модуль не выносим — вне скоупа).
- `src/features/auth/components/RegisterContainer.tsx` -- `handleRegisterSubmit`: `signUp` (:33), update профиля (:44-48), ложное сообщение (:57), недостижимая ветка `router.push('/feed')` (:61). Здесь же — правка на `data.session`.
- `src/features/auth/api/auth.ts` -- `signUp` уже задаёт `emailRedirectTo` с `next=/onboarding`; редирект после autoconfirm должен вести туда же.
- `src/lib/app-routes.ts` -- `ONBOARDING_PATH` (:5); `/register` уже в `PUBLIC_PATHS` (:14) — прокси-правки не нужны.
- `.env.local`, `.env.vercel.prod`, `.env.example` -- `NEXT_PUBLIC_SITE_URL`; на боевом Vercel сейчас апекс `https://procontent.si`, канонический — `https://www.procontent.si`.
- `tests/unit/app/api/webhooks/stripe/route.test.ts` -- 1446 строк, `vi.hoisted` моки `@/lib/stripe` и `@supabase/supabase-js` (`mockRpc`, `mockUpdate`, `mockFrom`); сюда добавляются кейсы письма.
- `tests/unit/lib/notifications/sendNewPostNotification.test.ts` -- образец мока `@/lib/email`.

## Tasks & Acceptance

**Execution:**
- [x] `src/lib/email/templates/registration-invite.ts` -- создать `generateRegistrationInviteEmailHtml/Text` с полем `registerUrl` (+ опциональный `recipientName`) -- письмо должно быть в дизайне клуба и на словенском, как остальные рассылки.
- [x] `src/lib/notifications/sendRegistrationInvite.ts` -- создать `sendRegistrationInvite({ email, sessionId, recipientName? })`: env-guard `NEXT_PUBLIC_SITE_URL` вне try/catch, сборка `{siteUrl}/register?session_id={sessionId}`, `sendEmailBatch([message])` -- изолирует отправку от вебхука и делает её тестируемой отдельно.
- [x] `src/app/api/webhooks/stripe/route.ts` -- после promo-блока вызвать отправку при `subscription` + подтверждённой оплате + отсутствии `client_reference_id` + отсутствии пользователя в `auth.users` по email; всю отправку обернуть в try/catch с `console.error` -- согласованная аддитивная вставка, не затрагивающая привязку профиля.
- [x] `src/features/auth/components/RegisterContainer.tsx` -- ветвление по `data.session`: есть → `router.push(ONBOARDING_PATH)` после сохранения профиля, нет → прежнее сообщение о письме; удалить недостижимый `router.push('/feed')` -- убирает тупик, в котором застревают зарегистрировавшиеся.
- [x] `.env.local`, `.env.vercel.prod`, `.env.example` -- перевести `NEXT_PUBLIC_SITE_URL` на `https://www.procontent.si` (в `.env.example` — на www-форму плейсхолдера) -- ссылка в письме не должна идти через апекс→www редирект.
- [x] `tests/unit/lib/notifications/sendRegistrationInvite.test.ts` -- покрыть сборку URL, отсутствие env, передачу в `sendEmailBatch`.
- [x] `tests/unit/app/api/webhooks/stripe/route.test.ts` -- добавить кейсы матрицы: новая клиентка → письмо; существующий пользователь → без письма; unpaid → без письма; падение отправки → 200.
- [x] `tests/unit/features/auth/components/RegisterContainer.test.tsx` -- создать: с сессией → редирект на `/onboarding`; без сессии → текст про письмо; ошибка update профиля → инлайн-ошибка без редиректа.

**Acceptance Criteria:**
- Given оплаченная promo-сессия незнакомого системе email, when Stripe доставляет `checkout.session.completed`, then `sendEmailBatch` вызван ровно один раз с адресом плательщицы и ссылкой на `https://www.procontent.si/register?session_id=…`, а профильная привязка отрабатывает как прежде.
- Given отправка письма бросает исключение, when вебхук обрабатывает событие, then ответ 200 и в логах `[webhook]`-ошибка, Stripe не уходит в retry.
- Given `npm run test`, `npm run lint`, `npm run typecheck`, when прогнаны на ветке, then все три зелёные.

## Design Notes

Вставка в вебхуке ставится до веток с ранними `return`, иначе клиентки без `client_reference_id` (а его не задаёт ни один наш checkout) не получат письмо на пути «профиль найден по customer_id».

**Уточнено при реализации:** планировалось сделать отдельный RPC-вызов для проверки «нет в `auth.users`», приняв лишний запрос. На практике это дало бы два одинаковых RPC на одном пути и сломало бы существующую гарантию теста «ранний выход не делает lookup». Вместо этого поиск поднят из шага 2 наверх и выполняется ровно один раз, а шаг 2 переиспользует результат (`authUserId`). Обработка ошибки RPC осталась прежней — `throw` (Stripe уходит в retry); в `try/catch` завёрнута только отправка письма.

```ts
// src/app/api/webhooks/stripe/route.ts — после promo-блока
const clientReferenceId = session.client_reference_id
let authUserId: string | null = null
if (!clientReferenceId && email) {
  const { data: foundUserId, error } = await supabase.rpc('get_auth_user_id_by_email', { p_email: email })
  if (error) throw new Error(`[webhook] Ошибка поиска пользователя в auth.users: ${error.message}`)
  authUserId = foundUserId
}

if (updateData.subscription_status === 'active' && email && !clientReferenceId && !authUserId) {
  try {
    await sendRegistrationInvite({ email, sessionId: session.id, recipientName: session.customer_details?.name ?? null })
  } catch (error) {
    console.error('[webhook] Не удалось отправить приглашение на регистрацию:', session.id, error)
  }
}
```

## Verification

**Commands:**
- `npm run test` -- expected: все тесты зелёные, включая три новых блока
- `npm run lint` -- expected: без ошибок
- `npm run typecheck` -- expected: без ошибок

**Manual checks (if no CLI):**
- После деплоя: в Vercel Project Settings `NEXT_PUBLIC_SITE_URL = https://www.procontent.si` (применяется после согласия — см. Ask First), затем redeploy, иначе значение не подхватится.
- Добить `lauramaja.stevanovic@icloud.com` общим механизмом: Stripe Dashboard → Events → событие `checkout.session.completed` для `cs_live_a1QDjYc0RnW4U7jRanSqGlkCG0idOur7ifHzaz2xRhU2ijpQCciyqOlhDI` → Resend (или `stripe events resend <evt_id>`). Ожидаемо: письмо ушло, `sub_1UB8UZ…` не изменилась, доступ откроется после того, как она задаст пароль на `/register`.

## Suggested Review Order

**Решение об отправке письма (вебхук)**

- Точка входа: поиск в `auth.users` поднят выше ранних `return` и больше не бросает здесь.
  [`route.ts:268`](../../src/app/api/webhooks/stripe/route.ts#L268)

- Условие отправки: только оплаченная подписка, только незнакомый системе email.
  [`route.ts:294`](../../src/app/api/webhooks/stripe/route.ts#L294)

- Разбор результата: `sendEmailBatch` не бросает на отказе Resend — ловим `failed`/`skipped`.
  [`route.ts:310`](../../src/app/api/webhooks/stripe/route.ts#L310)

- Отложенный `throw`: сбой поиска валит обработку только там, где результат обязателен.
  [`route.ts:392`](../../src/app/api/webhooks/stripe/route.ts#L392)

**Письмо**

- Сборка ссылки и контракт отправки; имя из Stripe обрезается по длине.
  [`sendRegistrationInvite.ts:63`](../../src/lib/notifications/sendRegistrationInvite.ts#L63)

- Guard схемы URL: без него `sanitizeHref` тихо отдал бы письмо с мёртвой кнопкой.
  [`sendRegistrationInvite.ts:48`](../../src/lib/notifications/sendRegistrationInvite.ts#L48)

- Санитайз ссылки один раз; при небезопасном URL запасная строка не печатается.
  [`registration-invite.ts:11`](../../src/lib/email/templates/registration-invite.ts#L11)

**Финал регистрации**

- Ветвление по сессии вместо ложного «проверьте почту» при autoconfirm.
  [`RegisterContainer.tsx:80`](../../src/features/auth/components/RegisterContainer.tsx#L80)

- Повторный переход по долгоживущей ссылке из письма зовёт войти, а не ждать письмо.
  [`RegisterContainer.tsx:50`](../../src/features/auth/components/RegisterContainer.tsx#L50)

- `.select('id')` превращает молчаливый `0 rows` в видимую ошибку.
  [`RegisterContainer.tsx:65`](../../src/features/auth/components/RegisterContainer.tsx#L65)

**Тесты и конфигурация**

- Кейсы матрицы плюс регрессия на сбой поиска и partial-fail Resend.
  [`route.test.ts:1461`](../../tests/unit/app/api/webhooks/stripe/route.test.ts#L1461)

- Экранирование имени плательщика и поведение при небезопасной ссылке.
  [`registration-invite-template.test.ts:1`](../../tests/unit/lib/email/registration-invite-template.test.ts#L1)

- Обе ветки autoconfirm, повторный переход, нулевой апдейт профиля.
  [`RegisterContainer.test.tsx:1`](../../tests/unit/features/auth/components/RegisterContainer.test.tsx#L1)

- Требование канонического хоста зафиксировано комментарием у переменной.
  [`.env.example:5`](../../.env.example#L5)
