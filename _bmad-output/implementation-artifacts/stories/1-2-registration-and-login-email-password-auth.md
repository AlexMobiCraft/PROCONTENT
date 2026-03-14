# Story 1.2: Регистрация и Вход на платформу (Email & Password Auth Refactoring)

Status: ready-for-dev

## Story

As a пользовательница,
I want иметь возможность создать аккаунт через уникальную ссылку-приглашение и входить на платформу по email и паролю,
So that легко и безопасно получать доступ к своему профилю.

## Acceptance Criteria

1. **Given** процесс первоначальной регистрации после оплаты
   **When** пользователь вводит email при оплате в Stripe
   **Then** на почту приходит письмо с уникальной ссылкой для подтверждения email и создания пароля

2. **Given** пользовательница кликнула по ссылке из приглашения или письма восстановления
   **When** браузер открывает URL `/auth/confirm?token_hash=...&type=invite` (или `recovery` / `signup`)
   **Then** Route Handler (`src/app/auth/confirm/route.ts`) валидирует токен
   **And** перенаправляет на страницу установки пароля (`/update-password`)

3. **Given** страница установки нового пароля
   **When** пользовательница вводит новый пароль и нажимает "Сохранить"
   **Then** пароль обновляется в БД (Supabase Auth)
   **And** происходит авторизация и redirect на `/feed`

4. **Given** последующий вход пользовательницы (страница `/login`)
   **When** она вводит свой email и созданный пароль и нажимает "Войти"
   **Then** Supabase аутентифицирует пользователя
   **And** происходит redirect на `/feed`
   **And** при неверном пароле отображается понятная inline-ошибка интерфейса
   
5. **Given** пользовательница уже авторизована (активная сессия)
   **When** она открывает `/login`
   **Then** происходит автоматический redirect на `/feed`

6. **Given** неавторизованный пользователь
   **When** он пытается открыть любой защищенный маршрут внутри `(app)/`
   **Then** Next.js Middleware перехватывает запрос и делает redirect на `/login`

7. **Given** первый вход пользовательницы
   **When** Supabase создаёт запись в `auth.users`
   **Then** автоматически через DB trigger создаётся запись в таблице `public.profiles`

## Developer Context & Technical Requirements

**Внимание**: Эта история является масштабным рефакторингом текущей реализации. Изначально система была построена на флоу OTP/Magic Link (см. файл прошлой истории `_bmad-output/implementation-artifacts/stories/1-2-registration-and-login-to-the-platform-supabase-auth-magic-link-otp.md`).
Теперь требования изменились (эпики были обновлены) и нам нужно реализовать классическую схему **Email + Password**.

**Критически важно:** разработчику необходимо **изучить старую историю и текущий написанный код**, чтобы аккуратно вычистить устаревшие сущности (функции API для OTP, формы OTP, избыточные состояния стора, ненужные обработчики маршрутов) и заменить их новой логикой, не оставляя "мусора" в кодовой базе.

### Архитектурные требования:
1. Использовать `src/app/auth/confirm/route.ts` для обработки `token_hash` ссылок вместо старого `/auth/callback/route.ts` (или переработать его). В ссылке будут параметры `token_hash` и `type`. Вызовите `supabase.auth.verifyOtp({ token_hash, type })` для валидации ссылки. 
2. После успешной валидации токена на сервере устанавливается сессия. Затем нужно сделать `redirect('/update-password')`.
3. Ошибка неверного пароля (на `/login`) должна отображаться локально инлайн под полем (не использовать Toasts для ошибок заполнения формы). 
4. Zustand стор `src/features/auth/store.ts` продолжает управлять глобальным состоянием, не удаляйте его полностью, но очистите от OTP-стейта (например, `step: 'email' | 'otp'`).
5. Интеграция `middleware.ts` уже есть и работает; просто убедитесь, что новые маршруты `/auth/confirm` и `/update-password` (если он в публичной зоне) корректно обрабатываются. 

### Необходимые изменения в коде (Рефакторинг и очистка):
- Отрефакторить клиентскую часть `src/features/auth/api/auth.ts`:
  - **УДАЛИТЬ** функции `signInWithOtp` / `verifyOtp` (клиентские), так как OTP флоу больше не используется.
  - **ДОБАВИТЬ** `signInWithPassword({ email, password })`.
  - **ДОБАВИТЬ** функцию для обновления пароля: `supabase.auth.updateUser({ password: newPassword })`.
- Изменить UI компоненты:
  - **УДАЛИТЬ** `OTPVerificationForm.tsx`.
  - В `LoginForm.tsx` удалить логику отправки email для OTP. Добавить обязательное поле "Пароль" (`input type="password"`). Изменить текст и назначение кнопок.
  - **СОЗДАТЬ** компонент или страницу с формой `UpdatePasswordForm.tsx` для ввода и подтверждения нового пароля.
- Изменить файлы роутинга:
  - **ПЕРЕИМЕНОВАТЬ/ИЗМЕНИТЬ** `src/app/auth/callback/route.ts` на `src/app/auth/confirm/route.ts` согласно рекомендациям Supabase (или обновить текущий Route Handler).
  - **СОЗДАТЬ** `src/app/(public)/update-password/page.tsx` (в публичной зоне или защищенной - на момент ввода нового пароля сессия уже должна быть в куках после перехода по ссылке, но технически аккаунт еще донастраивается).
- В `AuthContainer.tsx`:
  - **УДАЛИТЬ** логику пошаговой формы ('email' -> 'otp'). Оставить единую логику `Email + Password` для авторизации.
  
### Тестирование (Vitest)
Существующие unit-тесты (их порядка 75 штук) **упадут**, так как мы меняем API и структуру компонентов авторизации.
Вам необходимо **обязательно актуализировать** unit тесты:
- УДАЛИТЬ тесты для `OTPVerificationForm.test.tsx`.
- Написать/переписать тесты для нового `LoginForm` (email + пароль).
- Добавить тесты для `UpdatePasswordForm`.
- Обновить тесты `AuthContainer.test.tsx` и `auth.test.ts`, удалив всё, что связано с OTP, и добавив проверки для пароля.
- Обновить тесты Route Handler'ов и Middleware при необходимости (учитывая `/auth/confirm` и `update-password`).

Убедитесь, что покрытие тестами не пострадало и все тесты проходят успешно после глубокого рефакторинга.

## Tasks / Subtasks

- [x] Task 1 (AC: 1) Рефакторинг клиентского API Auth
  - [x] Subtask 1.1 В `src/features/auth/api/auth.ts`: удалить старые функции `signInWithOtp` и `verifyOtp`.
  - [x] Subtask 1.2 Добавить функции `signInWithPassword({ email, password })` и `updatePassword(password: string)`.
  - [x] Subtask 1.3 Очистить Zustand-стор `src/features/auth/store.ts` от `step: 'email' | 'otp'`.

- [x] Task 2 (AC: 4, 5) Рефакторинг UI компонентов авторизации
  - [x] Subtask 2.1 Удалить компонент `src/features/auth/components/OTPVerificationForm.tsx`.
  - [x] Subtask 2.2 Обновить `LoginForm.tsx`: добавить поле пароля, обновить UI.
  - [x] Subtask 2.3 Переписать `AuthContainer.tsx`: использовать вызов `signInWithPassword`, убрать двухшаговую логику.

- [x] Task 3 (AC: 2) Обработка Email Confirm ссылок
  - [x] Subtask 3.1 Переименовать директорию `src/app/auth/callback` в `src/app/auth/confirm` (или обновить роут).
  - [x] Subtask 3.2 В `route.ts` обработать параметры `token_hash` и `type`.
  - [x] Subtask 3.3 После успешного `verifyOtp` (если `type === 'signup'` или `recovery`) перенаправить на страницу установки пароля (`/update-password`).

- [x] Task 4 (AC: 1, 3) Создание страницы и компонента установки/обновления пароля
  - [x] Subtask 4.1 Создать компонент `UpdatePasswordForm.tsx` с полем пароля и его валидацией.
  - [x] Subtask 4.2 Создать страницу `src/app/(app)/update-password/page.tsx` (или `(public)` если нужна публичная доступность без сессии - лучше `(app)` чтобы пользователь уже был авторизован после перехода по ссылке).
  - [x] Subtask 4.3 При отправке формы вызывать `updatePassword`, затем редиректить в `/feed`. после успешного сохранения нового пароля.

- [x] Task 5 Обновление Vitest тестов
  - [x] Subtask 5.1 Удалить устаревшие тесты (для OTP).
  - [x] Subtask 5.2 Актуализировать тесты API, LoginForm и AuthContainer для работы с email/password.
  - [x] Subtask 5.3 Добавить тесты для `UpdatePasswordForm`.
  - [x] Subtask 5.4 Обновить тесты для `route.ts`.

## Dev Agent Record

### Debug Log References

### Completion Notes List

## File List

## Change Log
