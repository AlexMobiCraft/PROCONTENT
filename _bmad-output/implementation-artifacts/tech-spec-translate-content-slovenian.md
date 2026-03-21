---
title: 'Перевод всего контента сайта на Словенский язык'
slug: 'translate-content-slovenian'
created: '2026-03-21T13:08:16+01:00'
status: 'ready-for-dev'
stepsCompleted: [1, 2, 3, 4]
tech_stack: ['Next.js 16 App Router', 'next-intl', 'Supabase Auth', 'Tailwind', 'Shadcn']
files_to_modify: ['src/app/* (перенос в [locale])', 'src/proxy.ts', 'next.config.mjs', 'src/components/navigation/MobileNav.tsx', 'src/i18n/*']
code_patterns: ['next-intl App Router structure', 'proxy.ts Server Middleware exclusion', 'Server/Client Components split', 'next-intl/navigation wrapper replacement']
test_patterns: ['E2E / manual localization flow test']
---

# Tech-Spec: Перевод всего контента сайта на Словенский язык

**Created:** 2026-03-21T13:08:16+01:00

## Overview

### Problem Statement

Словенская аудитория сайта не имеет возможности читать контент и взаимодействовать с интерфейсом (кнопками, сообщениями, меню и т.д.) на родном языке. Текущие тексты захардкожены на русском языке, что делает сайт недоступным для пользователей из Словении.

### Solution

Необходимо интегрировать библиотеку для интернационализации `next-intl` в архитектуру Next.js 16 App Router. Рефакторинг планируется в два логических этапа:
1. Настройка инфраструктуры локализации (роутинг, `proxy.ts`, оборачивание `app` в `[locale]`, создание конфигов `i18n`).
2. Извлечение захардкоженных русских строк из компонентов в JSON-словари `ru.json` и их последующий перевод в `sl.json`.

### Scope

**In Scope:**
- Интеграция `next-intl` для Next.js 16 App Router. Поддерживаемые локали: `sl` (словенский - по умолчанию) и `ru` (русский - fallback).
- Настройка роутинга через префикс в URL (например, `/sl/`).
- Отключение автоматического определения локали по заголовкам браузера (`localeDetection: false`).
- Разделение всего статического текста и замена его на механизмы `useTranslations()`.
- Рефакторинг всех компонентов `next/link` и `next/navigation` (`useRouter`, `redirect`) на использование оберток из отдельного файла навигации (например `src/i18n/routing.ts`).
- Разработка UI-компонента переключения языка (Dropdown Select) и его интеграция в навигационную панель (`src/components/navigation/MobileNav.tsx`).
- Настройка логики в `src/proxy.ts` для поддержки i18n с исключением перехвата API роутов (например `/api/auth/confirm`), чтобы не ломать Supabase Auth.
- **Локализация Email-шаблонов Supabase:** Проброс текущей локали через `options.data` (или `user_metadata`) при вызове методов аутентификации (`signUp`, `resetPasswordForEmail`) и адаптация Email Templates в дашборде Supabase.

**Out of Scope:**
- Перевод динамического пользовательского контента (напр. постов базы данных).
- Перевод пользовательского ввода.

## Context for Development

### Codebase Patterns

- Next.js 16 App Router: клиентские и серверные маршруты `(app)` и `(public)`, а также все основные layout/page переносятся в структуру `src/app/[locale]/`. 
- Маршрутизаторы API (`src/app/api`, `src/app/auth`) остаются в корне `src/app/` и не затрагиваются переадресацией `next-intl`.
- **CRITICAL:** `src/proxy.ts` объединит в себе логику редиректов `next-intl` и обновления сессии Supabase, однако `/auth/confirm` должен возвращать ответ до любой i18n-логики.

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `src/app/[locale]/layout.tsx` | Основной layout, который должен быть обернут в `NextIntlClientProvider` |
| `src/proxy.ts` | Точка перехвата запросов (согласно Next.js 16). Замена старого `middleware.ts` |
| `src/i18n/request.ts` | Настройка механизма загрузки словарей для RSC в `next-intl` |
| `src/i18n/routing.ts` | Конфигурация локалей (sl, ru) и создание оберток навигации для Next.js |
| `docs/stripe-supabase-nextjs16-auth-flow.md` | Правила исключения роутов Next.js маршрутов для `proxy.ts` |

### Technical Decisions

- **Этапность (Phasing):** Вначале создается и тестируется инфраструктура на базе `next-intl`. Во вторую очередь в коде массово заменяются хардкорные строки на переменные перевода.
- **Fallback Language:** `ru`. Все существующие тексты изначально извлекаются в `ru.json`.
- **Default Locale:** `'sl'`.
- **Интеграция Supabase:** Не затрагивать `/api` и `/auth` роуты редиректами локали.

## Implementation Plan

### Tasks

- [ ] Task 1: Настройка конфигурации пакета `next-intl`
  - File: `next.config.mjs`, `src/i18n/routing.ts`, `src/i18n/request.ts`
  - Action: Установить `next-intl`. Добавить плагин `withNextIntl` в конфигурацию сборки Next.js. Создать `routing.ts` с указанием массива локалей `['sl', 'ru']`, `defaultLocale: 'sl'` и `localeDetection: false`. Создать `request.ts` для подгрузки нужных JSON-файлов для Server Components.
- [ ] Task 2: Создание инфраструктуры Server Middleware для маршрутизации локалей
  - File: `src/proxy.ts`
  - Action: Импортировать `createMiddleware` из `next-intl/middleware`. Обновить экспорт `proxy` функции так, чтобы сначала обновлялась сессия Supabase, а затем применялся редирект локали, исключая префиксом API роуты, статику (`_next`) и `/auth/confirm`. 
- [ ] Task 3: Реструктуризация дерева папок App Router
  - File: `src/app/*`
  - Action: Создать директорию `src/app/[locale]`. Переместить в нее группы маршрутов `(app)` и `(public)`, а также глобальные файлы `layout.tsx`, `page.tsx`, `error.tsx`, `loading.tsx`, `inactive`. Папки `api` и `auth` оставить в корне `src/app`.
  - Notes: Обернуть главный экспортируемый компонент в `src/app/[locale]/layout.tsx` провайдером `NextIntlClientProvider` с передачей `messages`.
- [ ] Task 4: Рефакторинг механизмов навигации
  - File: Глобально по проекту.
  - Action: Заменить все импорты `Link`, `useRouter`, `usePathname`, `redirect` из встроенных пакетов `next/*` на их аналоги, экспортируемые из `src/i18n/routing.ts`.
- [ ] Task 5: Создание компонента Language Switcher
  - File: `src/components/navigation/LanguageSwitcher.tsx`, `src/components/navigation/MobileNav.tsx`
  - Action: Разработать Client-компонент в виде Dropdown для смены языка. Компонент вызывает функцию `useRouter.replace()` из настроенного конфига `next-intl` для перезагрузки текущего `pathname` с новой локалью (например с `sl` на `ru`). Интегрировать компонент рядом с селектором/информацией профиля пользователя.
- [ ] Task 6: Замещение хардкодных строк и словари (Этап 2)
  - File: `messages/sl.json`, `messages/ru.json`, UI Components.
  - Action: Извлечь статичные тексты интерфейса в словарь `ru.json`. Перевести аналогичный файл `sl.json`. Интегрировать везде хуки `useTranslations()` или вызовы `t('key')` в Server/Client компонентах.
- [ ] Task 7: Проброс локали в транзакционные письма Supabase
  - File: Вызовы методов `supabase.auth.signUp` и `supabase.auth.resetPasswordForEmail`
  - Action: Извлечь текущую локаль и передать её в `options.data.locale` при вызовах Auth API. В дашборде Supabase Auth/Email Templates добавить условия для отправки переведенных писем.

### Acceptance Criteria

- [ ] AC 1: Given новый неопознанный пользователь заходит на корень `/`, when страница загружается, then происходит редирект на `/sl/` без ошибок 404.
- [ ] AC 2: Given пользователь переходит на `/ru/about` по прямой ссылке, when страница отрисовывается, then язык интерфейса русский, и автоматический редирект на `/sl` не происходит (localeDetection = false).
- [ ] AC 3: Given пользователь нажимает на компонент выбора языка в `MobileNav` и выбирает 'Словенский', when вызов завершен, then URL страницы меняется на `/sl/...`, и компоненты отображаются с использованием словаря `sl.json`.
- [ ] AC 4: Given фронтенд-код делает вызов `fetch` на защищенный роут `/api/some-endpoint`, when запрос проходит `proxy.ts`, then middleware не добавляет `sl` или `ru` к URI API, и данные успешно загружаются.
- [ ] AC 5: Given пользователь регистрируется (signUp), when Supabase генерирует Confirmation Email, then данные о его языке используются для выбора переведенного Email-шаблона.
- [ ] AC 6: Given пользователь переходит по ссылке `/auth/confirm?token_hash=...`, when колбек срабатывает, then редирект на авторизацию и активация Stripe/Подписки не ломается из-за i18n редиректа.

## Additional Context

### Dependencies

- Пакет интернационализации `next-intl`
- Потенциально переводы сторонней библиотеки для дат (`date-fns/locale/sl` или `dayjs/locale/sl`), если используется.

### Testing Strategy

- E2E Тесты на сценарий входа, оплаты и загрузки Dashboard, чтобы удостовериться, что префикс локали не мешает cookie-аутентификации.
- Unit-тесты для функции `proxy.ts` для проверки верности логики Next Request URL Matcher.
- Локальное переключение браузерных языков для верификации `localeDetection: false`.

### Notes

- Самым рискованным блоком является `proxy.ts`. Необходимо совместить обработку сессии Supabase, которая критична для RLS защиты базы данных, и механизмы i18n от `next-intl`. Описание Supabase Auth-миддлвари рекомендует всегда вызывать `supabase.auth.getSession()` перед тем как отдать управление рекодеру i18n.
- Интеграция Stripe Checkout Session (webhook) работает независимо, но `success_url` и `cancel_url` должны генерироваться динамически с актуальным языком пользователя (например `site.com/sl/onboarding`).
