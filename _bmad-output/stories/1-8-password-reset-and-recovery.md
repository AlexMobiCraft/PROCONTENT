# Story 1.8: Сброс и восстановление пароля (Forgot Password)

Status: done

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
- [x] [AI-Review][HIGH] Заменить нативные теги `<a>` на компонент `Link` из `next/link` в `AuthContainer.tsx` и `ForgotPasswordForm.tsx` (включая состояние успеха) для корректной SPA-навигации [src/features/auth/components/AuthContainer.tsx:84-90][src/features/auth/components/ForgotPasswordForm.tsx:66-71][src/features/auth/components/ForgotPasswordForm.tsx:138-143]
- [x] [AI-Review][MEDIUM] Пропускать логику синхронизации со Stripe (запросы API и обновление профиля) при подтверждении токена с `type='recovery'` [src/app/auth/confirm/route.ts:75-168]
- [x] [AI-Review][MEDIUM] Очищать таймер (clearTimeout) в useEffect или использовать другой подход для предотвращения попыток обновления состояния/роутера при размонтировании компонента во время задержки редиректа [src/features/auth/components/UpdatePasswordForm.tsx:68-73]
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
- [x] [AI-Review][LOW] Сбрасывать networkError при раннем выходе из handleSubmit in ForgotPasswordForm [src/features/auth/components/ForgotPasswordForm.tsx:19-27]
- [x] [AI-Review][LOW] Переместить router.refresh() внутрь setTimeout в UpdatePasswordForm для предотвращения мерцания UI [src/features/auth/components/UpdatePasswordForm.tsx:68-69]
- [x] [AI-Review][HIGH] Исправить оставшийся нативный тег `<a>` на компонент `Link` в ForgotPasswordForm.tsx для SPA-навигации [src/features/auth/components/ForgotPasswordForm.tsx:139-144]
- [x] [AI-Review][MEDIUM] Ослабить логику сброса validationError в ForgotPasswordForm — сбрасывать при любом вводе (onChange), а не только при полной валидности [src/features/auth/components/ForgotPasswordForm.tsx:111-114]
- [x] [AI-Review][MEDIUM] Улучшить тесты ForgotPasswordForm — проверять именно наличие Link компонентов, чтобы не пропускать нативные <a> [tests/unit/features/auth/components/ForgotPasswordForm.test.tsx]
- [x] [AI-Review][LOW] Оптимизировать UpdatePasswordForm — использовать данные из ответа updatePassword вместо лишнего вызова getSession() [src/features/auth/components/UpdatePasswordForm.tsx:52-73]
- [x] [AI-Review][HIGH] Выводить детальную ошибку из API (apiError.message) в UpdatePasswordForm вместо общего сообщения, если это не ошибка истечения токена [src/features/auth/components/UpdatePasswordForm.tsx:62]
- [x] [AI-Review][MEDIUM] Добавить meta description на страницу /forgot-password для SEO и консистентности [src/app/(public)/forgot-password/page.tsx:5-7]
- [x] [AI-Review][MEDIUM] Устранить дублирование логики защиты в PUBLIC_PATHS — либо доверить проверку middleware, либо убрать /update-password из публичных путей [src/lib/app-routes.ts:6]
- [x] [AI-Review][LOW] Унифицировать написание бренда (PROCONTENT) в заголовках страниц [src/app/(public)/update-password/page.tsx:7]
- [x] [AI-Review][LOW] Пересмотреть необходимость жесткого regex для email в ForgotPasswordForm, полагаясь на браузерную валидацию и Supabase [src/features/auth/components/ForgotPasswordForm.tsx:25]
- [x] [AI-Review][LOW] Устранить избыточность в ForgotPasswordForm.test.tsx (дублирующиеся тесты очистки валидации) [tests/unit/features/auth/components/ForgotPasswordForm.test.tsx:110-130]
- [x] [AI-Review][LOW] Рассмотреть оптимизацию порядка router.refresh() и router.push() в UpdatePasswordForm для предотвращения потенциального мерцания [src/features/auth/components/UpdatePasswordForm.tsx:71-72]
- [x] [AI-Review][HIGH] Вернуть серверную проверку сессии на странице /update-password (async Server Component + redirect('/login')), так как текущая реализация позволяет неавторизованным видеть форму [src/app/(public)/update-password/page.tsx:8-16]
- [x] [AI-Review][HIGH] Синхронизировать session в useAuthStore (не только user) после успешной смены пароля для корректной работы всего приложения [src/features/auth/components/UpdatePasswordForm.tsx:66]
- [x] [AI-Review][MEDIUM] Унифицировать текст ошибки link-expired в AuthContainer, чтобы он был нейтральным и подходил как для сброса пароля, так и для регистрации [src/features/auth/components/AuthContainer.tsx:25]
- [x] [AI-Review][MEDIUM] Добавить role="status" или aria-live="polite" к сообщениям об успехе в формах для доступности (A11y) [src/features/auth/components/ForgotPasswordForm.tsx:49][src/features/auth/components/UpdatePasswordForm.tsx:78]
- [x] [AI-Review][MEDIUM] Добавить autoComplete="new-password" к инпутам пароля в UpdatePasswordForm для корректной работы менеджеров паролей [src/features/auth/components/UpdatePasswordForm.tsx:112][src/features/auth/components/UpdatePasswordForm.tsx:137]
- [x] [AI-Review][MEDIUM] Исправить порядок вызовов: router.refresh() должен идти ПЕРЕД router.push() или использоваться серверный редирект для надежного обновления кэша [src/features/auth/components/UpdatePasswordForm.tsx:71-72]
- [x] [AI-Review][MEDIUM] Устранить архитектурную неопределенность: либо полагаться на PUBLIC_PATHS в middleware, либо оставить проверку в компоненте, но убрать дублирование в документации [src/lib/app-routes.ts]
- [x] [AI-Review][MEDIUM] Добавить проверку результата getSession() после обновления пароля для обеспечения согласованности состояния сессии [src/features/auth/components/UpdatePasswordForm.tsx:66]
- [x] [AI-Review][MEDIUM] Реализовать сброс ошибок из URL (query params) при начале взаимодействия с формой логина, чтобы старые уведомления не перекрывали новые сетевые ошибки [src/features/auth/components/AuthContainer.tsx:28-36]
- [x] [AI-Review][LOW] Сбрасывать networkError в onChange (вместе с validationError), чтобы старое сообщение о сетевой ошибке не висело после начала исправления email [src/features/auth/components/ForgotPasswordForm.tsx:110-112]
- [x] [AI-Review][LOW] Добавить явный тип Metadata к объекту метаданных в UpdatePasswordPage для консистентности [src/app/(public)/update-password/page.tsx:6]
- [x] [AI-Review][HIGH] Обернуть AuthContainer в Suspense на странице /login для предотвращения деоптимизации рендеринга [src/app/(public)/login/page.tsx]
- [x] [AI-Review][MEDIUM] Удалить неиспользуемый мок @base-ui/react/button в тестах [tests/unit/features/auth/components/UpdatePasswordForm.test.tsx:5-13]
- [x] [AI-Review][MEDIUM] Унифицировать выравнивание кнопок и ссылок в ForgotPasswordForm (центровка vs левый край) [src/features/auth/components/ForgotPasswordForm.tsx:62][src/features/auth/components/ForgotPasswordForm.tsx:131]
- [x] [AI-Review][MEDIUM] Сбрасывать и системную ошибку `error` при `onChange` в `UpdatePasswordForm.tsx` (сейчас сбрасывается только валидация) [src/features/auth/components/UpdatePasswordForm.tsx:121,147]
- [x] [AI-Review][MEDIUM] Вычислять `urlError` в `AuthContainer.tsx` динамически на основе `searchParams` вместо хранения в `useState`, чтобы корректно реагировать на SPA-навигацию [src/features/auth/components/AuthContainer.tsx:21-27]
- [x] [AI-Review][LOW] Сделать кнопки адаптивными (w-full max-w-[240px]) вместо жесткой фиксации (w-[240px]) [ForgotPasswordForm.tsx:131, UpdatePasswordForm.tsx:160]
- [x] [AI-Review][LOW] Добавить маппинг системных ошибок API на человекочитаемый русский язык в `UpdatePasswordForm.tsx` [src/features/auth/components/UpdatePasswordForm.tsx:62]
- [x] [AI-Review][LOW] Оптимизировать избыточность `getSession` в `UpdatePasswordForm.tsx` (оставлено как осознанное решение для синхронизации, задокументировано в коде) [src/features/auth/components/UpdatePasswordForm.tsx:68-70]

### Review Follow-ups (AI)
- [x] [AI-Review][HIGH] Валидировать параметр `next` перед редиректом для защиты от Open Redirect [src/app/auth/confirm/route.ts:36]
- [x] [AI-Review][MEDIUM] Сбрасывать `urlErrorDismissed` при изменении полей в LoginForm (сейчас ошибка из URL висит до сабмита) [src/features/auth/components/AuthContainer.tsx:28]
- [x] [AI-Review][MEDIUM] Убедиться, что `mapPasswordError` реально применяется для вывода ошибок в `UpdatePasswordForm.tsx` [src/features/auth/components/UpdatePasswordForm.tsx:62]
- [x] [AI-Review][LOW] Добавить явный тип `Metadata` к объекту метаданных [src/app/(public)/update-password/page.tsx:7]
- [x] [AI-Review][LOW] Рассмотреть смену заголовка "Создание пароля" на "Восстановление пароля" для сценария сброса [src/features/auth/components/UpdatePasswordForm.tsx:101]
- [x] [AI-Review][LOW] Обновить Change Log и синхронизировать статус в sprint-status.yaml.

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
- ✅ Resolved review finding [HIGH]: `<a>` → `Link` (next/link) в AuthContainer.tsx (ссылка "Забыли пароль?") и ForgotPasswordForm.tsx (оба "Вернуться ко входу"). SPA-навигация без полного page reload. Существующие тесты проходят.
- ✅ Resolved review finding [MEDIUM]: route.ts — Stripe-синхронизация обёрнута в `if (type !== 'recovery')`. При восстановлении пароля getUser не вызывается, Stripe-запросы не отправляются. Добавлен тест. Все 320 тестов проходят.
- ✅ Resolved review finding [MEDIUM]: UpdatePasswordForm — таймер сохранён в `timerRef` (useRef), useEffect с cleanup clearTimeout предотвращает state-обновление после размонтирования. Существующие тесты проходят.
- ✅ Resolved review finding [HIGH]: Исправлен нативный `<a>` в форм-стате ForgotPasswordForm (строка 139) → `Link` из next/link. Все 321 тест проходят.
- ✅ Resolved review finding [MEDIUM]: ForgotPasswordForm onChange теперь всегда сбрасывает validationError при любом вводе. Тест обновлён: "очищает ошибку при любом вводе (включая некорректный email)".
- ✅ Resolved review finding [MEDIUM]: Добавлен vi.mock('next/link') в ForgotPasswordForm.test.tsx — мок рендерит data-component="Link". Новый тест "использует компонент Link для навигации" проверяет оба состояния (форма + success).
- ✅ Resolved review finding [LOW]: UpdatePasswordForm — удалены createClient() и getSession(). setUser теперь использует data?.user из ответа updatePassword. setSession удалён. Тест обновлён. Все 321 тест проходят.
- ✅ Resolved review finding [HIGH]: UpdatePasswordForm — `setError` теперь показывает `apiError.message` (с fallback на общее сообщение) вместо захардкоженной строки. Тесты обновлены: ожидают 'Server error' и 'Database error'. Все 319 тестов проходят.
- ✅ Resolved review finding [MEDIUM]: forgot-password/page.tsx — добавлено поле `description` в metadata для SEO.
- ✅ Resolved review finding [MEDIUM]: update-password/page.tsx упрощена до синхронного компонента — убраны `async`, `createClient`, `redirect`. Дублирование устранено: `/update-password` остаётся в PUBLIC_PATHS (необходимо для recovery-flow при inactive-подписке), server-redirect убран. Тест упрощён до 1 проверки рендера.
- ✅ Resolved review finding [LOW]: update-password/page.tsx — исправлен бренд `ProContent` → `PROCONTENT` в title страницы.
- ✅ Resolved review finding [LOW]: ForgotPasswordForm — убран жёсткий regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`, валидация email полагается на `typeMismatch` (browser validation) + Supabase. Regex-специфичный тест удалён. Все 319 тестов проходят.
- ✅ Resolved review finding [LOW]: Удалён дублирующийся тест `'очищает ошибку валидации при вводе корректного email'` в ForgotPasswordForm.test.tsx — он являлся подмножеством теста `'очищает ошибку валидации при любом вводе'`. Все 318 тестов проходят.
- ✅ Resolved review finding [LOW]: UpdatePasswordForm — порядок вызовов в setTimeout изменён на `router.push()` → `router.refresh()` для предотвращения мерцания UI (навигация происходит раньше обновления RSC-кэша). Существующий тест проходит без изменений.
- ✅ Resolved review finding [HIGH]: update-password/page.tsx — возвращена async Server Component с `supabase.auth.getUser()` + `redirect('/login')` при отсутствии пользователя. Тест обновлён: 2 проверки (рендер при наличии сессии + редирект при отсутствии).
- ✅ Resolved review finding [HIGH]: UpdatePasswordForm — после успешного `updatePassword` вызывается `getSession()`, затем `setUser(data.user)` и `setSession(sessionData.session)`. Добавлен тест `синхронизирует session в useAuthStore`.
- ✅ Resolved review finding [MEDIUM]: AuthContainer — текст ошибки `link-expired` изменён на нейтральный "Срок действия ссылки истёк. Запросите новую ссылку." (подходит и для сброса пароля, и для регистрации). Тест обновлён.
- ✅ Resolved review finding [MEDIUM]: ForgotPasswordForm и UpdatePasswordForm — добавлен `role="status"` к success-контейнерам для корректной работы live regions (A11y).
- ✅ Resolved review finding [MEDIUM]: UpdatePasswordForm — добавлен `autoComplete="new-password"` к обоим инпутам пароля для корректной работы менеджеров паролей.
- ✅ Resolved review finding [MEDIUM]: UpdatePasswordForm — порядок в setTimeout исправлен: `router.refresh()` теперь вызывается ПЕРЕД `router.push()` для надёжного обновления RSC-кэша.
- ✅ Resolved review finding [LOW]: app-routes.ts — добавлен комментарий, объясняющий двухуровневую архитектуру защиты `/update-password` (PUBLIC_PATHS для inactive users + серверная проверка в компоненте). Все 320 тестов проходят.
- ✅ Resolved review finding [MEDIUM]: UpdatePasswordForm — добавлена проверка error из getSession(); при ошибке setSession(null). Покрыто тестом `устанавливает session в null если getSession вернул ошибку`.
- ✅ Resolved review finding [MEDIUM]: AuthContainer — magicLinkErrorMessage заменён на urlError state; сбрасывается в начале handleLoginSubmit. Покрыто тестом `сбрасывает ошибку из URL при начале взаимодействия с формой`.
- ✅ Resolved review finding [LOW]: ForgotPasswordForm — onChange сбрасывает networkError вместе с validationError. Покрыто тестом `сбрасывает сетевую ошибку при вводе в поле email (onChange)`.
- ✅ Resolved review finding [LOW]: update-password/page.tsx — добавлен явный тип `Metadata` из next. Существующие тесты проходят. Все 323 теста.
- ✅ Resolved review finding [HIGH]: login/page.tsx — AuthContainer обёрнут в `<Suspense>` для изоляции `useSearchParams()` и предотвращения деоптимизации рендеринга всей страницы. Все 323 теста проходят.
- ✅ Resolved review finding [MEDIUM]: UpdatePasswordForm.test.tsx — удалён неиспользуемый `vi.mock('@base-ui/react/button', ...)`. Все 323 теста проходят.
- ✅ Resolved review finding [MEDIUM]: ForgotPasswordForm — успех-стейт: кнопка "Ввести другой email" изменена с `text-left` на `text-center`; ссылка "Вернуться ко входу" получила `text-center`. Выравнивание унифицировано с основной формой. Все 323 теста проходят.
- ✅ Resolved review finding [LOW]: UpdatePasswordForm — getSession() после updateUser() является чтением in-memory кэша Supabase (не сетевым запросом). updateUser не возвращает session, поэтому вызов обоснован. Добавлен поясняющий комментарий.
- ✅ Resolved review finding [MEDIUM]: UpdatePasswordForm — onChange обоих полей пароля теперь сбрасывает и `error` (системную) вместе с `validationError`. Покрыто тестом `сбрасывает системную ошибку при вводе в поле пароля (onChange)`.
- ✅ Resolved review finding [MEDIUM]: AuthContainer — `urlError` теперь вычисляется динамически из `searchParams` (не useState). Добавлен `urlErrorDismissed` boolean state для скрытия при submit. При SPA-навигации к URL без error-параметра ошибка исчезает автоматически. Все существующие тесты проходят.
- ✅ Resolved review finding [LOW]: ForgotPasswordForm и UpdatePasswordForm — кнопка submit изменена с `w-[240px]` на `w-full max-w-[240px]` для адаптивности на малых экранах. Все 325 тестов проходят.
- ✅ Resolved review finding [LOW]: UpdatePasswordForm — добавлена функция `mapPasswordError` для маппинга ошибок API на русский язык. Известные ошибки слабого пароля → специфичное сообщение; прочие → нейтральный fallback. Тесты обновлены. Добавлен тест `маппит ошибку слабого пароля от Supabase на русский`.
- ✅ Resolved review finding [HIGH]: route.ts — валидация параметра `next` перед редиректом для защиты от Open Redirect: принимаются только относительные пути (начинаются с `/`, но не `//`). Добавлены 2 теста (внешний URL и protocol-relative URL). Все 328 тестов проходят.
- ✅ Resolved review finding [MEDIUM]: LoginForm — добавлен опциональный prop `onFieldChange?: () => void`, вызывается в onChange email и password. AuthContainer передаёт `onFieldChange={() => setUrlErrorDismissed(true)}` — ошибка из URL исчезает при первом вводе, не дожидаясь submit. Добавлен тест. Все 328 тестов проходят.
- ✅ Resolved review finding [MEDIUM]: UpdatePasswordForm — добавлена функция `mapPasswordError` и применяется в setError. Слабый пароль → русское сообщение; прочие ошибки → возвращаются как есть. Добавлен тест `маппит ошибку слабого пароля от Supabase на русский (mapPasswordError)`.
- ✅ Resolved review finding [LOW]: update-password/page.tsx — явный тип `Metadata` уже присутствовал (`import type { Metadata } from 'next'`, `export const metadata: Metadata = {}`). Исправление не требовалось.
- ✅ Resolved review finding [LOW]: UpdatePasswordForm — заголовок изменён с "Создание пароля" на "Восстановление пароля" для соответствия сценарию восстановления. Все 328 тестов проходят.
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
- `src/features/auth/components/AuthContainer.tsx` (изменён — `<a>` → `Link` из next/link)
- `src/features/auth/components/ForgotPasswordForm.tsx` (изменён — оба `<a>` → `Link` из next/link)
- `src/app/auth/confirm/route.ts` (изменён — Stripe-блок обёрнут в `if (type !== 'recovery')`)
- `src/features/auth/components/UpdatePasswordForm.tsx` (изменён — `timerRef` + `useEffect` для clearTimeout)
- `tests/unit/app/auth/confirm/route.test.ts` (обновлён — тест: Stripe не вызывается при type=recovery)
- `src/features/auth/components/ForgotPasswordForm.tsx` (изменён — `<a>` → `Link` в форм-стате; onChange всегда сбрасывает validationError)
- `src/features/auth/components/UpdatePasswordForm.tsx` (изменён — удалены createClient/getSession/setSession; используется data.user из updatePassword)
- `tests/unit/features/auth/components/ForgotPasswordForm.test.tsx` (обновлён — vi.mock('next/link'); тест onChange; тест Link компонентов)
- `tests/unit/features/auth/components/UpdatePasswordForm.test.tsx` (обновлён — удалены mockGetSession/supabase mock; обновлён тест store sync)
- `src/features/auth/components/UpdatePasswordForm.tsx` (изменён — apiError.message вместо захардкоженной строки)
- `tests/unit/features/auth/components/UpdatePasswordForm.test.tsx` (обновлён — 2 теста проверяют фактическое сообщение API)
- `src/app/(public)/forgot-password/page.tsx` (изменён — добавлен description в metadata)
- `src/app/(public)/update-password/page.tsx` (изменён — убраны async/createClient/redirect/session-check; исправлен ProContent → PROCONTENT)
- `tests/unit/app/(public)/update-password/page.test.tsx` (обновлён — упрощён до 1 теста рендера без session mocks)
- `src/features/auth/components/ForgotPasswordForm.tsx` (изменён — убран regex, оставлен только typeMismatch)
- `tests/unit/features/auth/components/ForgotPasswordForm.test.tsx` (обновлён — удалён regex-специфичный тест; удалён дублирующийся тест очистки валидации)
- `src/features/auth/components/UpdatePasswordForm.tsx` (изменён — порядок router.push()/router.refresh() в setTimeout)
- `src/app/(public)/update-password/page.tsx` (изменён — async Server Component, getUser + redirect('/login'))
- `src/features/auth/components/UpdatePasswordForm.tsx` (изменён — getSession + setSession, autoComplete="new-password", role="status", router.refresh() перед push())
- `src/features/auth/components/AuthContainer.tsx` (изменён — нейтральный текст link-expired)
- `src/features/auth/components/ForgotPasswordForm.tsx` (изменён — role="status" на success state)
- `src/lib/app-routes.ts` (изменён — комментарий двухуровневой защиты)
- `tests/unit/app/(public)/update-password/page.test.tsx` (обновлён — 2 теста: рендер + редирект при отсутствии сессии)
- `tests/unit/features/auth/components/UpdatePasswordForm.test.tsx` (обновлён — mockSetSession + mockGetSession + тест синхронизации session)
- `tests/unit/features/auth/components/AuthContainer.test.tsx` (обновлён — ожидаемый нейтральный текст link-expired)
- `src/features/auth/components/UpdatePasswordForm.tsx` (изменён — проверка sessionError из getSession())
- `src/features/auth/components/AuthContainer.tsx` (изменён — magicLinkErrorMessage → urlError state, сброс в handleLoginSubmit)
- `src/features/auth/components/ForgotPasswordForm.tsx` (изменён — onChange сбрасывает networkError)
- `src/app/(public)/update-password/page.tsx` (изменён — явный тип Metadata)
- `tests/unit/features/auth/components/UpdatePasswordForm.test.tsx` (обновлён — тест getSession error → setSession(null))
- `tests/unit/features/auth/components/AuthContainer.test.tsx` (обновлён — тест сброса urlError при submit)
- `tests/unit/features/auth/components/ForgotPasswordForm.test.tsx` (обновлён — тест сброса networkError в onChange)
- `src/app/(public)/login/page.tsx` (изменён — Suspense wrapper для AuthContainer)
- `tests/unit/features/auth/components/UpdatePasswordForm.test.tsx` (изменён — удалён неиспользуемый мок @base-ui/react/button)
- `src/features/auth/components/ForgotPasswordForm.tsx` (изменён — центрирование кнопок в success-стейте)
- `src/features/auth/components/UpdatePasswordForm.tsx` (изменён — комментарий к getSession())
- `src/features/auth/components/UpdatePasswordForm.tsx` (изменён — onChange сбрасывает error; mapPasswordError; w-full max-w-[240px])
- `src/features/auth/components/AuthContainer.tsx` (изменён — urlError динамически из searchParams + urlErrorDismissed state)
- `src/features/auth/components/ForgotPasswordForm.tsx` (изменён — w-full max-w-[240px] для кнопки)
- `tests/unit/features/auth/components/UpdatePasswordForm.test.tsx` (обновлён — тесты маппинга ошибок, тест onChange сброса error)
- `src/app/auth/confirm/route.ts` (изменён — валидация `next` параметра для защиты от Open Redirect)
- `src/features/auth/components/LoginForm.tsx` (изменён — добавлен prop `onFieldChange?: () => void`, вызывается в onChange полей)
- `src/features/auth/components/AuthContainer.tsx` (изменён — передаёт `onFieldChange` в LoginForm для немедленного скрытия urlError)
- `src/features/auth/components/UpdatePasswordForm.tsx` (изменён — добавлена функция `mapPasswordError`; заголовок "Восстановление пароля")
- `tests/unit/app/auth/confirm/route.test.ts` (обновлён — 2 теста защиты от Open Redirect)
- `tests/unit/features/auth/components/AuthContainer.test.tsx` (обновлён — тест скрытия urlError при onChange)
- `tests/unit/features/auth/components/UpdatePasswordForm.test.tsx` (обновлён — тест mapPasswordError для слабого пароля)

### Change Log

- 2026-03-16: Реализована Story 1.8 — сброс и восстановление пароля. Создана форма запроса ссылки сброса (`ForgotPasswordForm`), страница `/forgot-password`, ссылка с login-формы. Обновлена форма установки нового пароля (`UpdatePasswordForm`): добавлено поле подтверждения.
- 2026-03-16: Code Review выполнен. Обнаружены 2 критические проблемы (сломанные тесты, отсутствие тестов для ForgotPasswordForm), 1 средняя (ложное утверждение про Toasts), 1 низкая (оптимизация состояния). Созданы action items для исправления.
- 2026-03-16: Addressed code review findings — 4 items resolved. ✅ [CRITICAL] Исправлены тесты UpdatePasswordForm (добавлено заполнение confirm, тест мисматча паролей). ✅ [CRITICAL] Созданы 7 тестов ForgotPasswordForm (render, валидация, сетевая ошибка, anti-enumeration success, ссылка возврата, сброс ошибки). ✅ [MEDIUM] Исправлен текст задачи: "Toasts" → "инлайн-баннеры". ✅ [LOW] Оптимизирован isLoading в ForgotPasswordForm — сбрасывается в одном ре-рендере с setSubmitted. Все 303 теста проходят.
- 2026-03-16: Addressed remaining code review findings — 5 items resolved. ✅ [HIGH] Истёкший токен в UpdatePasswordForm: проверка expired/invalid/session → router.push('/login?error=link-expired'). ✅ [HIGH] router.refresh() + success-состояние "Пароль обновлён" в UpdatePasswordForm. ✅ [MEDIUM] Кнопка "Ввести другой email" в ForgotPasswordForm. ✅ [MEDIUM] Уведомление об успехе перед редиректом в UpdatePasswordForm. ✅ [LOW] Regex-валидация email в ForgotPasswordForm. Все 310 тестов проходят.
- 2026-03-16: Code Review выполнен. Обнаружены 4 новые проблемы: 2 HIGH (отсутствие обновления useAuthStore, нет защиты страницы /update-password), 1 MEDIUM (мгновенный редирект скрывает UI успеха), 1 LOW (слишком агрессивный сброс ошибок). Созданы action items для исправления.
- 2026-03-16: Addressed all remaining code review findings — 4 items resolved. ✅ [HIGH] useAuthStore sync в UpdatePasswordForm: getSession() → setSession/setUser. ✅ [HIGH] Серверная проверка сессии на /update-password — redirect('/login') при отсутствии сессии. ✅ [MEDIUM] setTimeout 2000ms перед redirect('/feed') — пользователь видит "Пароль обновлён". ✅ [LOW] onChange в ForgotPasswordForm очищает ошибку только при валидном email. Все 314 тестов проходят.
- 2026-03-16: Addressed all remaining code review findings (final batch) — 4 items resolved. ✅ [HIGH] /auth/confirm: ошибка verifyOtp для type=recovery → error=link-expired. ✅ [MEDIUM] UpdatePasswordForm: router.push использует getAuthSuccessRedirectPath(). ✅ [LOW] ForgotPasswordForm: setNetworkError(null) при раннем выходе из handleSubmit. ✅ [LOW] UpdatePasswordForm: router.refresh() перенесён в setTimeout вместе с push. Все 319 тестов проходят.
- 2026-03-16: Addressed final code review findings — 4 items resolved. ✅ [CRITICAL] Добавлен `/forgot-password` в PUBLIC_PATHS — маршрут теперь доступен без авторизации. ✅ [MEDIUM] Обработан `error=link-expired` в AuthContainer — показывает "Срок действия ссылки истёк". ✅ [LOW] setIsLoading(false) перенесён после session sync в UpdatePasswordForm — форма блокирована до полной синхронизации. ✅ [LOW] Добавлено 2 теста в middleware для `/forgot-password` (unauth + fail-secure), 1 тест в AuthContainer. Все 317 тестов проходят.
- 2026-03-17: Addressed last 3 review findings — 3 items resolved. ✅ [HIGH] `<a>` → `Link` (next/link) в AuthContainer и ForgotPasswordForm. ✅ [MEDIUM] Stripe-синхронизация пропускается при type=recovery в /auth/confirm. ✅ [MEDIUM] clearTimeout через timerRef + useEffect в UpdatePasswordForm. Все 320 тестов проходят.
- 2026-03-17: Проведен 11-й раунд Adversarial Code Review. Обнаружено 4 проблемы: 1 HIGH (пропущенный тег `<a>`), 2 MEDIUM (качество тестов и агрессивность валидации), 1 LOW (избыточный запрос сессии). Статус переведен в 'in-progress'.
- 2026-03-17: Addressed final 4 review findings — все исправлено. ✅ [HIGH] `<a>` → Link в ForgotPasswordForm форм-стате. ✅ [MEDIUM] onChange сбрасывает validationError при любом вводе. ✅ [MEDIUM] Тесты ForgotPasswordForm проверяют Link компоненты (vi.mock + data-component). ✅ [LOW] UpdatePasswordForm: data.user из updatePassword вместо getSession(). Все 321 тест проходят.
- 2026-03-17: Проведен 12-й раунд Adversarial Code Review. Обнаружены 5 проблем: 1 HIGH (скрытие ошибок API), 2 MEDIUM (SEO и дублирование логики защиты), 2 LOW (брендинг и regex). Статус переведен в 'in-progress'.
- 2026-03-17: Addressed final 5 review findings (12-й раунд) — все исправлено. ✅ [HIGH] UpdatePasswordForm показывает apiError.message. ✅ [MEDIUM] Meta description добавлен на /forgot-password. ✅ [MEDIUM] Дублирование логики убрано: update-password/page.tsx упрощён, server-redirect удалён. ✅ [LOW] ProContent → PROCONTENT. ✅ [LOW] Regex убран из ForgotPasswordForm. Все 319 тестов проходят. Статус: review.
- 2026-03-17: Проведен 13-й раунд Adversarial Code Review. Обнаружены 2 незначительные проблемы в тестах и UX. Созданы action items, статус переведен в 'in-progress'.
- 2026-03-17: Addressed final 2 review findings (13-й раунд) — все исправлено. ✅ [LOW] Удалён дублирующийся тест ForgotPasswordForm (очистка валидации при корректном email — подмножество более общего теста). ✅ [LOW] Порядок router.push()/router.refresh() в UpdatePasswordForm: push() первым для предотвращения мерцания. Все 318 тестов проходят. Статус: review.
- 2026-03-17: Addressed final 7 review findings (последний раунд) — все исправлено. ✅ [HIGH] Серверная проверка сессии на /update-password восстановлена. ✅ [HIGH] setSession в useAuthStore после updatePassword. ✅ [MEDIUM] Нейтральный текст link-expired. ✅ [MEDIUM] role="status" на success-контейнерах. ✅ [MEDIUM] autoComplete="new-password". ✅ [MEDIUM] router.refresh() перед router.push(). ✅ [LOW] Комментарий архитектурной двухуровневой защиты. Все 320 тестов проходят.
- 2026-03-17: Проведен 14-й раунд Adversarial Code Review. Обнаружены 4 новые проблемы (2 Medium, 2 Low). Созданы action items, статус переведен в 'in-progress'.
- 2026-03-17: Addressed final 4 review findings (последний раунд, финал) — все исправлено. ✅ [HIGH] Suspense wrapper для AuthContainer на /login. ✅ [MEDIUM] Удалён неиспользуемый vi.mock в UpdatePasswordForm.test.tsx. ✅ [MEDIUM] Унифицировано выравнивание в ForgotPasswordForm (text-center в success-стейте). ✅ [LOW] getSession() — обоснование задокументировано, вызов оставлен. Все 323 теста проходят. Статус: review.
- 2026-03-17: Addressed final 4 review findings (14-й раунд) — все исправлено. ✅ [MEDIUM] UpdatePasswordForm — добавлена проверка error из getSession(); при ошибке setSession(null). ✅ [MEDIUM] AuthContainer — urlError преобразован в state; сбрасывается при первом взаимодействии с формой (submit). ✅ [LOW] ForgotPasswordForm — onChange теперь сбрасывает и networkError вместе с validationError. ✅ [LOW] update-password/page.tsx — добавлен явный тип `Metadata` из next. Все 323 теста проходят.

- 2026-03-17: Проведен 15-й раунд Adversarial Code Review. Обнаружены 4 новые проблемы (2 Medium, 2 Low). Созданы action items, статус переведен в 'in-progress'.
- 2026-03-17: Addressed final 4 review findings (15-й раунд) — все исправлено. ✅ [MEDIUM] UpdatePasswordForm onChange сбрасывает и error. ✅ [MEDIUM] AuthContainer urlError вычисляется динамически из searchParams. ✅ [LOW] Кнопки w-full max-w-[240px] в ForgotPasswordForm и UpdatePasswordForm. ✅ [LOW] mapPasswordError — маппинг ошибок API на русский. Все 325 тестов проходят.
- 2026-03-17: Проведен 16-й раунд Adversarial Code Review. Обнаружены 5 новых проблем (1 High, 2 Medium, 2 Low). Статус переведен в 'in-progress'.
- 2026-03-17: Addressed final 5 review findings (16-й раунд) — все исправлено. ✅ [HIGH] Защита от Open Redirect в /auth/confirm: `next` принимается только если начинается с `/` и не `//`. 2 теста. ✅ [MEDIUM] LoginForm получил `onFieldChange` prop — urlError скрывается при первом вводе, не дожидаясь submit. ✅ [MEDIUM] mapPasswordError добавлена и применяется в UpdatePasswordForm. ✅ [LOW] Тип Metadata уже был — помечено как done. ✅ [LOW] Заголовок "Восстановление пароля". Все 328 тестов проходят. Статус: review.
