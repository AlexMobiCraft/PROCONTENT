# Story 4.5: Навигация в интерфейсе администратора

Status: done

## Story

As a автор (admin),
I want иметь удобную навигацию по всем разделам административного интерфейса,
So that перемещаться между страницами создания постов, управления категориями и настройками без ручного ввода URL.

## Acceptance Criteria

1. **AdminSidebar на страницах `/admin/*`:**
   **Given** авторизованный пользователь с ролью `admin` открывает любую страницу в `/admin/*`
   **When** страница рендерится
   **Then** отображается `AdminSidebar` с навигационными ссылками: "Nova objava" (`/admin/posts/create`), "Kategorije" (`/admin/categories`), "Nastavitve" (`/admin/settings`)
   **And** активный пункт меню выделен стилем `bg-muted text-foreground` (аналогично DesktopSidebar)
   **And** присутствует ссылка возврата "Aplikacija" → `/feed`

2. **Admin-секция в DesktopSidebar для пользователей с ролью admin:**
   **Given** авторизованный пользователь с ролью `admin` просматривает любую страницу в `(app)` layout на устройстве `md+`
   **When** рендерится `DesktopSidebar`
   **Then** в нижней части sidebar отображается секция "Administracija" с ссылками на `/admin/posts/create`, `/admin/categories`, `/admin/settings`
   **And** секция визуально отделена разделителем от основных пунктов навигации
   **And** для участниц без роли `admin` секция "Administracija" не отображается

3. **Мобильный доступ через ProfileScreen:**
   **Given** авторизованный пользователь с ролью `admin` открывает `/profile` на мобильном устройстве
   **When** `ProfileScreen` рендерится
   **Then** отображается секция "Administracija" с кнопками-ссылками: "Nova objava", "Kategorije", "Nastavitve"
   **And** для участниц без роли `admin` эта секция не отображается

4. **Доступность (a11y) и touch targets:**
   **Given** все навигационные элементы в `AdminSidebar` и admin-секции `DesktopSidebar`
   **When** они рендерятся
   **Then** каждый пункт имеет `min-h-[44px] min-w-[44px]`
   **And** каждый элемент имеет `aria-label`
   **And** активный элемент помечен `aria-current="page"`

5. **Безопасность не нарушена (регрессия):**
   **Given** добавление AdminSidebar и admin-секций в навигацию
   **When** участница без роли `admin` открывает страницу `/admin/*`
   **Then** проверка в `(admin)/layout.tsx` (`profile.role !== 'admin' → redirect('/feed')`) работает без изменений
   **And** отображение admin-ссылок в DesktopSidebar и ProfileScreen — только UI-подсказки, не обходят серверную защиту

## Tasks / Subtasks

- [x] Task 1: Создать `AdminSidebar` компонент (AC: 1, 4)
  - [x] 1.1: Добавить константы admin-маршрутов в `src/lib/app-routes.ts` (`ADMIN_POSTS_CREATE_PATH`, `ADMIN_CATEGORIES_PATH`, `ADMIN_SETTINGS_PATH`)
  - [x] 1.2: Создать `src/components/navigation/AdminSidebar.tsx` — server-compatible `'use client'` компонент, `usePathname()` для active state, паттерн 1:1 с `DesktopSidebar` (иконки SVG, `cn()`, `Link`, `aria-current`)

- [x] Task 2: Интегрировать `AdminSidebar` в `(admin)/layout.tsx` (AC: 1)
  - [x] 2.1: Обновить `src/app/(admin)/layout.tsx` — добавить flex-обёртку `md:flex`, слева `AdminSidebar` (`hidden md:flex`, `w-[245px]`), справа `<main>{children}</main>`
  - [x] 2.2: Проверить, что мобильное отображение admin-страниц работает корректно (только `children`, без боковой панели)

- [x] Task 3: Admin-секция в `DesktopSidebar` (AC: 2, 4)
  - [x] 3.1: Добавить проп `isAdmin?: boolean` в `DesktopSidebar`
  - [x] 3.2: В `src/app/(app)/layout.tsx` запросить `profiles.role` для текущего пользователя, передать `isAdmin={profile?.role === 'admin'}` в `DesktopSidebar`
  - [x] 3.3: В `DesktopSidebar` добавить визуальный разделитель (`<hr className="border-border mx-3 my-2" />`) и секцию "Administracija" — показывается только при `isAdmin=true`

- [x] Task 4: Мобильная точка входа в `ProfileScreen` (AC: 3, 4)
  - [x] 4.1: Добавить проп `isAdmin?: boolean` в интерфейс `ProfileScreenProps`
  - [x] 4.2: В `src/app/(app)/profile/page.tsx` передать `isAdmin={profile?.role === 'admin'}` в `ProfileScreen`
  - [x] 4.3: В `ProfileScreen` добавить секцию с card-стилем, заголовком "Administracija" и кнопками-ссылками — только при `isAdmin=true`

- [x] Task 5: Тесты (AC: 1–5)
  - [x] 5.1: Юнит-тест `AdminSidebar` — рендер ссылок, активный пункт (`aria-current="page"`), a11y
  - [x] 5.2: Юнит-тест `DesktopSidebar` — с `isAdmin=true` показывает секцию, с `isAdmin=false` или без пропа — скрывает
  - [x] 5.3: Юнит-тест `ProfileScreen` — с `isAdmin=true` показывает admin-секцию, без — нет

## Dev Notes

### Контекст проблемы

Обнаружено в ходе реализации Story 4.3: `(admin)` — отдельная route group, не наследует `(app)/layout.tsx`. Когда admin открывает `/admin/categories` или `/admin/settings`, нет **никакой навигации** — только контент страницы. Администратор вынужден вручную набирать URL.

### Архитектурные ограничения

- `(admin)` и `(app)` — **разные route groups**. `DesktopSidebar`/`MobileNav` рендерятся только в `(app)/layout.tsx`.
- `(admin)/layout.tsx` сейчас — только auth guard + `AuthProvider`. Не рендерит никакой UI кроме `{children}`.
- `MobileNav` — **только для `(app)` route group** (рендерится в `(app)/layout.tsx`), admin-страницы в `(admin)` его не получают.

### Паттерны реализации

#### AdminSidebar (новый компонент)

```tsx
// src/components/navigation/AdminSidebar.tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { ADMIN_POSTS_CREATE_PATH, ADMIN_CATEGORIES_PATH, ADMIN_SETTINGS_PATH } from '@/lib/app-routes'

// Иконки аналогично DesktopSidebar — SVG из heroicons (outline/solid)
// UI-лейблы на словенском языке!
const adminNavItems = [
  { href: ADMIN_POSTS_CREATE_PATH, label: 'Nova objava', ... },
  { href: ADMIN_CATEGORIES_PATH, label: 'Kategorije', ... },
  { href: ADMIN_SETTINGS_PATH, label: 'Nastavitve', ... },
]
```

- Паттерн `isActive = pathname.startsWith(item.href)` (аналогично `DesktopSidebar`)
- Верхний блок brand "PROCONTENT" — дублировать НЕ нужно, либо показывать простой заголовок "Admin"
- Ссылка "Aplikacija" (`/feed`) вверху или внизу — с иконкой стрелки

#### Обновление `(admin)/layout.tsx`

```tsx
// (admin)/layout.tsx — ДО: AuthProvider > {children}
// ПОСЛЕ:
return (
  <AuthProvider user={user} session={session}>
    <div className="md:flex md:min-h-screen">
      <AdminSidebar />          {/* hidden на mobile, показывается md+ */}
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  </AuthProvider>
)
```

#### Обновление `(app)/layout.tsx`

```tsx
// Добавить запрос role — profile уже нужен для subscription check в middleware
const { data: profile } = await supabase
  .from('profiles')
  .select('role')
  .eq('id', user.id)
  .maybeSingle()

// Передать в DesktopSidebar
<DesktopSidebar isAdmin={profile?.role === 'admin'} />
```

**ВАЖНО:** `(app)/layout.tsx` сейчас **не** делает отдельный запрос к `profiles`. Нужно добавить запрос `profiles.role`. Не добавлять лишних полей — только `role`.

#### Admin-секция в DesktopSidebar

```tsx
// В конце <nav>
{isAdmin && (
  <>
    <hr className="border-border mx-3 my-2" />
    <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
      Administracija
    </p>
    {adminItems.map(...)}  {/* те же иконки и паттерн, что в AdminSidebar */}
  </>
)}
```

**Иконки для admin-пунктов** (из Heroicons):
- "Nova objava" → `PencilSquare` / `PlusCircle`
- "Kategorije" → `Tag`
- "Nastavitve" → `Cog6Tooth`

#### ProfileScreen — мобильный доступ

```tsx
// ProfileScreen добавить секцию в конце JSX при isAdmin=true
{isAdmin && (
  <section className="rounded-xl border border-border bg-card p-6 space-y-3">
    <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
      Administracija
    </h2>
    <Link href={ADMIN_POSTS_CREATE_PATH} className="flex min-h-[44px] items-center gap-3 ...">
      Nova objava
    </Link>
    {/* ... Kategorije, Nastavitve */}
  </section>
)}
```

### File Structure & Integration Points

#### Файлы, которые нужно изменить

- `src/lib/app-routes.ts` — добавить константы ADMIN_*_PATH
- `src/app/(app)/layout.tsx` — добавить запрос `profiles.role`, передать `isAdmin` в DesktopSidebar
- `src/components/navigation/DesktopSidebar.tsx` — добавить проп `isAdmin`, conditional секцию admin
- `src/app/(admin)/layout.tsx` — добавить обёртку с AdminSidebar
- `src/app/(app)/profile/page.tsx` — передать `isAdmin` в ProfileScreen
- `src/features/profile/components/ProfileScreen.tsx` — добавить проп `isAdmin`, секция admin-ссылок

#### Новые файлы

- `src/components/navigation/AdminSidebar.tsx` — новый компонент (аналог DesktopSidebar)

### UX и продуктовые ограничения

- **Все лейблы в UI — на словенском языке:** `Nova objava`, `Kategorije`, `Nastavitve`, `Administracija`, `Aplikacija`
- **Нет мобильного AdminSidebar:** на мобильном admin-страницы не имеют боковой панели. Вход — только через Profile или прямой URL. Нет бургер-меню.
- **Паттерн "скрытая вкладка в профиле"** (из UX-спецификации Journey 3): admin-функции доступны через Profile, а не как отдельная вкладка нижней навигации.
- **Не добавлять admin-вкладку в `MobileNav`** (нижняя навигация): UX-спецификация явно запрещает это, задокументировав паттерн доступа через профиль.
- **Минимальный touch target:** `min-h-[44px] min-w-[44px]` на всех кликабельных элементах.

### Previous Story Intelligence

#### Из Story 4.1–4.3

- `(admin)/layout.tsx` — существующий guard, **не ломать** проверку `profile?.role !== 'admin'`
- В Story 4.3 уже создана страница `/admin/settings`. Убедись, что AdminSidebar там выглядит органично.
- Паттерн `createClient()` в RSC-layout-ах: `await createClient()` для server-side.
- Toast/inline error handling в admin-компонентах — единый стиль из 4.1–4.3.

#### Из DesktopSidebar

- Компонент уже `'use client'`, использует `usePathname()` и `cn()`.
- Паттерн `isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href)` — переиспользовать в `AdminSidebar`.
- Размер sidebar: `w-[245px]`, высота: `h-screen sticky top-0`.

### Testing Requirements

#### AdminSidebar тесты

```typescript
// tests/unit/components/navigation/AdminSidebar.test.tsx
// - рендер всех 3 nav-пунктов + ссылки 'Aplikacija'
// - активный пункт при pathname=/admin/categories → aria-current="page" на "Kategorije"
// - визуальный класс active (bg-muted) на активном пункте
// - все элементы имеют aria-label
```

#### DesktopSidebar тесты

```typescript
// tests/unit/components/navigation/DesktopSidebar.test.tsx
// - с isAdmin=true: секция 'Administracija' видна, 3 admin-ссылки присутствуют
// - с isAdmin=false или без пропа: секция 'Administracija' отсутствует
// - основные пункты навигации (Domov, Objave, Iskanje, Profil) присутствуют в обоих случаях
```

#### ProfileScreen тесты

```typescript
// tests/unit/features/profile/components/ProfileScreen.test.tsx (обновить)
// - с isAdmin=true: секция 'Administracija' видна, 3 admin-ссылки присутствуют
// - с isAdmin=false или без пропа: секция 'Administracija' отсутствует
// - существующие тесты ProfileScreen не должны сломаться
```

### Project Structure Notes

- `src/components/navigation/` — правильное место для `AdminSidebar.tsx` (рядом с `DesktopSidebar.tsx` и `MobileNav.tsx`)
- **БАН:** `src/components/ui/` не может импортировать из `src/features/` — не нарушать
- Admin-маршруты логично держать в `src/lib/app-routes.ts` рядом с `DEFAULT_AUTH_REDIRECT_PATH` и т.д.
- **Нет новых API-вызовов и миграций БД** — чисто UI/навигационная история

### References

- [Source] `src/app/(admin)/layout.tsx` — текущий admin auth guard
- [Source] `src/components/navigation/DesktopSidebar.tsx` — паттерн для AdminSidebar
- [Source] `src/components/navigation/MobileNav.tsx` — паттерн для мобильного nav
- [Source] `src/app/(app)/layout.tsx` — точка интеграции isAdmin → DesktopSidebar
- [Source] `src/app/(app)/profile/page.tsx` — передача isAdmin в ProfileScreen
- [Source] `src/features/profile/components/ProfileScreen.tsx` — место мобильного admin-раздела
- [Source] `src/lib/app-routes.ts` — константы маршрутов
- [Source] `_bmad-output/planning-artifacts/ux-design-specification.md#3. Content Creation & Admin (Journey 3)`
- [Source] `_bmad-output/planning-artifacts/epics.md#Epic 4: Creator Operations`
- [Source] `_bmad-output/stories/4-3-managing-content-for-onboarding-and-landing.md` — предыдущая story, паттерны

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

_Нет_

### Completion Notes List

- Реализован `AdminSidebar` — новый `'use client'` компонент, аналог `DesktopSidebar`: sticky, `w-[245px]`, `hidden md:flex`, 3 nav-пункта + ссылка "Aplikacija" → `/feed`, активный пункт через `pathname.startsWith()`, `aria-current="page"`, `min-h-[44px]`.
- `(admin)/layout.tsx` обновлён: добавлена flex-обёртка `md:flex md:min-h-screen`, слева `AdminSidebar` (скрыт на mobile), справа `<main>`. Серверная защита `profile?.role !== 'admin'` не тронута.
- `DesktopSidebar` расширен пропом `isAdmin?: boolean`: при `isAdmin=true` показывает разделитель `<hr>` и секцию "Administracija" с 3 ссылками (Nova objava, Kategorije, Nastavitve), иконки Heroicons SVG.
- `(app)/layout.tsx` запрашивает `profiles.role` для текущего пользователя, передаёт `isAdmin` в `DesktopSidebar`.
- `ProfileScreen` расширен пропом `isAdmin?: boolean`: при `isAdmin=true` рендерит секцию "Administracija" с 3 ссылками-кнопками (min-h-[44px], aria-label).
- `profile/page.tsx` передаёт `isAdmin={profile?.role === 'admin'}` в `ProfileScreen`.
- Тесты: 7 тестов `AdminSidebar`, 7 тестов `DesktopSidebar`, 5 новых тестов `ProfileScreen` (+ существующие не сломаны), исправлены pre-existing ошибки в `layout.test.tsx` и `profile/page.test.tsx` (mock `maybeSingle`).
- Итого: 1057/1057 тестов, 70/70 test files — ✅

### File List

- `src/lib/app-routes.ts` (изменён)
- `src/components/navigation/AdminSidebar.tsx` (создан)
- `src/app/(admin)/layout.tsx` (изменён)
- `src/components/navigation/DesktopSidebar.tsx` (изменён)
- `src/app/(app)/layout.tsx` (изменён)
- `src/features/profile/components/ProfileScreen.tsx` (изменён)
- `src/app/(app)/profile/page.tsx` (изменён)
- `tests/unit/components/navigation/AdminSidebar.test.tsx` (создан)
- `tests/unit/components/navigation/DesktopSidebar.test.tsx` (создан)
- `tests/unit/features/profile/components/ProfileScreen.test.tsx` (изменён)
- `tests/unit/app/(app)/layout.test.tsx` (исправлен mock — pre-existing)
- `tests/unit/app/(app)/profile/page.test.tsx` (исправлен mock — pre-existing)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (обновлён)
