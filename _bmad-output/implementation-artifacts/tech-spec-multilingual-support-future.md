---
title: 'Перевод всего контента сайта на Словенский язык'
slug: 'translate-content-slovenian'
created: '2026-03-21T13:08:16+01:00'
status: 'ready-for-dev'
stepsCompleted: [1, 2, 3, 4]
tech_stack: ['Next.js 16 App Router', 'next-intl', 'Supabase Auth', 'Tailwind', 'Shadcn']
files_to_modify: ['src/app/* (перенос в [locale])', 'src/proxy.ts', 'next.config.mjs', 'src/components/navigation/MobileNav.tsx', 'src/i18n/*', 'global.d.ts', 'app/sitemap.ts']
code_patterns: [
  'next-intl App Router structure',
  'proxy.ts Server Middleware exclusion with strict matcher',
  'Server/Client Components split',
  'next-intl/navigation wrapper replacement',
  'Type-safe translations',
  'SEO Internationalization'
]
test_patterns: ['E2E / manual localization flow test', 'API redirects test', 'SEO Metadata verification']
---

# Tech-Spec: Перевод всего контента сайта на Словенский язык

**Created:** 2026-03-21

## Overview

### Problem Statement

Словенская аудитория сайта не имеет возможности читать контент и взаимодействовать с интерфейсом (кнопками, сообщениями, меню и т.д.) на родном языке. Текущие тексты захардкожены на русском языке, что делает сайт недоступным для пользователей из Словении, а также не оптимизировано SEO для словенского региона.

### Solution

Необходимо интегрировать библиотеку интернационализации `next-intl` в архитектуру Next.js 16 App Router. Процесс разделен на инфраструктурный этап и этап наполнения словарями. Локализация затронет не только интерфейс, но и транзакционные письма, SEO-теги, Sitemap валидацию форм (Zod) и форматы дат.

### Scope

**In Scope:**
- Интеграция `next-intl`. Поддерживаемые локали: `sl` (словенский - по умолчанию) и `ru` (русский - fallback).
- Настройка роутинга через префикс в URL (например, `/sl/`).
- **(UX Update)** Включение автоматического определения локали по заголовкам браузера (`localeDetection: true`), чтобы существующие русскоязычные пользователи продолжали попадать на `ru`, а новые пользователи — на `sl` (по дефолту).
- Разделение всего статического текста и замена его на `useTranslations()` в клиенте или `getTranslations()` на сервере.
- Рефакторинг всех компонентов навигации (`Link`, `useRouter`, `redirect`) на использование оберток из `src/i18n/routing.ts`.
- Разработка UI-компонента переключения языка (Dropdown Select) с обязательным сохранением параметров запроса (`?search=foo`).
- Настройка `src/proxy.ts` (middleware) с жестким оптимизированным **Matcher'ом**, который исключит `_next`, `api`, `auth`, `favicon.ico`, `robots.txt` и PWA-ассеты, чтобы спасти производительность и TTFB.
- Создание глобального обработчика 404 (`not-found.tsx`).
- Внедрение строгой типизации для ключей перевода через `global.d.ts`.
- **Zod & Форматирование:** Перевод сообщений ошибок валидационных схем (Zod) и настройка дефолтных форматов (`timeZone`, дат и валют) в `request.ts`.
- **SEO & Sitemap:** Настройка динамического `generateMetadata` для заголовков/description и настройка `sitemap.xml` с генерацией альтернативных ссылок (`hreflang`).
- **Локализация Email-шаблонов Supabase:** Проброс текущей локали через `user_metadata` или `options.data` и использование Go-Template синтаксиса в Supabase Dashboard: `{{if eq .Data.locale "ru"}}...{{else}}...{{end}}`.
- Корректировка хардкодных редиректов внутри API-эндпоинтов, использование куки `NEXT_LOCALE` (и `Accept-Language` фоллбека) для правильного определения URL перенаправления (например `/sl/feed`).

**Out of Scope:**
- Перевод динамического пользовательского контента из базы данных.
- Перевод пользовательского ввода.
- Перевод комментариев в коде (комментарии в исходном коде строго остаются на русском языке, так как разработчик пишет на русском).

## Context for Development

### Codebase Patterns

- Next.js 16 App Router: все маршруты переносятся в `src/app/[locale]/`. 
- Маршрутизаторы API (`api` / `auth`) остаются в корне `src/app/` и работают без префиксов.
- Словари локализации: вместо гигантских 10-тысячестрочных файлов, структурировать JSON по неймспейсам или папкам (напр. `messages/ru/common.json`, `messages/ru/auth.json`), а `request.ts` будет собирать их (deep merge) или отдавать секциями.
- Интеграция с Zod: локализация схем происходит либо в Server Actions через `getTranslations()`, либо с использованием кастомной Error Map через библиотеку `zod-i18n-map`.

### Technical Decisions

- **Этапность (Phasing):** Вначале создается и тестируется критическая инфраструктура, маршрутизация, SEO-тёги, API-перехваты. После стабилизации — извлечение строк на протяжении приложения.
- **Fallback Language:** `ru`.
- **Default Locale:** `'sl'`. Авто-определение включено.

## Implementation Plan

### Tasks

- [ ] Task 1: Настройка конфигурации пакета `next-intl` и строгой типизации
  - File: `next.config.mjs`, `src/i18n/routing.ts`, `src/i18n/request.ts`, `global.d.ts`
  - Action: Установить `next-intl`. Настроить `routing.ts` (`locales: ['sl', 'ru']`, `defaultLocale: 'sl'`, `localeDetection: true`). Настроить `request.ts` (загрузка словарей, настройка форматов времени и дат). В `next.config.mjs` явно добавить путь в плагин `withNextIntl('./src/i18n/request.ts')`. Создать `global.d.ts` для автокомплита типов `IntlMessages`.
- [ ] Task 2: Расширенная настройка Server Middleware (Proxy)
  - File: `src/proxy.ts`
  - Action: Настроить `matcher` RegExp (исключить `/api`, `_next`, `favicon.ico`, `robots.txt`, `sitemap.xml` и публичную статику). Добавить логику: сначала `supabase.auth.getSession()` (только для защищенных путей во избежание оверхеда), затем редиректы Next-Intl.
- [ ] Task 3: Реструктуризация дерева папок App Router, SEO и Sitemap
  - File: `src/app/*`, `src/app/not-found.tsx`, `src/app/sitemap.ts`
  - Action: Переместить маршруты UI в `src/app/[locale]/`. В `[locale]/layout.tsx` внедрить `<html lang={locale}>`. Заменить статические `metadata` на динамические `generateMetadata({ params: { locale } })` на страницах. Настроить `not-found.tsx`.
- [ ] Task 4: Рефакторинг механизмов навигации и исправление абсолютных редиректов API
  - File: Глобально по проекту (UI-компоненты) + `auth/confirm/route.ts`
  - Action: В Client и Server компонентах заменить импорты `next/link` на `src/i18n/routing.ts`. В API-роутах заменить хардкодный редирект (`/feed`) на локализованный, считывая куку `NEXT_LOCALE` и заголовок `Accept-Language` для определения языка юзера, если cookie отсутствует.
- [ ] Task 5: Создание компонента Language Switcher
  - File: `src/components/navigation/LanguageSwitcher.tsx`, `src/components/navigation/MobileNav.tsx`
  - Action: Разработать Client-компонент, вызывающий `useRouter.replace({ pathname, query })` с передачей параметров URL при смене языка, предотвращая их очистку.
- [ ] Task 6: Модульные словари и замещение хардкодных строк
  - File: `messages/[locale]/*.json` (разбитые по модулям), UI Components
  - Action: Создать модульную структуру словарей (напр. `auth.json`, `nav.json`). Извлечь тексты. Использовать `useTranslations('auth')` в компонентах без прокидывания всех словарей в клиент (избегая bloat бандла). Перевести на словенский (`sl`). Внедрить локализацию Zod-схем.
- [ ] Task 7: Настройка транзакционных писем Supabase с Go-Templates
  - File: Вызовы методов Supabase SDK + Supabase Dashboard
  - Action: Пробрасывать локаль в `options.data.locale`. В Supabase Dashboard настроить шаблоны Email с использованием Go-шаблонизатора (`{{if eq .Data.locale "ru"}}Привет{{else}}Pozdravljeni{{end}}`).

### Acceptance Criteria

- [ ] AC 1: Given существующий пользователь с русскими системными заголовками браузера впервые заходит на `/`, when срабатывает автоопределение, then происходит редирект на `/ru/`, а не на дефолтный словенский (localeDetection: true работает).
- [ ] AC 2: Given пользователь на странице `/sl/shop?sort=asc`, when он меняет язык на русский через Switcher, then URL меняется на `/ru/shop?sort=asc` (параметры сохраняются).
- [ ] AC 3: Given разработчик пишет вызов `t('auth.no_such_key')`, when код компилируется, then TypeScript выдает ошибку Typescript TS2345.
- [ ] AC 4: Given поисковой бот загружает страницу `/sl/pricing`, when он парсит HTML, then `<html lang="sl">` указан, `title` и `description` на словенском, а в `sitemap.xml` есть теги `hreflang="sl"` и `hreflang="ru"`.
- [ ] AC 5: Given валидационная схема (Zod) отлавливает ошибку пустой формы, when пользователь находится на `/sl/login`, then спан с ошибкой отображает словенский текст.
- [ ] AC 6: Given вызов `proxy.ts`, when браузер запрашивает `/favicon.ico` или `/api/auth/confirm`, then HTTP-запросы проходят в обход i18n middleware, экономя время TTFB, и Supabase Auth Callback отправляет пользователя на правильный путь (напр. `/ru/feed`).
- [ ] AC 7: Given вызывается процесс `resetPasswordForEmail`, when Supabase генерирует письмо, then синтаксис Go-шаблона выбирает контент на словенском (если локаль "sl").

## Dependencies & Testing Strategy

- `next-intl` и плагины. Возможна установка `zod-i18n-map`.
- SEO Аудит: локальный запуск Lighthouse для проверки a11y атрибутов `<html lang>`.
- Тест архитектуры писем: инициировать сброс пароля при словенской и русской локалях по очереди и верифицировать язык полученных email-сообщений.
