---
stepsCompleted: ['step-01-document-discovery', 'step-02-code-map-verification']
assessmentTarget: 'spec-vip-user-management.md'
date: '2026-06-13'
verdict: 'READY — блокеры 1-3 и High/Medium 4-7 устранены ревизией спеки 2026-06-13'
---

# Implementation Readiness Assessment Report

**Date:** 2026-06-13
**Project:** PROCONTENT
**Assessment Target:** `_bmad-output/implementation-artifacts/spec-vip-user-management.md`

## Step 1 — Document Discovery

### Целевой артефакт проверки
- `implementation-artifacts/spec-vip-user-management.md` (20 KB, изменён 2026-06-13) — **standalone spec** (тип `feature`, status `draft`)

### Контекст, на который ссылается спека
- `_bmad-output/project-context.md` (4.5 KB) — найден ✅
- `planning-artifacts/ux-design-specification.md` (63 KB) — найден ✅

### Глобальные планировочные документы (в planning-artifacts)
- `prd.md` (45 KB) — глобальный PRD продукта
- `prd-video-thumbnails.md` (33 KB) — PRD отдельной фичи
- `architecture.md` (50 KB) — архитектура
- `epics.md` (86 KB) — эпики
- `brief.md` (20 KB) — product brief
- `ux-design-specification.md` (63 KB)

### Ключевое наблюдение
Фича VIP-управления описана **исключительно** в standalone-спеке. Она **не упоминается** в глобальных `prd.md` / `epics.md` / `architecture.md`. Это нормально для BMAD `spec`-воркфлоу (самодостаточный артефакт intent→implementation для небольших фич), но означает, что классический traceability-прогон readiness-скилла (PRD → Architecture → Epics → Stories) не имеет здесь предмета — проверяется внутренняя полнота спеки и её соответствие реальному коду.

## Step 2 — Code Map Verification (сверка с реальным кодом)

### Существование заявленных файлов
| Файл | Заявлен как | Факт |
|------|-------------|------|
| `src/proxy.ts` | entrypoint | ✅ есть (не `middleware.ts`) |
| `src/lib/supabase/auth-middleware.ts` | правка | ✅ есть |
| `src/lib/supabase/requireAdmin.ts` | НОВЫЙ | ✅ отсутствует (корректно) |
| `src/app/api/admin/vip/route.ts` | НОВЫЙ | ✅ отсутствует (корректно) |
| `src/app/api/webhooks/stripe/route.ts` | правка | ✅ есть |
| `src/features/admin/api/vip.ts` | НОВЫЙ | ✅ отсутствует (корректно) |
| `src/features/admin/api/membersServer.ts` | правка | ✅ есть |
| `src/features/admin/types.ts` | правка | ✅ есть |
| `src/features/admin/components/MembersContainer.tsx` | правка | ✅ есть |
| `src/features/admin/components/MembersTable.tsx` | правка | ✅ есть |
| `src/features/admin/components/VipCreateForm.tsx` | НОВЫЙ | ✅ отсутствует (корректно) |
| `src/app/(admin)/members/page.tsx` | правка | ✅ есть |
| `src/types/supabase.ts` | правка | ✅ есть |

Code Map по составу файлов — **точен**.

### BLOCKER 1 — Rule 2 радикально недооценивает поверхность webhook
Спека и Tasks говорят: «добавить `is_vip=false` в **существующий UPDATE**» — как будто UPDATE один. Факт (`webhooks/stripe/route.ts`): `subscription_status` ставится в `active`/`trialing` минимум в **8 разных write-site** в 3 хендлерах:
- `handleCheckoutSessionCompleted`: update по `client_reference_id` (L216), `upsertProfileByUserId` upsert (L54–59), update по `customer_id` (L243), email-fallback update (L287). При этом `subscription_status` добавляется в `updateData` **условно** — только при `payment_status='paid'|'no_payment_required'` (L168).
- `handleInvoicePaymentSucceeded`: по `sub_id` (L358), fallback 2a (L390), fallback 2b (L404).
- `handleSubscriptionUpdated`: по `sub_id` (L533), fallback 2a (L552). Ставит `active` **или** `trialing`.

**Последствие:** «одним UPDATE» (как сформулировано в спеке) недостижимо глобально — это N независимых statement'ов. Корректное правило: **каждый** write-site, выставляющий active/trialing, в **том же** statement добавляет `is_vip=false`. И добавлять `is_vip=false` нужно **условно** — только когда реально пишется active/trialing, а НЕ на ID-only привязке (checkout с `payment_status≠paid` пишет только IDs; добавить туда `is_vip=false` = преждевременно снять VIP у не оплатившего). Однострочный task в спеке недостаточен — нужно либо перечислить write-site, либо ввести helper `applyVipRevocation(updateData)`.

### BLOCKER 2 — Инвалидация куки админ-API архитектурно невозможна
`__sub_status` — `httpOnly`-кука в браузере **участницы** (`auth-middleware.ts` L37–45, L275–285). Когда админ suspend/delete VIP, Route Handler отвечает в браузер **админа** — он физически не может выставить/удалить куку другого пользователя. Ранее внесённая правка «Route Handler обязан явно выставить `Set-Cookie` инвалидации `__sub_status`» — **неверна** для админ-инициированных мутаций.

Реальная задержка отзыва доступа = TTL куки (`SUBSCRIPTION_CACHE_TTL_SECONDS`, дефолт **30 c**). Кэш-путь (L275–285) возвращает доступ **без чтения БД**, поэтому смена `is_vip` невидима до истечения куки. AC «VIP приостановлен → кука инвалидирована → редирект на /inactive» истинно **только после TTL**, не мгновенно. Спека должна выбрать: (a) принять лаг ≤30 c и переписать AC; (b) исключить VIP из кэш-fast-path (всегда читать БД для VIP); (c) сократить TTL.

### BLOCKER 3 — Спека рекомендует анти-паттерн, уже отвергнутый в коде
Внесённая правка про email-exists рекомендует `auth.admin.listUsers()`. Но webhook (L259–266, комментарий Round 8) **явно заменил** `listUsers` на RPC `get_auth_user_id_by_email` с обоснованием «listUsers загружала весь список пользователей в память и не масштабируется». VIP POST-хендлер должен **переиспользовать существующий RPC `get_auth_user_id_by_email`**, а не listUsers.

### HIGH 4 — Кэш-токен версионируется не так просто, как сказано
`createCacheToken(userId, status)` (L64) кодирует **только** status. Для VIP-пользователя (`is_vip=true`, `subscription_status='inactive'/null`) текущая логика L317 уводит на /inactive. Спека пишет «токен версионируется по `is_vip|subscription_status`», но это требует **смены сигнатуры** `createCacheToken`/`parseCacheToken` и вычисления effective-access для VIP — не «однострочный select». Task для auth-middleware это скрывает.

### HIGH 5 — `first_name` vs `display_name`
`membersServer.ts` (L9) и `MemberProfile` оперируют `display_name`. VipCreateForm спеки собирает `first_name`. Список участниц (`MembersTable`) показывает только email — имя не выводится. Замечания: (a) `is_vip` нужно добавить в select `membersServer`; (b) `first_name NOT NULL` спекой заявлен корректно — **подтверждено** типами (`first_name: string` в Row, без `?`); (c) рассогласование first_name/display_name между новой формой и остальной админкой — выровнять или осознанно принять.

### MEDIUM 6 — Взаимодействие существующего `toggleMemberAccess` с новым инвариантом
`members.ts` `toggleMemberAccess` ставит `subscription_status='active'/'canceled'` напрямую через **клиентский** Supabase (anon key, RLS). Если у профиля `is_vip=true`, а админ жмёт «Omogoči dostop» (active) → `CHECK chk_vip_xor_active` бросит `23514` → клиентский toggle упадёт с сырой ошибкой в toast. Спека говорит «НЕ переписывать toggleMemberAccess», но не описывает это столкновение. Нужно: либо toggle тоже гасит is_vip, либо UI-предупреждение.

### MEDIUM 7 — Нет SQL-миграций в репозитории
Триггер `handle_new_user` и RPC `get_auth_user_id_by_email` в репо **отсутствуют** (БД self-hosted, DDL через `/pg/query`). Значит «убедиться, что триггер читает `data.first_name`», FK `ON DELETE CASCADE` и применение CHECK/RLS — **не верифицируются из кода**, только живой проверкой в БД до реализации. Схема вне version control — приемлемый, но осознаваемый риск.

### Что подтвердилось корректным
- `createSupabaseAdminClient`-паттерн (service_role) — реально существует в webhook (`createAdminClient`, L18–27) и `posts/publish`.
- `__sub_status`, `INACTIVE_PATH`, access-gate по `subscription_status IN (active,trialing)` + admin — всё на месте, селекты `is_vip` действительно нужно добавлять в **оба** блока (L171–175 и L288–292) — спека права.
- `first_name NOT NULL` — подтверждено типами.
- Состав NEW/EXISTING файлов — точен.

## Verdict

**NOT READY — требуется ревизия спеки перед реализацией.**

| # | Находка | Severity | Действие |
|---|---------|----------|----------|
| 1 | Rule 2 недооценивает поверхность webhook (8 write-site, условная вставка) | 🔴 Blocker | Переписать task: helper `applyVipRevocation` + перечислить write-site |
| 2 | Инвалидация куки админ-API невозможна (httpOnly чужого юзера) | 🔴 Blocker | Принять лаг ≤TTL и переписать AC, либо исключить VIP из кэша |
| 3 | Рекомендован `listUsers()` — анти-паттерн, отвергнутый в коде | 🔴 Blocker | Переиспользовать RPC `get_auth_user_id_by_email` |
| 4 | Кэш-токен: смена сигнатуры `createCacheToken`, не «однострочник» | 🟠 High | Уточнить task auth-middleware |
| 5 | `first_name` vs `display_name` рассогласование | 🟠 High | Выровнять или принять; `is_vip` в select membersServer |
| 6 | `toggleMemberAccess` × CHECK 23514 столкновение | 🟡 Medium | Обработать 23514 в toggle или предупредить в UI |
| 7 | Нет SQL-миграций в репо (триггер/RPC/FK только в БД) | 🟡 Medium | Верифицировать вживую через /pg/query до старта |

**Внутренняя связность спеки** (Intent ↔ Boundaries ↔ I/O Matrix ↔ Tasks ↔ AC) после предыдущих правок — целостна. Проблемы — на стыке спеки с **реальным кодом**, который оказался сложнее, чем предполагает Code Map.
