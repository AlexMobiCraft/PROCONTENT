---
title: 'Login с сохранением оригинального URL (redirectTo)'
type: 'feature'
created: '2026-06-14'
status: 'done'
baseline_commit: 'd3ab9628fb4fb88c4e8e639b726344b620764324'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Незалогиненный пользователь, кликнувший по прямой ссылке на пост (например из email-уведомления `/feed/<id>`), редиректится прокси на `/login`, но после входа попадает на дефолтный `/feed` — оригинальная ссылка теряется.

**Approach:** Прокси при редиректе на `/login` добавляет `?redirectTo=<исходный_путь>`. После успешного `signInWithPassword` клиент читает и валидирует `redirectTo` из URL и навигирует туда; при отсутствии/невалидности — стандартный дефолт (`/feed`). Валидация — единый чистый хелпер, защищающий от open-redirect и зацикливания.

## Boundaries & Constraints

**Always:**
- `redirectTo` принимается ТОЛЬКО как относительный путь: начинается с `/` и НЕ начинается с `//` (и не с `/\`).
- Значение декодируется через `decodeURIComponent` перед проверкой; при исключении декодирования — отбрасывается.
- `redirectTo`, равный `/login` или `/register` (с любым query/без), отбрасывается (анти-цикл).
- Передача через URL query param. НЕ cookie, НЕ localStorage.
- Прокси добавляет `redirectTo` только когда путь НЕ публичный и НЕ сам `/login`.

**Ask First:**
- Расширение флоу на уже-залогиненного пользователя на `/login` (прокси `auth-middleware.ts:155`) или на server-guard `login/page.tsx` — если потребуется выходить за рамки «после входа неавторизованного».

**Never:**
- НЕ трогать `/auth/confirm` и email-confirmation флоу.
- НЕ трогать magic link / OAuth.
- НЕ передавать `redirectTo` в Supabase `redirectTo`/`emailRedirectTo`.
- НЕ давать незарегистрированным пользователям открыть пост (остаются на `/login`).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Неавторизованный на защищённом пути | `GET /feed/abc`, нет сессии | Прокси → 307 на `/login?redirectTo=%2Ffeed%2Fabc` | N/A |
| Вход с валидным redirectTo | `/login?redirectTo=/feed/abc`, успешный логин | `router.push('/feed/abc')` | N/A |
| Вход без redirectTo | `/login`, успешный логин | `router.push('/feed')` (дефолт) | N/A |
| Open-redirect | `redirectTo=//evil.com` или `/\evil.com` | отброшен → дефолт `/feed` | санитайз → null |
| Анти-цикл | `redirectTo=/login` или `/register` | отброшен → дефолт `/feed` | санитайз → null |
| Битый encoding | `redirectTo=%E0%A4%A` | отброшен → дефолт `/feed` | catch → null |
| Абсолютный URL | `redirectTo=https://evil.com` | отброшен (не с `/`) → дефолт | санитайз → null |

</frozen-after-approval>

## Code Map

- `src/lib/app-routes.ts` -- добавить чистый хелпер `sanitizeRedirectPath(raw)`; здесь же `LOGIN_PATH`, `getAuthSuccessRedirectPath`, `isPublicPath`.
- `src/lib/supabase/auth-middleware.ts` -- блок редиректа неавторизованного на `/login` (строки 161–165, и env-missing 119–127); добавить `?redirectTo`.
- `src/features/auth/components/AuthContainer.tsx` -- содержит реальную логику входа (`useSearchParams`, `router.push('/feed')` на строке 59). Заменить на чтение+санитайз `redirectTo`.
- `src/features/auth/components/LoginForm.tsx` -- dumb-компонент, НЕ трогать (логика не здесь).
- `tests/unit/lib/app-routes.test.ts` -- добавить тесты `sanitizeRedirectPath`.
- `tests/unit/middleware.test.ts` -- обновить ассерты Location (теперь с `?redirectTo=`), добавить кейс.
- `tests/unit/features/auth/components/AuthContainer.test.tsx` -- добавить кейс навигации с redirectTo.

## Tasks & Acceptance

**Execution:**
- [x] `src/lib/app-routes.ts` -- добавить и экспортировать `sanitizeRedirectPath(raw: string | null | undefined): string | null`: декодирует, проверяет `startsWith('/')`, отвергает `//`/`/\`, отвергает `/login` и `/register` (точное совпадение или с `?`-суффиксом), иначе возвращает путь.
- [x] `src/lib/supabase/auth-middleware.ts` -- в обоих блоках редиректа неавторизованного на `/login` устанавливать `url.search = ''` затем `url.searchParams.set('redirectTo', request.nextUrl.pathname + request.nextUrl.search)`. НЕ добавлять для уже-`/login`.
- [x] `src/features/auth/components/AuthContainer.tsx` -- после успешного входа: `const target = sanitizeRedirectPath(searchParams.get('redirectTo')) ?? getAuthSuccessRedirectPath()`; `router.push(target)`.
- [x] `tests/unit/lib/app-routes.test.ts` -- юнит-тесты на матрицу edge-cases `sanitizeRedirectPath`.
- [x] `tests/unit/middleware.test.ts` -- обновить существующие ассерты Location на `/login?redirectTo=...` и добавить проверку кодирования пути.
- [x] `tests/unit/features/auth/components/AuthContainer.test.tsx` -- кейс: при `redirectTo=/feed/abc` → `router.push('/feed/abc')`; при невалидном → `/feed`.

**Acceptance Criteria:**
- Given неавторизованный пользователь, when он открывает `/feed/<id>`, then прокси редиректит на `/login?redirectTo=%2Ffeed%2F<id>`.
- Given пользователь на `/login?redirectTo=/feed/<id>`, when вход успешен, then происходит `router.push('/feed/<id>')`.
- Given `redirectTo` отсутствует/невалиден/external/цикличен, when вход успешен, then `router.push('/feed')` (дефолт).
- Given неавторизованный пользователь, when он на `/login` без сессии, then прокси НЕ добавляет повторный `redirectTo` и не зацикливается.

## Design Notes

`getAuthSuccessRedirectPath()` в клиентском компоненте резолвится в `DEFAULT_AUTH_REDIRECT_PATH` (`/feed`), т.к. `AUTH_SUCCESS_REDIRECT_PATH` — серверный env (не `NEXT_PUBLIC_`). Это совпадает с текущим поведением (хардкод `'/feed'`) — используем хелпер для семантики.

Эскиз хелпера:
```ts
export function sanitizeRedirectPath(raw: string | null | undefined): string | null {
  if (!raw) return null
  let decoded: string
  try { decoded = decodeURIComponent(raw) } catch { return null }
  if (!decoded.startsWith('/')) return null
  if (decoded.startsWith('//') || decoded.startsWith('/\\')) return null
  const base = decoded.split('?')[0]
  if (base === LOGIN_PATH || base === '/register') return null
  return decoded
}
```

## Verification

**Commands:**
- `npm run test -- middleware app-routes AuthContainer` -- expected: все тесты зелёные, включая новые.
- `npm run typecheck` -- expected: без ошибок.
- `npm run lint` -- expected: без ошибок.

## Suggested Review Order

**Логика валидации (ядро безопасности)**

- Чистый санитайз: декод + защита от open-redirect и зацикливания — единственный источник истины.
  [`app-routes.ts:43`](../../src/lib/app-routes.ts#L43)

**Постановка redirectTo (прокси)**

- Основной редирект неавторизованного: сохраняет исходный путь+query перед уходом на /login.
  [`auth-middleware.ts:169`](../../src/lib/supabase/auth-middleware.ts#L169)

- Та же логика в fail-secure ветке отсутствия Supabase env — для консистентности.
  [`auth-middleware.ts:125`](../../src/lib/supabase/auth-middleware.ts#L125)

**Потребление redirectTo (вход)**

- После успешного входа: валидный redirectTo или дефолт; заменяет хардкод `/feed`.
  [`AuthContainer.tsx:61`](../../src/features/auth/components/AuthContainer.tsx#L61)

**Тесты**

- Матрица edge-cases санитайза (open-redirect, циклы, битый encoding).
  [`app-routes.test.ts:30`](../../tests/unit/lib/app-routes.test.ts#L30)

- Кодирование пути поста с query в redirectTo (сценарий email-ссылки).
  [`middleware.test.ts:172`](../../tests/unit/middleware.test.ts#L172)

- Навигация на валидный/невалидный redirectTo после входа.
  [`AuthContainer.test.tsx:94`](../../tests/unit/features/auth/components/AuthContainer.test.tsx#L94)
