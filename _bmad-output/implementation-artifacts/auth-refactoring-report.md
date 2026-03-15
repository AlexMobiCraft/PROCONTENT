# Отчет по рефакторингу системы авторизации (Email/Password)

## Контекст
Проект был переведен с системы **Magic Link/OTP** (двухэтапный вход по коду) на классическую систему **Email + Пароль**. Это потребовало полной переработки UI и серверной логики подтверждения почты.

## Технический стек
- **Next.js**: Версия 16.1.6 (используется новая система `proxy.ts` вместо `middleware.ts`).
- **Supabase Auth**: Используется **PKCE Flow** (Server-Side confirmation).

## Реализованные компоненты
1. `src/features/auth/api/auth.ts`: Добавлены `signInWithPassword` и `updatePassword`. Удалены OTP-методы.
2. `LoginForm.tsx` & `AuthContainer.tsx`: Обновлены для ввода email и пароля в один шаг.
3. `UpdatePasswordForm.tsx`: Новый компонент для установки пароля после перехода по ссылке.
4. `src/app/auth/confirm/route.ts`: Основной серверный обработчик для `verifyOtp`.

## Ключевые проблемы и решения

### 1. Переход на PKCE Flow (Email Templates)
**Проблема**: По умолчанию ссылки в Supabase генерируются в формате *Implicit Flow* (токены после `#`). Это не позволяет серверному роуту Next.js обработать подтверждение.
**Решение**: В панели Supabase (Authentication -> Email Templates) ссылки были вручную изменены на формат PKCE:
```text
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup  (или type=recovery)
```

### 2. Next.js 16 Proxy и "Сжигание" токенов
**Проблема**: Одноразовые токены Supabase (`token_hash`) аннулируются при первом же обращении. В Next.js 16 файл `proxy.ts` (новое название для Middleware) перехватывает все запросы. Если прокси вызывает `getUser()` для обновления сессии до того, как роут подтверждения вызовет `verifyOtp`, ссылка станет недействительной.
**Решение**: В `src/proxy.ts` добавлено исключение:
```typescript
if (request.nextUrl.pathname.startsWith('/auth/confirm')) {
  return; 
}
```
Это позволяет запросу на подтверждение дойти до целевого роута "чистым".

### 3. Двойные запросы (Double Requests)
**Проблема**: Браузеры или боты в Vercel могут делать "пре-фетчинг" или дублировать запросы, что мгновенно аннулирует ссылку `verifyOtp`.
**Решение**: В роуте `src/app/auth/confirm/route.ts` добавлена проверка `supabase.auth.getUser()`. Если пользователь уже авторизован (токен сработал в первом запросе), мы не вызываем `verifyOtp` повторно, а просто редиректим его на `/update-password`.

### 4. Статическое именование в Next.js 16
**Проблема**: В версии 16 файл `middleware.ts` игнорируется, если используется `proxy.ts`. 
**Решение**: Файл `middleware.ts` удален, вся логика обновлений сессий перенесена в `src/proxy.ts`.

## Критические настройки в Supabase Dashboard
Для корректной работы системы **обязательно** должны быть установлены:
- **Authentication -> URL Configuration**: `SITE_URL` = `https://procontent-ten.vercel.app`.
- **Authentication -> Email Auth**: `Secure email change` = OFF.
- **Email Templates**: Ссылки должны содержать `?token_hash=` (PKCE), а не быть стандартными `{{ .ConfirmationURL }}`.

## Текущий статус
Система оттестирована локально и на Vercel (47 тестов Vitest проходят). Если при переходе по ссылке возникает ошибка `Email link is invalid or has expired`, это означает, что токен всё еще сгорает до подтверждения (проверить настройки провайдера почты или Vercel Deployment).
