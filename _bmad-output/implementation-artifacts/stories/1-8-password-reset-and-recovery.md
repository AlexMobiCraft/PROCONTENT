# Story 1.8: Сброс и восстановление пароля (Forgot Password)

Status: ready-for-dev

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

- [ ] Создать UI для запроса сброса пароля (страница `/forgot-password` или форма на `/login`)
  - [ ] Реализовать форму с полем email и кнопкой отправки
  - [ ] Интегрировать метод `supabase.auth.resetPasswordForEmail`
  - [ ] Убедиться, что `redirectTo` указывает на `[origin]/auth/confirm?type=recovery` (согласно логике в `route.ts`)
  - [ ] Реализовать защиту от user enumeration: всегда показывать успешное сообщение "Если email зарегистрирован, вы получите письмо со ссылкой для сброса пароля"
- [ ] Создать страницу обновления пароля (`/update-password`)
  - [ ] Реализовать форму ввода нового пароля (с подтверждением)
  - [ ] Интегрировать метод `supabase.auth.updateUser` для обновления пароля
  - [ ] После успешного обновления перенаправить пользователя в личный кабинет / ленту
- [ ] Обработка ошибок
  - [ ] Использовать Toasts для вывода системных ошибок (например, проблем с сетью)
  - [ ] Инлайн-валидация длины пароля и совпадения полей

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

Cascade

### Debug Log References

### Completion Notes List

### File List

- `src/features/auth/components/ForgotPasswordForm.tsx`
- `src/features/auth/components/UpdatePasswordForm.tsx`
- `src/app/(public)/forgot-password/page.tsx`
- `src/app/(public)/update-password/page.tsx`
