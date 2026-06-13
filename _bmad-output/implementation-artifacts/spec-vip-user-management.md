---
title: 'VIP-пользователи: создание по приглашению, приостановка и удаление администратором'
type: 'feature'
created: '2026-06-12'
status: 'draft'
context:
  - '{project-root}/_bmad-output/project-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-design-specification.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Администратору нужно выдавать доступ к закрытому порталу людям без оплаты через Stripe (VIP). Сейчас доступ — только `subscription_status IN ('active','trialing')` или `role='admin'`; создания аккаунта без оплаты нет, а ручная пометка платящих неотличима от подарочного доступа.

**Approach:** Ввести `profiles.is_vip` как независимый источник доступа. Админ создаёт VIP по email через Supabase Admin API (invite-письмо для установки пароля), приостанавливает (снять VIP, аккаунт остаётся) и удаляет (auth-юзер + профиль). VIP и Stripe-подписка **взаимоисключаемы**: нельзя дать VIP при активной подписке; при оплате подписки VIP снимается **безвозвратно** (повторная выдача — только вручную админом). Инвариант закрепляется на уровне БД. Доступ VIP идентичен платному клиенту (не админ).

## Boundaries & Constraints

**Always:**
- Access-gate: доступ = `is_vip=true` **OR** `subscription_status IN ('active','trialing')` **OR** `role='admin'`.
- **Взаимное исключение (инвариант БД):** запрещено состояние `is_vip=true И subscription_status IN ('active','trialing')`. Закрепить `CHECK`-констрейнтом на `profiles`.
- **Правило 1:** присвоение VIP — атомарный conditional update `UPDATE profiles SET is_vip=true WHERE id=$1 AND (subscription_status IS NULL OR subscription_status NOT IN ('active','trialing'))`. 0 строк → **409** (read-then-write запрещён, источник истины — локальный `subscription_status`, НЕ запрос в Stripe). Явный NULL-check обязателен: `NULL NOT IN (...)` в SQL возвращает `NULL`, а не `true`, иначе новые пользователи без подписки дают 0 rows → 409.
- **Правило 1а:** PATCH resume (`is_vip=false → true`) использует **тот же conditional update**, что и POST grant: `UPDATE profiles SET is_vip=true WHERE id=$1 AND (subscription_status IS NULL OR subscription_status NOT IN ('active','trialing'))`. 0 строк → **409**. Безусловный `SET is_vip=true` в PATCH запрещён — это дыра в обходе Правила 1.
- **Правило 2:** Stripe-вебхук при переходе подписки в `active`/`trialing` ставит `is_vip=false` **в том же statement**, что и `subscription_status`. У вебхука **нет единственного UPDATE** — `subscription_status` пишется в ~8 write-site (3 хендлера: `handleCheckoutSessionCompleted`, `handleInvoicePaymentSucceeded`, `handleSubscriptionUpdated`). Инвариант: **каждый** write-site, выставляющий active/trialing, в том же `updateData` добавляет `is_vip=false`. Вставка **условна** — только когда реально пишется active/trialing; на ID-only привязке (checkout с `payment_status≠paid`, пишутся только `stripe_*`-IDs) `is_vip` НЕ трогать (иначе преждевременно снимем VIP у не оплатившего). Реализация — через общий helper `applyVipRevocation(updateData)`: `if (updateData.subscription_status === 'active' || updateData.subscription_status === 'trialing') updateData.is_vip = false`. Снятие безвозвратно; при отмене/возврате подписки VIP НЕ восстанавливается.
- Все мутации VIP — через серверный Route Handler с `service_role` и проверкой `role='admin'` вызывающего (переиспользуемый `requireAdmin()`, не дублировать дырявый паттерн `posts/publish`). Иначе 403.
- **RLS:** `is_vip` пишется ТОЛЬКО `service_role`. Обычный/self UPDATE `is_vip` запрещён политикой (иначе обход оплаты).
- **Отзыв доступа через TTL, НЕ через Set-Cookie.** Кэш-кука `__sub_status` — `httpOnly`, живёт в браузере **участницы**. Админ-API, выполняя suspend/delete VIP, отвечает в браузер **админа** и физически НЕ может инвалидировать куку другого пользователя. Поэтому реальная задержка отзыва доступа = TTL куки (`SUBSCRIPTION_CACHE_TTL_SECONDS`, дефолт 30 c): пока кука валидна, кэш-fast-path в `auth-middleware.ts` отдаёт доступ **без чтения БД**, и смена `is_vip` невидима. Это осознанно принимаемый лаг ≤TTL — НЕ мгновенный отзыв. (Для VIP-юзера, инициирующего собственный выход/навигацию, кука истечёт штатно.) Если нужен более быстрый отзыв — отдельным решением сократить TTL или исключить VIP из кэш-пути (всегда читать БД), но это вне scope текущей спеки.
- Создание/удаление аккаунта — только `supabase.auth.admin.*`. Удаление необратимо → подтверждение в UI.
- snake_case для полей БД; UI на словенском; touch target `min-h-[44px] min-w-[44px]`.
- UI СТРОГО по `ux-design-specification.md` — разделы **Form Patterns**, **Button Hierarchy** (delete = destructive), **Feedback Patterns**, **Accessibility Strategy**, **Visual Design Foundation**.

**Ask First:**
- При DELETE, если у профиля есть `stripe_subscription_id` (возможна живая подписка в Stripe) — предупредить админа: удаление аккаунта НЕ отменяет биллинг в Stripe.

**Never:**
- НЕ давать VIP админских прав (`role` не меняется).
- Вебхук НИКОГДА не ставит `is_vip=true` (только `false`).
- НЕ ставить VIP через `subscription_status='vip'`.
- НЕ создавать новый раздел навигации — расширяем `(admin)/members`.
- НЕ переписывать **бизнес-логику** существующего `toggleMemberAccess` (точечная обработка ошибки `23514` разрешена — см. ниже).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Создание VIP | admin, новый email, без подписки | invite-письмо, profile `is_vip=true`, появляется в списке | — |
| Email уже зарегистрирован, без подписки | admin, существующий email | conditional update `is_vip=true`, без дубля и второго invite | `inviteUserByEmail` → 422 → lookup через RPC `get_auth_user_id_by_email` (НЕ `listUsers`) → conditional UPDATE. 0 rows → 409. Toast "Uporabnik že obstaja, dodeljen VIP" |
| Email с активной подпиской | admin, `subscription_status` active/trialing | conditional update задевает 0 строк → 409, `is_vip` остаётся false | toast "Uporabnik ima aktivno naročnino" |
| Невалидный email/пустой first_name | admin, "abc" / "" | 400, инлайн-ошибка под полем | Zod (email + first_name min 1) |
| VIP оплачивает подписку | webhook active/trialing для VIP | `subscription_status` обновлён + `is_vip=false` одной записью | — |
| Дубль Stripe-события | повтор того же события | повторная запись `is_vip=false` идемпотентна, без побочек | — |
| Приостановка VIP | admin, VIP-юзер | `is_vip=false`; доступ теряется при следующем чтении БД middleware — т.е. после истечения TTL кэш-куки `__sub_status` (≤30 c), не мгновенно | — |
| VIP приостановлен, затем оформил подписку, admin нажимает resume | admin, PATCH resume + `subscription_status` active/trialing | 0 rows → 409, `is_vip` остаётся false | toast "Uporabnik ima aktivno naročnino" |
| Бывший VIP оплатил и отменил подписку | VIP → active → canceled | Доступ закрыт (`subscription_status='canceled'`, `is_vip=false`); VIP не восстанавливается | — |
| Удаление VIP | admin, подтверждение | auth-юзер + профиль удалены, исчезает из списка | — |
| Не-админ дёргает API | авторизованный user без role=admin | 403 Forbidden, мутация не выполнена | JSON `{ error }` |
| Прямой UPDATE is_vip юзером | self/authenticated UPDATE | RLS отказ; при гонке — `CHECK` 23514 | — |
| Существующий `toggleMemberAccess` на VIP | admin жмёт "Omogoči dostop" (active) для `is_vip=true` | `CHECK chk_vip_xor_active` бросает 23514 | Поймать `23514` в catch toggle → toast "Uporabnik je VIP — najprej prekličite VIP status" (не сырой текст ошибки) |
| VIP на портале | `is_vip=true`, статус не active | доступ разрешён | — |

</frozen-after-approval>

## Code Map

- `src/proxy.ts` + `src/lib/supabase/auth-middleware.ts` -- `proxy.ts` — entrypoint (функция `export async function proxy()`); `auth-middleware.ts` — helper, вызываемый из proxy. `is_vip` добавляется в select **обоих** блоков (`/inactive`-fallback ~L171-175 и PROTECTED ROUTES ~L288-292). Для VIP — early-return в fallback ДО Stripe-вызова; access-gate расширяется до `is_vip || active/trialing || admin`. **Внимание:** `createCacheToken(userId, status)`/`parseCacheToken` сейчас кодируют ТОЛЬКО `status` (одна строка) — требуется сменить сигнатуру/payload, чтобы токен включал effective-access с учётом `is_vip` (иначе VIP-юзер с `subscription_status='inactive'` уйдёт на /inactive, а смена `is_vip` не сломает подпись токена). Это НЕ однострочная правка select.
- `src/lib/supabase/requireAdmin.ts` -- НОВЫЙ. `getUser()` → `profiles.role==='admin'`, иначе 403. Переиспользуемый guard для admin-API.
- `src/app/api/admin/vip/route.ts` -- НОВЫЙ. POST (invite + conditional update is_vip), PATCH (suspend/resume), DELETE (auth.admin.deleteUser); `requireAdmin` + service_role; обработка `23514`→409.
- `src/app/api/webhooks/stripe/route.ts` -- helper `applyVipRevocation(updateData)` перед каждым write-site с active/trialing (~8 мест в 3 хендлерах); `is_vip=false` условно, на ID-only привязке не трогать (Правило 2); catch 23514 только для `chk_vip_xor_active` → 200. НИКОГДА не ставить `is_vip=true`.
- `src/features/admin/api/vip.ts` -- НОВЫЙ. `createVipUser/suspendVip/resumeVip/deleteVip` (fetch к `/api/admin/vip`).
- `src/features/admin/api/membersServer.ts` -- добавить `is_vip` в select (сейчас: `id, email, display_name, created_at, subscription_status, current_period_end, stripe_customer_id`).
- `src/features/admin/api/members.ts` -- `toggleMemberAccess`: добавить catch на `23514` (столкновение с VIP) → бросить понятную ошибку для toast. Бизнес-логику не трогать.
- `src/features/admin/types.ts` -- `MemberProfile.is_vip: boolean`; `VipCreateSchema` (email + first_name min 1).
- `src/features/admin/components/MembersContainer.tsx` -- состояние + create/suspend/delete; оптимистично + rollback; toast на системные ошибки.
- `src/features/admin/components/MembersTable.tsx` -- бейдж VIP; действия suspend/resume и delete (с подтверждением, destructive-вариант).
- `src/features/admin/components/VipCreateForm.tsx` -- НОВЫЙ. Форма (RHF+Zod, инлайн-ошибки).
- `src/app/(admin)/members/page.tsx` -- отрисовать VipCreateForm над таблицей.
- `src/types/supabase.ts` -- `is_vip: boolean` в Row/Insert/Update `profiles`.
- DB migration -- колонка `is_vip`, `CHECK`-инвариант, RLS-политика.
- `tests/unit/admin/vip.test.ts` -- НОВЫЙ. Юнит-тесты матрицы.

## Tasks & Acceptance

**Execution:**
- [ ] **Pre-flight верификация БД** (схема НЕ в репо — DDL/триггеры/RPC живут только в self-hosted БД, проверять через `/pg/query` ДО реализации): (a) триггер `handle_new_user` действительно читает `new.raw_user_meta_data->>'first_name'` и его `ON CONFLICT (id) DO UPDATE` НЕ включает `is_vip`; (b) RPC `get_auth_user_id_by_email` существует и доступен service_role; (c) FK `profiles.id → auth.users` имеет `ON DELETE CASCADE`.
- [ ] DB migration (через `/pg/query` на self-hosted боевой БД) -- (1) `ALTER TABLE profiles ADD COLUMN is_vip boolean NOT NULL DEFAULT false`; (2) погасить возможных нарушителей `UPDATE ... SET is_vip=false WHERE is_vip AND subscription_status IN ('active','trialing')`, затем `ADD CONSTRAINT chk_vip_xor_active CHECK (NOT (is_vip AND subscription_status IN ('active','trialing')))`; (3) RLS: запретить запись `is_vip` всем кроме service_role; (4) если FK НЕ `ON DELETE CASCADE` (см. pre-flight) — явный cleanup профиля в DELETE-хендлере.
- [ ] `src/types/supabase.ts` -- `is_vip: boolean` в типах `profiles`.
- [ ] `src/lib/supabase/auth-middleware.ts` -- select `is_vip` в **обоих** блоках; допуск `is_vip || active/trialing || admin`; early-return для VIP в fallback до Stripe; **сменить сигнатуру `createCacheToken`/`parseCacheToken`** — кодировать effective-access с учётом `is_vip` (не только `status`). Отзыв доступа при suspend — через TTL куки, без Set-Cookie из админ-API (см. Boundaries).
- [ ] `src/lib/supabase/requireAdmin.ts` -- guard, 403 при не-admin.
- [ ] `src/app/api/admin/vip/route.ts` -- requireAdmin; POST: `inviteUserByEmail` → 422 → `auth.admin.listUsers()` по email → conditional update is_vip (0 строк→409); PATCH suspend: `UPDATE ... SET is_vip=false WHERE is_vip=true` (идемпотентно); PATCH resume: тот же guard что и POST (Правило 1а, 0 строк→409); POST: при 422 от `inviteUserByEmail` — lookup через RPC `get_auth_user_id_by_email` (НЕ listUsers); DELETE deleteUser (+ предупреждение при stripe_subscription_id). Отзыв доступа suspend — через TTL куки, НЕ Set-Cookie (админ не может тронуть httpOnly-куку участницы). Env-guard service_role ВНЕ try/catch. Лов `23514` только для `chk_vip_xor_active`→409.
- [ ] `src/app/api/webhooks/stripe/route.ts` -- ввести helper `applyVipRevocation(updateData)` и вызвать его перед **каждым** `.update()/.upsert()`, где может стоять active/trialing (~8 write-site: `handleCheckoutSessionCompleted` ×4 вкл. `upsertProfileByUserId`, `handleInvoicePaymentSucceeded` ×3, `handleSubscriptionUpdated` ×2). Helper добавляет `is_vip=false` только если `updateData.subscription_status ∈ {active,trialing}` (Правило 2). На ID-only привязке (`payment_status≠paid`) — НЕ трогать `is_vip`. Catch 23514 **только для constraint `chk_vip_xor_active`** → 200; остальные 23514 → re-throw → 500. НИКОГДА не ставить `is_vip=true`.
- [ ] `src/features/admin/{types,api/membersServer,api/vip,api/members}.ts` -- типы (`MemberProfile.is_vip`), select `is_vip`, Zod-схема (`VipCreateSchema`: email + first_name min 1), клиентские обёртки; `members.ts` — catch `23514` в `toggleMemberAccess` с понятным сообщением.
- [ ] `src/features/admin/components/*` + `src/app/(admin)/members/page.tsx` -- VipCreateForm, бейдж/действия, логика контейнера, подключение формы.
- [ ] `tests/unit/admin/vip.test.ts` -- покрыть матрицу + негативные: 409 при активной подписке (Rule 1); `subscription_status=NULL` → POST grant → 200; webhook→is_vip=false одним UPDATE (Rule 2); дубль события идемпотентен; не-admin→403; RLS-отказ записи is_vip; PATCH resume + active sub → 409; webhook helper `applyVipRevocation`: is_vip=false добавляется при active/trialing, НЕ добавляется на ID-only привязке (payment_status≠paid); POST существующий email → 200 без повторного invite (lookup через RPC); trigger conflict: is_vip не перезаписывается дефолтом.

**Acceptance Criteria:**
- Given email с `subscription_status` active/trialing, when админ присваивает VIP, then 409 и `is_vip` остаётся false.
- Given email с `subscription_status=NULL` (новый пользователь), when админ присваивает VIP, then 200, `is_vip=true`, invite отправлен.
- Given существующий email без подписки, when админ присваивает VIP, then 200, `is_vip=true`, повторный invite НЕ отправлен.
- Given VIP-юзер, when приходит Stripe-вебхук о переходе подписки в active, then `is_vip` становится false одним UPDATE; после отмены подписки VIP не восстанавливается.
- Given VIP приостановлен, а пользователь в промежутке оформил подписку, when админ нажимает PATCH resume, then 409 и `is_vip` остаётся false.
- Given webhook ставит `subscription_status='active'` на профиль, then `is_vip=false` пишется тем же statement; given ID-only привязка (`payment_status≠paid`), then `is_vip` НЕ трогается.
- Given обычный авторизованный (не-admin) юзер, when дёргает любой метод `/api/admin/vip`, then 403 и мутация не выполнена.
- Given обычный юзер, when пытается `UPDATE profiles SET is_vip=true` напрямую, then отказ RLS (и `CHECK` 23514 при гонке).
- Given VIP приостановлен (`is_vip=false`), when кэш-кука `__sub_status` истекает (≤TTL, дефолт 30 c) и middleware читает БД, then редирект на `/inactive`. Отзыв не мгновенный — лаг ≤TTL осознанно принят.
- Given админ удаляет VIP с подтверждением, when DELETE завершён, then auth-юзер и профиль отсутствуют, строка исчезает.

## Spec Change Log

_Пусто — изменений по итогам review-циклов пока нет._

## Design Notes

**Сходимость гонки:** правило 2 («оплатил → is_vip=false») делает Stripe-оплату детерминированным победителем — при любом порядке create-VIP↔оплата финальное состояние сходится к «подписка победила, VIP снят». `CHECK`-инвариант — последняя линия: admin-API ловит `23514`→409, webhook→200. Запись `is_vip=false` идемпотентна (фиксированное значение), поэтому повтор/out-of-order событий безвреден; существующую логику `subscription_status` не трогаем.

**Known race (принято как допустимое):** администратор может выдать VIP пользователю, у которого Stripe Checkout Session уже создана, но вебхук ещё не пришёл (локальный `subscription_status` ещё NULL). В этом случае VIP будет выдан и тут же снят вебхуком. Администратор не получает уведомления об автоматическом снятии. Источник истины — БД, не Stripe API. При необходимости — повторная ручная выдача.

**Список «активных» статусов:** Rule 1 и Rule 2 используют `('active','trialing')` — намеренно. Статусы `past_due`, `paused`, `incomplete` не блокируют выдачу VIP, так как они не дают фактического доступа к порталу. Если впоследствии `past_due`-подписка возобновится и перейдёт в `active` — webhook корректно снимет VIP (Rule 2). Это допустимое поведение, не баг.

**VIP сгорает безвозвратно** (осознанное решение): поле памяти `was_vip` НЕ вводим; восстановление VIP после отмены подписки — ручная повторная выдача админом.

**Admin API:** `createSupabaseAdminClient(url, SERVICE_ROLE_KEY)` (паттерн `src/app/api/posts/publish/route.ts`). Создание: `auth.admin.inviteUserByEmail(email, { redirectTo: SITE_URL + '/update-password', data: { first_name } })`. `first_name` обязателен (profiles.first_name NOT NULL) — Zod min 1 + убедиться, что триггер `handle_new_user` читает `data.first_name`. Профиль может создаваться триггером — присвоение is_vip идемпотентно (`onConflict: id`, is_vip не перетирать дефолтом). Триггер в `DO UPDATE`-части должен обновлять только `first_name` (и аналогичные поля), но **не включать `is_vip`** — иначе перезапишет `false` дефолтом.

**Обработка существующего email:** `inviteUserByEmail` возвращает 422 (`User already registered`) если email занят. Handler перехватывает 422, находит пользователя через существующий RPC `get_auth_user_id_by_email` (O(1) lookup, case-insensitive `lower()` в SQL — тот же, что использует Stripe-webhook), затем выполняет conditional update is_vip по найденному id. Invite повторно не отправляется. **НЕ использовать `auth.admin.listUsers()`** — этот анти-паттерн уже отвергнут в проекте (Round 8 в webhook): он грузит весь список пользователей в память и не масштабируется.

**first_name vs display_name:** профиль имеет оба поля — `first_name` (NOT NULL, подтверждено типами) и `display_name` (nullable). Список участниц (`membersServer`/`MembersTable`) оперирует `display_name` и показывает только email. VipCreateForm собирает **`first_name`** — он обязателен для триггера `handle_new_user` и NOT-NULL-констрейнта. Это не конфликт (разные поля, разное назначение), но при добавлении имени в таблицу — определиться, какое поле выводить. `is_vip` добавить в select `membersServer` и в `MemberProfile`.

**UI:** строго по `ux-design-specification.md` и паттернам существующих компонентов админки; бейдж VIP — в стиле текущих status-бейджей; удаление — destructive с подтверждением.

## Verification

**Commands:**
- `npm run typecheck` -- expected: без ошибок.
- `npm run lint` -- expected: чисто.
- `npm run test` -- expected: `vip.test.ts` зелёный, существующие тесты целы.

**Manual checks:**
- Создать VIP на тестовый email без подписки → invite-письмо, статус VIP, после установки пароля заходит на `/feed`.
- Попытка VIP для email с активной подпиской → 409, тост. Приостановить → редирект на `/inactive`. Удалить → исчезает из списка.
