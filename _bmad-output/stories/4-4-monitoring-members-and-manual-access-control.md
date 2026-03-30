# Story 4.4: Мониторинг участниц и ручное управление доступом

Status: review

## Story

As a автор,
I want видеть список всех зарегистрированных участниц с их статусом в Stripe и при необходимости вручную выдавать/забирать доступ,
so that решать спорные ситуации с платежами.

## Acceptance Criteria

1. **Список участниц**: При открытии вкладки `/admin/members` авторизованным admin'ом отображается таблица/список всех профилей пользователей с колонками: email, дата регистрации, статус подписки (active/trialing → активна, иное/null → неактивна).
2. **Ручное переключение доступа**: Рядом с каждой участницей присутствует кнопка "Omogoči dostop" (если неактивна) или "Prekliči dostop" (если активна/trialing), нажатие на которую меняет `subscription_status` в таблице `profiles` в обход Stripe-логики.
3. **Безопасность**: Страница `/admin/members` и API-мутация недоступны для пользователей без роли `admin` (layout.tsx уже обеспечивает защиту маршрута).
4. **Навигация**: В `AdminSidebar` добавлен пункт "Udeleženke" со ссылкой на `/members`, с корректным активным состоянием.

## Tasks / Subtasks

- [x] Task 1: Суpabase-миграция — RLS admin для profiles (AC: 1, 2)
  - [x] Создать `supabase/migrations/024_admin_rls_for_profiles.sql`
  - [x] Добавить SECURITY DEFINER функцию `is_admin()` (аналог `is_active_subscriber()`)
  - [x] Заменить политику SELECT на profiles: `auth.uid() = id OR public.is_admin()`
  - [x] Добавить политику UPDATE на profiles для admin: `public.is_admin()` WITH CHECK

- [x] Task 2: Константы маршрутов (AC: 4)
  - [x] Добавить `ADMIN_MEMBERS_PATH = '/members'` в `src/lib/app-routes.ts`

- [x] Task 3: Типы (AC: 1, 2)
  - [x] Добавить `MemberProfile` тип в `src/features/admin/types.ts` (поля из profiles нужные для UI)

- [x] Task 4: Server API — чтение списка (AC: 1)
  - [x] Создать `src/features/admin/api/membersServer.ts` — функция `fetchMembersServer()`: читает все profiles через `createClient()` (server), сортировка `created_at DESC`

- [x] Task 5: Client API — мутация доступа (AC: 2)
  - [x] Создать `src/features/admin/api/members.ts` — функция `toggleMemberAccess(userId, grantAccess)`: обновляет `subscription_status` в profiles через `createClient()` (browser)

- [x] Task 6: Dumb-компонент MembersTable (AC: 1, 2)
  - [x] Создать `src/features/admin/components/MembersTable.tsx` — принимает `members: MemberProfile[]`, `onToggle(userId, grantAccess)` callback, `togglingId: string | null`; сам рендерит Skeleton при `isLoading=true`

- [x] Task 7: Smart-контейнер MembersContainer (AC: 1, 2)
  - [x] Создать `src/features/admin/components/MembersContainer.tsx` — `'use client'`, принимает `initialMembers`, управляет optimistic UI, вызывает `toggleMemberAccess`, показывает Toast при ошибке

- [x] Task 8: RSC-страница members (AC: 1, 3)
  - [x] Создать `src/app/(admin)/members/page.tsx` — загружает данные через `fetchMembersServer()`, рендерит `MembersContainer`

- [x] Task 9: Навигация AdminSidebar (AC: 4)
  - [x] Добавить nav-item "Udeleženke" в `adminNavItems` в `AdminSidebar.tsx`

- [x] Task 10: Тесты
  - [x] `tests/unit/features/admin/api/members.test.ts` — тесты `toggleMemberAccess` (клиентская мутация)
  - [x] `tests/unit/app/(admin)/members/page.test.tsx` — тест RSC страницы (mock `fetchMembersServer`)
  - [x] `tests/unit/features/admin/components/MembersTable.test.tsx` — рендер, skeleton, кнопки toggle
  - [x] `tests/unit/components/navigation/AdminSidebar.test.tsx` — обновить существующий тест: проверить новый пункт "Udeleženke"

## Dev Notes

### КРИТИЧНО: RLS-проблема на таблице profiles

**Проблема**: Существующий RLS (`001_create_profiles.sql`) разрешает SELECT только `auth.uid() = id`. Обычный `createClient()` (anon key + сессия) вернёт только запись текущего пользователя, а не всех участниц.

**Решение**: Миграция `024_admin_rls_for_profiles.sql`:

```sql
-- Создать SECURITY DEFINER функцию (аналог is_active_subscriber из 009_add_role_fix_admin_rls.sql)
-- SECURITY DEFINER нужен чтобы избежать рекурсии: политика на profiles не может делать
-- прямой subquery на profiles без SECURITY DEFINER функции-обёртки
CREATE OR REPLACE FUNCTION public.is_admin()
  RETURNS BOOLEAN
  LANGUAGE sql
  SECURITY DEFINER
  STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  );
$$;

-- Заменить существующую SELECT-политику: пользователь видит свой профиль ИЛИ admin видит все
DROP POLICY IF EXISTS "Пользователи видят только свой профиль" ON public.profiles;
CREATE POLICY "Users or admin can select profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id OR public.is_admin());

-- Заменить UPDATE-политику: пользователь обновляет свой профиль ИЛИ admin обновляет любой
DROP POLICY IF EXISTS "Пользователи обновляют только свой профиль" ON public.profiles;
CREATE POLICY "Users or admin can update profiles"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id OR public.is_admin())
  WITH CHECK (auth.uid() = id OR public.is_admin());
```

**Почему SECURITY DEFINER**: Функция `is_admin()` выполняется от имени владельца (postgres), что обходит RLS на profiles — иначе бы возникала бесконечная рекурсия при проверке политики profiles → subquery profiles. Этот же паттерн уже используется в `is_active_subscriber()` (миграция 009).

### Поля profiles для MemberProfile

Из `src/types/supabase.ts`, таблица `profiles.Row`:
```typescript
export interface MemberProfile {
  id: string
  email: string
  display_name: string | null
  created_at: string
  subscription_status: string | null
  current_period_end: string | null
  stripe_customer_id: string | null
}
```
Добавить в `src/features/admin/types.ts`.

### Логика ручного переключения доступа

"Bypass Stripe" = прямая запись в `profiles.subscription_status`:
- **Grant access** → `subscription_status = 'active'`
- **Revoke access** → `subscription_status = 'canceled'`

⚠️ **Задержка применения**: Middleware кэширует `subscription_status` в cookie `__sub_status` с TTL = 30 сек (константа `DEFAULT_SUBSCRIPTION_CACHE_TTL` в `auth-middleware.ts:14`). После ручного изменения статус применится при следующем запросе пользователя (макс. задержка 30 сек). Это ожидаемое поведение — в UI не нужно показывать «мгновенного» эффекта.

Активными считаются: `'active'` и `'trialing'` (см. `auth-middleware.ts:272-273`).

### Паттерн данных (RSC + Client)

Соответствует паттерну из `src/app/(admin)/settings/page.tsx`:

```
page.tsx (RSC) → fetchMembersServer() → MembersContainer (Client) → MembersTable (Dumb)
```

**Server API** (`membersServer.ts`):
```typescript
import { createClient } from '@/lib/supabase/server'  // await createClient()

export async function fetchMembersServer(): Promise<MemberProfile[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, display_name, created_at, subscription_status, current_period_end, stripe_customer_id')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}
```

**Client mutation** (`members.ts`):
```typescript
import { createClient } from '@/lib/supabase/client'  // без await, browser key

export async function toggleMemberAccess(userId: string, grantAccess: boolean): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('profiles')
    .update({ subscription_status: grantAccess ? 'active' : 'canceled' })
    .eq('id', userId)
  if (error) throw error
}
```

### Optimistic UI в MembersContainer

Паттерн из `FeedContainer` (optimistic update → rollback при ошибке):
```typescript
// 1. Оптимистично обновить локальный стейт
setMembers(prev => prev.map(m => m.id === userId ? { ...m, subscription_status: grantAccess ? 'active' : 'canceled' } : m))
// 2. Вызвать API
try {
  await toggleMemberAccess(userId, grantAccess)
} catch (err) {
  // 3. Rollback при ошибке
  setMembers(prev => prev.map(m => m.id === userId ? { ...m, subscription_status: oldStatus } : m))
  toast.error(...)  // Toast для системной ошибки (см. CLAUDE.md)
} finally {
  setTogglingId(null)
}
```

### UI-паттерн (MembersTable)

- **Активный статус**: `subscription_status IN ('active', 'trialing')` → badge "Aktivna" (зелёный), кнопка "Prekliči dostop"
- **Неактивный**: иное/null → badge "Neaktivna" (серый), кнопка "Omogoči dostop"
- **Skeleton**: при `isLoading=true` компонент рендерит skeleton-строки (см. CLAUDE.md — Skeletons встроены в Dumb-компоненты)
- **Touch target**: `min-h-[44px] min-w-[44px]` для всех кнопок (NFR14, CLAUDE.md)
- **Disabled state**: кнопка disabled + spinner пока `togglingId === member.id`

### Навигация AdminSidebar

Добавить в `adminNavItems` (файл `src/components/navigation/AdminSidebar.tsx`):
```typescript
{
  href: ADMIN_MEMBERS_PATH,  // '/members'
  label: 'Udeleženke',
  ariaLabel: 'Upravljanje udeleženk',
  icon: <svg .../>,       // outline icon (users)
  iconActive: <svg .../>, // filled icon (users)
}
```
Импортировать `ADMIN_MEMBERS_PATH` из `@/lib/app-routes`.

Расположение: между "Kategorije" и "Nastavitve" (логический порядок: контент → участницы → настройки).

### Project Structure Notes

```
supabase/migrations/
  024_admin_rls_for_profiles.sql   ← НОВЫЙ (критично для работы фичи)

src/lib/app-routes.ts              ← +ADMIN_MEMBERS_PATH

src/features/admin/
  types.ts                         ← +MemberProfile interface
  api/
    membersServer.ts               ← НОВЫЙ (RSC data fetching)
    members.ts                     ← НОВЫЙ (client mutation)
  components/
    MembersTable.tsx               ← НОВЫЙ (Dumb)
    MembersContainer.tsx           ← НОВЫЙ (Smart, 'use client')

src/app/(admin)/
  members/
    page.tsx                       ← НОВЫЙ (RSC)

src/components/navigation/
  AdminSidebar.tsx                 ← +Udeleženke nav item

tests/unit/
  features/admin/api/members.test.ts
  app/(admin)/members/page.test.tsx
  features/admin/components/MembersTable.test.tsx
  components/navigation/AdminSidebar.test.tsx  ← обновить (уже существует)
```

### Что НЕ делать

- **Не создавать отдельный service-role client** — достаточно RLS-миграции, `createClient()` из server.ts сработает
- **Не добавлять Stripe-запросы** — только прямое обновление `profiles.subscription_status`
- **Не маппить snake_case → camelCase** (ESLint запрещает, CLAUDE.md)
- **Не добавлять Zustand store** для этой фичи — локальный `useState` в `MembersContainer` достаточен
- **Не использовать Route Handler** для мутации — клиентский Supabase напрямую (архитектурная граница: client-side mutations через `lib/supabase/client.ts`)

### References

- Существующий RLS: `supabase/migrations/001_create_profiles.sql` (базовые политики) + `009_add_role_fix_admin_rls.sql` (паттерн SECURITY DEFINER + is_active_subscriber())
- Profiles schema: `src/types/supabase.ts` строки 262-303
- Admin layout (защита маршрута): `src/app/(admin)/layout.tsx`
- AdminSidebar: `src/components/navigation/AdminSidebar.tsx`
- app-routes: `src/lib/app-routes.ts`
- Settings page (паттерн RSC+Client): `src/app/(admin)/settings/page.tsx` + `src/features/admin/api/settingsServer.ts`
- Middleware — subscription_status логика: `src/lib/supabase/auth-middleware.ts:246-296`
- Test pattern: `tests/unit/features/admin/api/settings.test.ts`
- CLAUDE.md — Smart/Dumb pattern, snake_case, Toast vs inline errors, min touch targets

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Реализована миграция 024 с SECURITY DEFINER функцией `is_admin()` — аналог паттерна из `is_active_subscriber()` (миграция 009). Обе RLS политики (SELECT + UPDATE) расширены: пользователь видит/обновляет свой профиль ИЛИ admin видит/обновляет всё.
- Паттерн RSC+Client строго соответствует settings-странице: `page.tsx (RSC)` → `MembersContainer (Smart Client)` → `MembersTable (Dumb)`.
- Optimistic UI: при переключении доступа статус обновляется мгновенно, при ошибке — rollback + Toast (паттерн из FeedContainer).
- Skeleton встроен в MembersTable (prop `isLoading`) — не снаружи (CLAUDE.md).
- Все кнопки min-h-[44px] min-w-[44px] (NFR14).
- 22 новых теста (3 API + 2 RSC страница + 9 MembersTable + 8 AdminSidebar с новым пунктом).
- Существующий сбой в PostCard.test.tsx — pre-existing, не связан с историей 4.4.

### File List

supabase/migrations/024_admin_rls_for_profiles.sql
src/lib/app-routes.ts
src/features/admin/types.ts
src/features/admin/api/membersServer.ts
src/features/admin/api/members.ts
src/features/admin/components/MembersTable.tsx
src/features/admin/components/MembersContainer.tsx
src/app/(admin)/members/page.tsx
src/components/navigation/AdminSidebar.tsx
tests/unit/features/admin/api/members.test.ts
tests/unit/app/(admin)/members/page.test.tsx
tests/unit/features/admin/components/MembersTable.test.tsx
tests/unit/components/navigation/AdminSidebar.test.tsx

## Change Log

- 2026-03-30: Реализована Story 4.4 — мониторинг участниц и ручное управление доступом. Добавлены: миграция RLS (024), MemberProfile тип, server/client API, MembersTable/MembersContainer компоненты, RSC страница /members, nav-пункт Udeleženke в AdminSidebar, 22 теста.
