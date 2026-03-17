# Story 1.8: Сброс и восстановление пароля (Forgot Password)

Status: in-progress

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a участница,
I want запросить ссылку для сброса пароля, если я его забыла,
so that восстановить доступ к своему профилю.

## Acceptance Criteria

1. **Given** страница авторизации (`/login`)
   **When** пользователь нажимает "Забыли пароль?" и вводит свой email
   **Then** система отправляет письмо со ссылкой для сброса пароля (через Supabase Auth)
2. **And** при переходе по ссылке из письма открывается страница `Update Password`
3. **And** после ввода нового пароля происходит обновление credentials и авторизация
4. **And** если email не существует в системе, пользователь видит нейтральное сообщение "Если email зарегистрирован, вы получите письмо" (prevent user enumeration)

## Tasks / Subtasks

- [x] Создать UI для запроса сброса пароля (страница `/forgot-password` или форма на `/login`)
  - [x] Реализовать форму с полем email и кнопкой отправки
  - [x] Интегрировать метод `supabase.auth.resetPasswordForEmail`
  - [x] Убедиться, что `redirectTo` указывает на `[origin]/auth/confirm?type=recovery` (согласно логике в `route.ts`)
  - [x] Реализовать защиту от user enumeration: всегда показывать успешное сообщение "Если email зарегистрирован, вы получите письмо со ссылкой для сброса пароля"
- [x] Создать страницу обновления пароля (`/update-password`)
  - [x] Реализовать форму ввода нового пароля (с подтверждением)
  - [x] Интегрировать метод `supabase.auth.updateUser` для обновления пароля
  - [x] После успешного обновления перенаправить пользователя в личный кабинет / ленту
- [x] Обработка ошибок
  - [x] Использовать инлайн-баннеры для вывода системных ошибок (например, проблем с сетью)
  - [x] Инлайн-валидация длины пароля и совпадения полей

### Review Follow-ups (AI)
- [ ] [AI-Review][HIGH] Заменить нативные теги `<a>` на компонент `Link` из `next/link` в `AuthContainer.tsx` и `ForgotPasswordForm.tsx` (включая состояние успеха) для корректной SPA-навигации [src/features/auth/components/AuthContainer.tsx:84-90][src/features/auth/components/ForgotPasswordForm.tsx:66-71][src/features/auth/components/ForgotPasswordForm.tsx:138-143]
- [ ] [AI-Review][MEDIUM] Пропускать логику синхронизации со Stripe (запросы API и обновление профиля) при подтверждении токена с `type='recovery'` [src/app/auth/confirm/route.ts:75-168]
- [ ] [AI-Review][MEDIUM] Очищать таймер (clearTimeout) в useEffect или использовать другой подход для предотвращения попыток обновления состояния/роутера при размонтировании компонента во время задержки редиректа [src/features/auth/components/UpdatePasswordForm.tsx:68-73]
- [x] [AI-Review][CRITICAL] Исправить падающие тесты в UpdatePasswordForm.test.tsx - добавить заполнение поля подтверждения пароля [tests/unit/features/auth/components/UpdatePasswordForm.test.tsx:76-87]
- [x] [AI-Review][CRITICAL] Создать тесты для ForgotPasswordForm.tsx и forgot-password страницы [tests/unit/features/auth/components/]
- [x] [AI-Review][MEDIUM] Исправить ложное утверждение в задаче про Toasts - либо реализовать Toasts, либо изменить текст задачи на "инлайн-баннеры" [src/features/auth/components/ForgotPasswordForm.tsx:77-84]
- [x] [AI-Review][LOW] Оптимизировать состояние isLoading в ForgotPasswordForm.tsx - сбрасывать перед setSubmitted(true) [src/features/auth/components/ForgotPasswordForm.tsx:41-42]
- [x] [AI-Review][HIGH] Обработать истекший токен восстановления в UpdatePasswordForm - добавить проверку на invalid token и редирект на /login с сообщением "Срок действия ссылки истёк" [src/features/auth/components/UpdatePasswordForm.tsx:44-47]
- [x] [AI-Review][HIGH] Добавить router.refresh() после успешного updatePassword для синхронизации RSC кэша [src/features/auth/components/UpdatePasswordForm.tsx:49]
- [x] [AI-Review][MEDIUM] Добавить кнопку "Ввести другой email" в ForgotPasswordForm после успешной отправки [src/features/auth/components/ForgotPasswordForm.tsx:46-64]
- [x] [AI-Review][MEDIUM] Добавить уведомление об успешном изменении пароля перед редиректом в UpdatePasswordForm [src/features/auth/components/UpdatePasswordForm.tsx:49]
- [x] [AI-Review][LOW] Улучшить валидацию email с помощью регулярного выражения [src/features/auth/components/ForgotPasswordForm.tsx:23-26]
- [x] [AI-Review][HIGH] Обновить useAuthStore после успешной установки пароля в UpdatePasswordForm - синхронизировать состояние клиента с новой сессией [src/features/auth/components/UpdatePasswordForm.tsx:57-59]
- [x] [AI-Review][HIGH] Добавить серверную проверку сессии на странице /update-password - редиректить неавторизованных на /login [src/app/(public)/update-password/page.tsx:8-16]
- [x] [AI-Review][MEDIUM] Добавить задержку 2 секунды перед редиректом на /feed после успешного обновления пароля - пользователь должен увидеть сообщение об успехе [src/features/auth/components/UpdatePasswordForm.tsx:57-59]
- [x] [AI-Review][LOW] Оптимизировать сброс validationError в ForgotPasswordForm - сбрасывать только при корректном вводе, а не при любом onChange [src/features/auth/components/ForgotPasswordForm.tsx:109]
- [x] [AI-Review][CRITICAL] Добавить `/forgot-password` в массив `PUBLIC_PATHS` для предотвращения редиректа [src/lib/app-routes.ts:6]
- [x] [AI-Review][MEDIUM] Обработать параметр `error=link-expired` и показывать сообщение "Срок действия ссылки истёк" [src/features/auth/components/AuthContainer.tsx:19-24]
- [x] [AI-Review][LOW] Перенести `setIsLoading(false)` после обновления состояния сессии, чтобы предотвратить преждевременную разблокировку формы [src/features/auth/components/UpdatePasswordForm.tsx:46]
- [x] [AI-Review][LOW] Добавить тесты в middleware для маршрута `/forgot-password` [tests/unit/middleware.test.ts:130]
- [x] [AI-Review][HIGH] Исправить обработку истекшей ссылки в /auth/confirm - при ошибке verifyOtp редиректить с error=link-expired вместо auth_callback_error_v2 [src/app/auth/confirm/route.ts:171-177]
- [x] [AI-Review][MEDIUM] Заменить захардкоженный /feed на getAuthSuccessRedirectPath() в UpdatePasswordForm [src/features/auth/components/UpdatePasswordForm.tsx:69]
- [x] [AI-Review][LOW] Сбрасывать networkError при раннем выходе из handleSubmit в ForgotPasswordForm [src/features/auth/components/ForgotPasswordForm.tsx:19-27]
- [x] [AI-Review][LOW] Переместить router.refresh() внутрь setTimeout в UpdatePasswordForm для предотвращения мерцания UI [src/features/auth/components/UpdatePasswordForm.tsx:68-69]

## Dev Notes

- **Архитектурные паттерны:** Используйте Feature-based подход. Компоненты для сброса и обновления пароля должны находиться в `src/features/auth/components/`. 
- **Обработчик ссылок:** В `src/app/auth/confirm/route.ts` уже предусмотрена обработка ссылок с `type=recovery`. При переходе по такой ссылке происходит валидация `token_hash` и автоматический редирект на `/update-password`.
- **Состояние и безопасность:** Страница `/update-password` должна быть доступна только для пользователей с активной сессией восстановления. Supabase Auth автоматически устанавливает временную сессию после перехода по ссылке recovery.
- **Dumb/Smart Компоненты:** Формы должны быть разделены на Smart-контейнеры (работающие с Supabase) и Dumb-компоненты визуализации.

### Критические ловушки и уроки (Next.js 16 + Supabase Auth)
- **Ловушка с `proxy.ts` (Next.js 16):** В Next.js 16 вместо `middleware.ts` используется `proxy.ts`. Ссылка для восстановления пароля содержит одноразовый `token_hash`. Если `proxy.ts` вызовет `updateSession` до того, как `/auth/confirm` успеет обработать токен — он будет израсходован и верификация провалится с ошибкой "invalid token". **Обязательно убедитесь, что `proxy.ts` пропускает маршрут `/auth/confirm`**.
- **Env Guards в Route Handlers:** Любые проверки переменных окружения (Supabase URL/Keys) в обработчиках маршрутов (например, `/auth/confirm`) должны выполняться **до блока `try/catch`**. Иначе ошибка отсутствующего ключа поглотится и пользователь получит непредсказуемое поведение вместо понятного редиректа.

### Project Structure Notes

- Страницы: `src/app/(public)/forgot-password/page.tsx`, `src/app/(public)/update-password/page.tsx`
- Компоненты фичи: `src/features/auth/components/ForgotPasswordForm.tsx`, `src/features/auth/components/UpdatePasswordForm.tsx`
- Клиентский инстанс Supabase: `lib/supabase/client.ts`

### References

- PRD & Epics: `_bmad-output/planning-artifacts/epics.md#Story 1.8`
- Route handler: `@src/app/auth/confirm/route.ts:34-36` (Логика редиректа для `type=recovery`)
- Architecture Guidelines: `_bmad-output/planning-artifacts/architecture.md#Pattern Categories Defined`

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- ✅ Resolved review finding [HIGH]: UpdatePasswordForm — импортированы `useAuthStore` и `createClient`; после успешного `updatePassword` вызывается `supabase.auth.getSession()`, затем `setSession(session)` и `setUser(session?.user ?? null)`. Покрыто тестом `обновляет useAuthStore после успешного обновления пароля`.
- ✅ Resolved review finding [HIGH]: `/update-password/page.tsx` стала async Server Component; перед рендером вызывается `createClient().auth.getSession()` — если сессии нет, `redirect('/login')`. Создан тест `tests/unit/app/(public)/update-password/page.test.tsx` (2 теста).
- ✅ Resolved review finding [MEDIUM]: UpdatePasswordForm — редирект на `/feed` перенесён в `setTimeout(..., 2000)`. Тест проверяет: success message появляется, push не вызван немедленно, через 2с push вызывается.
- ✅ Resolved review finding [LOW]: ForgotPasswordForm `onChange` — `setValidationError(null)` вызывается только когда email проходит regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`. Тест обновлён: typing `valid@example.com` очищает ошибку, typing `notvalid` — нет.
- ✅ Resolved review finding [CRITICAL]: Исправлены тесты UpdatePasswordForm — добавлено заполнение confirm-поля в тестах на API-ошибку и успешный редирект; добавлен тест мисматча паролей. 6 тестов, все проходят.
- ✅ Resolved review finding [CRITICAL]: Создан ForgotPasswordForm.test.tsx — 7 тестов: рендер, пустой email, некорректный email, сетевая ошибка API, anti-enumeration success, ссылка возврата после отправки, сброс ошибки при вводе.
- ✅ Resolved review finding [MEDIUM]: Текст задачи исправлен: "Использовать Toasts" → "Использовать инлайн-баннеры" — соответствует реализации.
- ✅ Resolved review finding [LOW]: isLoading в ForgotPasswordForm перемещён в error-ветку; на success-пути сбрасывается в одном ре-рендере с setSubmitted(true).
- ✅ Resolved review finding [HIGH]: UpdatePasswordForm — проверка expired/invalid/session в ошибке API → router.push('/login?error=link-expired'). Покрыто 2 тестами.
- ✅ Resolved review finding [HIGH]: UpdatePasswordForm — добавлен router.refresh() после успешного updatePassword; success-состояние показывает "Пароль обновлён" перед редиректом. Покрыто 2 тестами.
- ✅ Resolved review finding [MEDIUM]: ForgotPasswordForm — кнопка "Ввести другой email" в success-состоянии сбрасывает submitted→false и возвращает форму. Покрыто 2 тестами.
- ✅ Resolved review finding [MEDIUM]: UpdatePasswordForm — success-состояние с сообщением "Пароль обновлён / успешно изменён" выводится перед router.push('/feed').
- ✅ Resolved review finding [LOW]: ForgotPasswordForm — валидация email усилена regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` дополнительно к typeMismatch. Покрыто 1 тестом.
- ✅ Resolved review finding [CRITICAL]: `/forgot-password` добавлен в PUBLIC_PATHS в `app-routes.ts`. Покрыто 2 тестами в middleware (unauth + fail-secure without env).
- ✅ Resolved review finding [MEDIUM]: AuthContainer обрабатывает `?error=link-expired` → показывает "Срок действия ссылки истёк. Запросите новую ссылку для сброса пароля." Покрыто 1 тестом.
- ✅ Resolved review finding [LOW]: `setIsLoading(false)` в UpdatePasswordForm перенесён после `setUser(...)` — форма остаётся задизейблена пока сессия синхронизируется. Существующие тесты проходят.
- ✅ Resolved review finding [LOW]: Добавлено 2 теста в middleware.test.ts — "пропускает на /forgot-password без редиректа" (в блоке `неавторизованный пользователь` и в блоке `fail-secure`).
- ✅ Resolved review finding [HIGH]: /auth/confirm — при ошибке verifyOtp и type=recovery редирект теперь идёт с error=link-expired вместо auth_callback_error_v2. Покрыто 1 тестом в route.test.ts.
- ✅ Resolved review finding [MEDIUM]: UpdatePasswordForm — router.push использует getAuthSuccessRedirectPath() вместо захардкоженного '/feed'. Импорт добавлен.
- ✅ Resolved review finding [LOW]: ForgotPasswordForm — setNetworkError(null) вызывается при каждом handleSubmit до ранних return, сетевая ошибка сбрасывается при валидационных проверках. Покрыто 1 тестом.
- ✅ Resolved review finding [LOW]: UpdatePasswordForm — router.refresh() перенесён внутрь setTimeout вместе с router.push, оба вызываются после 2с задержки. Тест обновлён (проверяет оба вызова в одном таймере). Все 319 тестов проходят.
- Создан `ForgotPasswordForm` (Smart-контейнер): форма с email, кнопка отправки, anti-enumeration защита (всегда показывает success-сообщение), inline-баннер для сетевых ошибок.
- Добавлена функция `resetPasswordForEmail` в `auth.ts` с `redirectTo: [origin]/auth/confirm?type=recovery`.
- Создана страница `/forgot-password/page.tsx`.
- Добавлена ссылка "Забыли пароль?" в `AuthContainer.tsx`.
- Обновлен `UpdatePasswordForm.tsx`: добавлено поле подтверждения пароля, валидация совпадения паролей.
- `proxy.ts` уже пропускал `/auth/confirm` — изменений не требовалось.
- `auth/confirm/route.ts` уже обрабатывал `type=recovery` → `/update-password`.
- Для системных ошибок использован inline error banner (паттерн как в `AuthContainer`); отдельный Toast-компонент не создавался — в проекте нет toast-системы, добавление было бы over-engineering.
- typecheck и lint на изменённых файлах — без ошибок.

### File List

- `src/features/auth/api/auth.ts` (изменён — добавлена `resetPasswordForEmail`)
- `src/features/auth/components/ForgotPasswordForm.tsx` (изменён — оптимизация isLoading, onChange очищает ошибку только при корректном email)
- `src/features/auth/components/UpdatePasswordForm.tsx` (изменён — поле подтверждения пароля, useAuthStore sync, задержка 2с перед редиректом)
- `src/features/auth/components/AuthContainer.tsx` (изменён — ссылка "Забыли пароль?")
- `src/app/(public)/forgot-password/page.tsx` (создан)
- `src/app/(public)/update-password/page.tsx` (изменён — async, серверная проверка сессии + redirect)
- `tests/unit/features/auth/components/UpdatePasswordForm.test.tsx` (обновлён — +2 теста: store sync, задержка редиректа; новые моки store/supabase)
- `tests/unit/features/auth/components/ForgotPasswordForm.test.tsx` (обновлён — тест onChange renamed + добавлен тест "не очищает при некорректном email")
- `tests/unit/app/(public)/update-password/page.test.tsx` (создан — 2 теста)
- `src/lib/app-routes.ts` (изменён — добавлен `/forgot-password` в PUBLIC_PATHS)
- `src/features/auth/components/AuthContainer.tsx` (изменён — обработка `error=link-expired`)
- `tests/unit/features/auth/components/AuthContainer.test.tsx` (обновлён — тест `error=link-expired`)
- `tests/unit/middleware.test.ts` (обновлён — 2 теста для маршрута `/forgot-password`)
- `src/app/auth/confirm/route.ts` (изменён — error=link-expired при ошибке recovery-токена)
- `src/features/auth/components/UpdatePasswordForm.tsx` (изменён — getAuthSuccessRedirectPath(), router.refresh() внутри setTimeout)
- `src/features/auth/components/ForgotPasswordForm.tsx` (изменён — setNetworkError(null) при раннем exit)
- `tests/unit/app/auth/confirm/route.test.ts` (обновлён — тест link-expired для type=recovery)
- `tests/unit/features/auth/components/UpdatePasswordForm.test.tsx` (обновлён — тест задержки refresh)
- `tests/unit/features/auth/components/ForgotPasswordForm.test.tsx` (обновлён — тест сброса networkError)

### Change Log

- 2026-03-16: Реализована Story 1.8 — сброс и восстановление пароля. Создана форма запроса ссылки сброса (`ForgotPasswordForm`), страница `/forgot-password`, ссылка с login-формы. Обновлена форма установки нового пароля (`UpdatePasswordForm`): добавлено поле подтверждения.
- 2026-03-16: Code Review выполнен. Обнаружены 2 критические проблемы (сломанные тесты, отсутствие тестов для ForgotPasswordForm), 1 средняя (ложное утверждение про Toasts), 1 низкая (оптимизация состояния). Созданы action items для исправления.
- 2026-03-16: Addressed code review findings — 4 items resolved. ✅ [CRITICAL] Исправлены тесты UpdatePasswordForm (добавлено заполнение confirm, тест мисматча паролей). ✅ [CRITICAL] Созданы 7 тестов ForgotPasswordForm (render, валидация, сетевая ошибка, anti-enumeration success, ссылка возврата, сброс ошибки). ✅ [MEDIUM] Исправлен текст задачи: "Toasts" → "инлайн-баннеры". ✅ [LOW] Оптимизирован isLoading в ForgotPasswordForm — сбрасывается в одном ре-рендере с setSubmitted. Все 303 теста проходят.
- 2026-03-16: Addressed remaining code review findings — 5 items resolved. ✅ [HIGH] Истёкший токен в UpdatePasswordForm: проверка expired/invalid/session → router.push('/login?error=link-expired'). ✅ [HIGH] router.refresh() + success-состояние "Пароль обновлён" в UpdatePasswordForm. ✅ [MEDIUM] Кнопка "Ввести другой email" в ForgotPasswordForm. ✅ [MEDIUM] Уведомление об успехе перед редиректом в UpdatePasswordForm. ✅ [LOW] Regex-валидация email в ForgotPasswordForm. Все 310 тестов проходят.
- 2026-03-16: Code Review выполнен. Обнаружены 4 новые проблемы: 2 HIGH (отсутствие обновления useAuthStore, нет защиты страницы /update-password), 1 MEDIUM (мгновенный редирект скрывает UI успеха), 1 LOW (слишком агрессивный сброс ошибок). Созданы action items для исправления.
- 2026-03-16: Addressed all remaining code review findings — 4 items resolved. ✅ [HIGH] useAuthStore sync в UpdatePasswordForm: getSession() → setSession/setUser. ✅ [HIGH] Серверная проверка сессии на /update-password — redirect('/login') при отсутствии сессии. ✅ [MEDIUM] setTimeout 2000ms перед redirect('/feed') — пользователь видит "Пароль обновлён". ✅ [LOW] onChange в ForgotPasswordForm очищает ошибку только при валидном email. Все 314 тестов проходят.
- 2026-03-16: Addressed all remaining code review findings (final batch) — 4 items resolved. ✅ [HIGH] /auth/confirm: ошибка verifyOtp для type=recovery → error=link-expired. ✅ [MEDIUM] UpdatePasswordForm: router.push использует getAuthSuccessRedirectPath(). ✅ [LOW] ForgotPasswordForm: setNetworkError(null) при раннем выходе из handleSubmit. ✅ [LOW] UpdatePasswordForm: router.refresh() перенесён в setTimeout вместе с push. Все 319 тестов проходят.
- 2026-03-16: Addressed final code review findings — 4 items resolved. ✅ [CRITICAL] Добавлен `/forgot-password` в PUBLIC_PATHS — маршрут теперь доступен без авторизации. ✅ [MEDIUM] Обработан `error=link-expired` в AuthContainer — показывает "Срок действия ссылки истёк". ✅ [LOW] setIsLoading(false) перенесён после session sync в UpdatePasswordForm — форма блокирована до полной синхронизации. ✅ [LOW] Добавлено 2 теста в middleware для `/forgot-password` (unauth + fail-secure), 1 тест в AuthContainer. Все 317 тестов проходят.
