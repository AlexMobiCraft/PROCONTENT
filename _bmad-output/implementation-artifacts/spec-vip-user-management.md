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
- **Правило 1:** присвоение VIP — атомарный conditional update `UPDATE profiles SET is_vip=true WHERE id=$1 AND subscription_status NOT IN ('active','trialing')`. 0 строк → **409** (read-then-write запрещён, источник истины — локальный `subscription_status`, НЕ запрос в Stripe).
- **Правило 2:** Stripe-вебхук при переходе подписки в `active`/`trialing` ставит `is_vip=false` той же записью (`CASE WHEN ... THEN false`). Снятие безвозвратно; при отмене/возврате подписки VIP НЕ восстанавливается.
- Все мутации VIP — через серверный Route Handler с `service_role` и проверкой `role='admin'` вызывающего (переиспользуемый `requireAdmin()`, не дублировать дырявый паттерн `posts/publish`). Иначе 403.
- **RLS:** `is_vip` пишется ТОЛЬКО `service_role`. Обычный/self UPDATE `is_vip` запрещён политикой (иначе обход оплаты).
- Кэш-кука `__sub_status` инвалидируется при любом изменении `is_vip` (suspend/delete/create) — иначе зависший доступ до TTL.
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
- НЕ переписывать существующий `toggleMemberAccess`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Создание VIP | admin, новый email, без подписки | invite-письмо, profile `is_vip=true`, появляется в списке | — |
| Email уже зарегистрирован, без подписки | admin, существующий email | conditional update `is_vip=true`, без дубля и второго invite | toast "Uporabnik že obstaja, dodeljen VIP" |
| Email с активной подпиской | admin, `subscription_status` active/trialing | conditional update задевает 0 строк → 409, `is_vip` остаётся false | toast "Uporabnik ima aktivno naročnino" |
| Невалидный email/пустой first_name | admin, "abc" / "" | 400, инлайн-ошибка под полем | Zod (email + first_name min 1) |
| VIP оплачивает подписку | webhook active/trialing для VIP | `subscription_status` обновлён + `is_vip=false` одной записью | — |
| Дубль Stripe-события | повтор того же события | повторная запись `is_vip=false` идемпотентна, без побочек | — |
| Приостановка VIP | admin, VIP-юзер | `is_vip=false`, кука инвалидирована, доступ теряется на след. навигации | — |
| Удаление VIP | admin, подтверждение | auth-юзер + профиль удалены, исчезает из списка | — |
| Не-админ дёргает API | авторизованный user без role=admin | 403 Forbidden, мутация не выполнена | JSON `{ error }` |
| Прямой UPDATE is_vip юзером | self/authenticated UPDATE | RLS отказ; при гонке — `CHECK` 23514 | — |
| VIP на портале | `is_vip=true`, статус не active | доступ разрешён | — |

</frozen-after-approval>

## Code Map

- `src/lib/supabase/auth-middleware.ts` -- access-gate; `is_vip` в select обоих блоков (`/inactive`-fallback и PROTECTED ROUTES); для VIP — early-return в fallback ДО Stripe-вызова; кэш-токен включает источник, чтобы изменение `is_vip` ломало подпись (инвалидация куки).
- `src/lib/supabase/requireAdmin.ts` -- НОВЫЙ. `getUser()` → `profiles.role==='admin'`, иначе 403. Переиспользуемый guard для admin-API.
- `src/app/api/admin/vip/route.ts` -- НОВЫЙ. POST (invite + conditional update is_vip), PATCH (suspend/resume), DELETE (auth.admin.deleteUser); `requireAdmin` + service_role; обработка `23514`→409.
- `src/app/api/webhooks/stripe/route.ts` -- при `active`/`trialing` добавить `is_vip=false` в существующий UPDATE (правило 2). НИКОГДА не ставить `is_vip=true`.
- `src/features/admin/api/vip.ts` -- НОВЫЙ. `createVipUser/suspendVip/resumeVip/deleteVip` (fetch к `/api/admin/vip`).
- `src/features/admin/api/membersServer.ts` -- добавить `is_vip` в select.
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
- [ ] DB migration (через `/pg/query` на self-hosted боевой БД) -- (1) `ALTER TABLE profiles ADD COLUMN is_vip boolean NOT NULL DEFAULT false`; (2) погасить возможных нарушителей `UPDATE ... SET is_vip=false WHERE is_vip AND subscription_status IN ('active','trialing')`, затем `ADD CONSTRAINT chk_vip_xor_active CHECK (NOT (is_vip AND subscription_status IN ('active','trialing')))`; (3) RLS: запретить запись `is_vip` всем кроме service_role; (4) верифицировать FK `profiles.id → auth.users ON DELETE CASCADE` (иначе явный cleanup профиля в DELETE).
- [ ] `src/types/supabase.ts` -- `is_vip: boolean` в типах `profiles`.
- [ ] `src/lib/supabase/auth-middleware.ts` -- select `is_vip`; допуск `is_vip || active/trialing || admin`; early-return для VIP в fallback до Stripe; кэш-токен версионируется по `is_vip|subscription_status`.
- [ ] `src/lib/supabase/requireAdmin.ts` -- guard, 403 при не-admin.
- [ ] `src/app/api/admin/vip/route.ts` -- requireAdmin; POST `inviteUserByEmail` + conditional update is_vip (0 строк→409); PATCH toggle is_vip; DELETE deleteUser (+ предупреждение при stripe_subscription_id). Env-guard service_role ВНЕ try/catch. Лов `23514`→409.
- [ ] `src/app/api/webhooks/stripe/route.ts` -- при active/trialing: `is_vip=false` в том же UPDATE; вернуть 200 при `23514` (без ретрай-шторма).
- [ ] `src/features/admin/{types,api/membersServer,api/vip}.ts` -- типы, select, Zod-схема, клиентские обёртки.
- [ ] `src/features/admin/components/*` + `src/app/(admin)/members/page.tsx` -- VipCreateForm, бейдж/действия, логика контейнера, подключение формы.
- [ ] `tests/unit/admin/vip.test.ts` -- покрыть матрицу + негативные: 409 при активной подписке; webhook→is_vip=false; не-admin→403; RLS-отказ записи is_vip; дубль события идемпотентен.

**Acceptance Criteria:**
- Given email с `subscription_status` active/trialing, when админ присваивает VIP, then 409 и `is_vip` остаётся false.
- Given VIP-юзер, when приходит Stripe-вебхук о переходе подписки в active, then `is_vip` становится false той же записью; после отмены подписки VIP не восстанавливается.
- Given обычный авторизованный (не-admin) юзер, when дёргает любой метод `/api/admin/vip`, then 403 и мутация не выполнена.
- Given обычный юзер, when пытается `UPDATE profiles SET is_vip=true` напрямую, then отказ RLS (и `CHECK` 23514 при гонке).
- Given VIP приостановлен, when навигирует по порталу, then кука инвалидирована и редирект на `/inactive`.
- Given админ удаляет VIP с подтверждением, when DELETE завершён, then auth-юзер и профиль отсутствуют, строка исчезает.

## Design Notes

**Сходимость гонки:** правило 2 («оплатил → is_vip=false») делает Stripe-оплату детерминированным победителем — при любом порядке create-VIP↔оплата финальное состояние сходится к «подписка победила, VIP снят». `CHECK`-инвариант — последняя линия: admin-API ловит `23514`→409, webhook→200. Запись `is_vip=false` идемпотентна (фиксированное значение), поэтому повтор/out-of-order событий безвреден; существующую логику `subscription_status` не трогаем.

**VIP сгорает безвозвратно** (осознанное решение): поле памяти `was_vip` НЕ вводим; восстановление VIP после отмены подписки — ручная повторная выдача админом.

**Admin API:** `createSupabaseAdminClient(url, SERVICE_ROLE_KEY)` (паттерн `src/app/api/posts/publish/route.ts`). Создание: `auth.admin.inviteUserByEmail(email, { redirectTo: SITE_URL + '/update-password', data: { first_name } })`. `first_name` обязателен (profiles.first_name NOT NULL) — Zod min 1 + убедиться, что триггер `handle_new_user` читает `data.first_name`. Профиль может создаваться триггером — присвоение is_vip идемпотентно (`onConflict: id`, is_vip не перетирать дефолтом).

**UI:** строго по `ux-design-specification.md` и паттернам существующих компонентов админки; бейдж VIP — в стиле текущих status-бейджей; удаление — destructive с подтверждением.

## Verification

**Commands:**
- `npm run typecheck` -- expected: без ошибок.
- `npm run lint` -- expected: чисто.
- `npm run test` -- expected: `vip.test.ts` зелёный, существующие тесты целы.

**Manual checks:**
- Создать VIP на тестовый email без подписки → invite-письмо, статус VIP, после установки пароля заходит на `/feed`.
- Попытка VIP для email с активной подпиской → 409, тост. Приостановить → редирект на `/inactive`. Удалить → исчезает из списка.
