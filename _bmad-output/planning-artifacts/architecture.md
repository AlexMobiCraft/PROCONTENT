---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
workflowType: 'architecture'
lastStep: 8
status: 'complete'
completedAt: '2026-03-06'
inputDocuments: ["{project-root}/_bmad-output/planning-artifacts/prd.md", "{project-root}/_bmad-output/planning-artifacts/ux-design-specification.md"]
project_name: 'PROCONTENT'
user_name: 'Alex'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
- **Контент и Лента:** Клиентский SPA для ленты, поиска, категоризации и отображения медиа.
- **Монетизация и Доступ:** Автоматизированное управление подписками через Stripe Webhooks (блокировка доступа при неоплате).
- **Сообщество:** Одноуровневые комментарии, email-уведомления.
- **Администрирование:** Публикация контента, управление пользователями, выбор превью для лендинга.
- **Миграция:** Разовый импорт архива из Telegram (изолирован от production).

**Non-Functional Requirements:**
- **Производительность:** Mobile-first фокус (iOS Safari, Android Chrome), быстрая загрузка медиа (требуется CDN).
- **Архитектурные ограничения:** v1 — это чисто клиентский SPA (SSR перенесен в v1.1), стандартные HTTP-запросы для комментариев (WebSockets перенесены в v1.1).
- **UI/UX Архитектура:** Строгое разделение UI (dumb components) и бизнес-логики, Skeleton-загрузчики, мобильная навигация (Bottom Bar), touch-ready интерфейсы (44x44px).

**Scale & Complexity:**
- **Primary domain:** Web / Full-stack (платформа сообщества на базе эксперта)
- **Complexity level:** Low-Medium
- **Estimated architectural components:** Умеренное количество (Модуль Auth/Stripe, Модуль Контента/Ленты, Модуль Комментариев, Админ-панель).

### Technical Constraints & Dependencies

- **Ресурсы:** Один full-stack разработчик (требует простого, стандартного стека технологий и чистой документации).
- **Интеграции:** Stripe API (жизненный цикл подписок и webhooks).
- **Инфраструктура:** CDN / Провайдер медиа-хранилища для надежного воспроизведения мобильного видео.

### Cross-Cutting Concerns Identified

- **Authentication & Authorization:** JWT + проверка статуса Stripe для защиты маршрутов и контента.
- **Media Management:** Загрузка, обработка и эффективная отдача изображений/видео.
- **State Management:** Кэширование ленты, управление состоянием UI (MobileNav, Bottom Sheets) и изолированное состояние дерева комментариев.

## Starter Template Evaluation

### Primary Technology Domain

Web / Full-stack Application based on project requirements analysis (SPA для MVP, SSR/SSG для Phase 1.1).

### Starter Options Considered

- **Vite + React + TypeScript:** Идеально подходит для чистого SPA (как требуется в v1), быстрая сборка, минимальный overhead. Однако внедрение SSR/SSG в v1.1 потребует значительных усилий или миграции.
- **Next.js (App Router) + TypeScript:** Идеально покрывает как v1 (клиентские компоненты для SPA-зоны), так и v1.1 (SSR/SSG для публичных страниц). Упростит реализацию гибридной стратегии рендеринга из PRD без необходимости переписывать архитектуру.

### Selected Starter: Next.js

**Rationale for Selection (Architecture Decision Record):**
Ограничение в "одного разработчика" делает архитектурные миграции крайне рискованными. Переход с Vite (чистый SPA) на Next.js (SSR) в Фазе 1.1, как указано в PRD для целей SEO, может остановить развитие продукта или потребовать создания второго независимого приложения для лендинга. 

Использование Next.js изначально, с осознанным применением клиентских компонентов (`use client`) для зоны авторизованных пользователей, удовлетворяет требованиям SPA MVP. Это также решает UX-требования "mobile-first" и медиа-контента благодаря встроенной автоматической оптимизации изображений (Next/Image), что критически важно для производительности на мобильном интернете без сложной ручной настройки CDN. 

**Ключевые паттерны реализации для снятия рисков:**
1. **SPA Навигация:** Обязательное использование вложенных `Layouts` в App Router для Bottom Navigation, чтобы обеспечить мгновенный отклик без перерендера общих элементов UI (сохранение состояния).
2. **Медиа-оптимизация:** Обязательное использование встроенных инструментов (`next/image`) для автоматической оптимизации тяжелого контента.

**Initialization Command:**

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
```

**Architectural Decisions Provided by Starter:**

**Language & Runtime:**
TypeScript для строгой типизации поверх Node.js/React.

**Styling Solution:**
Tailwind CSS сконфигурирован по умолчанию (идеально для реализации mobile-first UI и изолированных компонентов).

**Build Tooling:**
Next.js встроенный сборщик (Turbopack/Webpack) с автоматической оптимизацией медиа-ресурсов (важно для видео и фото контента платформы).

**Testing Framework:**
Не включен по умолчанию (потребует настройки Vitest/Jest отдельно, если необходимо).

**Code Organization:**
App Router в директории `src/app`, file-system based routing с поддержкой вложенных layout-ов, что хорошо подходит для разделения публичной (marketing) и приватной (app) зон.

**Development Experience:**
React Fast Refresh, настроенный ESLint, удобная работа с переменными окружения (.env).

**Note:** Project initialization using this command should be the first implementation story.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
- Data Architecture & Auth (Supabase)
- Frontend State Management (Zustand)
- Infrastructure & Hosting (Vercel)

**Important Decisions (Shape Architecture):**
- Stripe Integration Pattern (Webhooks)
- Media Storage Pattern (Supabase Storage + Next/Image)

**Deferred Decisions (Post-MVP):**
- WebSockets/Real-time комментарии (отложено до v1.1)
- SSR для публичных страниц (SEO отложено до v1.1, MVP использует клиентские компоненты)

### Data Architecture, Authentication & Security

- **Decision:** PostgreSQL + Supabase Auth
- **Version:** Supabase (Latest 2.x)
- **Rationale:** В условиях "одного разработчика" требуется надежное Backend-as-a-Service (BaaS) решение. Supabase закрывает три критических направления из PRD: Аутентификацию, Реляционную Базу Данных (Postgres) и Хранилище (Storage) для видео/фото. Интегрируется со Stripe через Webhooks.
- **Affects:** Auth Module, User Profiles, Content Feed

### Frontend Architecture (State Management)

- **Decision:** Zustand
- **Version:** Zustand v5.x
- **Rationale:** В UX-спецификации описана сложная система изолированных UI-компонентов (MobileNav, Bottom Sheets, вложенные комментарии). Zustand обеспечивает легкое (minimal bundle size), атомарное управление глобальным состоянием UI без boilerplate-кода Redux и без проблем с перерендерами, свойственных React Context.
- **Affects:** UI State (MobileNav, Modals, Sheets), Caching Strategy

### Infrastructure & Deployment

- **Decision:** Vercel
- **Version:** N/A (Cloud Platform)
- **Rationale:** Нулевая конфигурация для Next.js. Автоматический CI/CD pipeline из GitHub. "Из коробки" поддерживает оптимизацию изображений (Next/Image), что критично для мобильного медиа-контента платформы. Полностью снимает DevOps-нагрузку с разработчика.
- **Affects:** Deployment Pipeline, Environment Configuration, Image Optimization

### Decision Impact Analysis

**Implementation Sequence:**
1. Next.js Repository Initialization
2. Supabase Project Setup & Schema Definition
3. Vercel Project Link & CI/CD Setup
4. Auth Integration (Supabase Auth)
5. Stripe Webhooks Integration
6. Global State (Zustand) + UI Shell (MobileNav)

**Cross-Component Dependencies:**
- **Auth → Stripe:** Статус подписки (Stripe) должен обновлять `app_metadata` в Supabase Auth для защиты маршрутов Next.js на стороне клиента.
- **Supabase Storage → Next.js:** Медиафайлы из Supabase должны обслуживаться через пайплайн оптимизации Vercel (Next/Image) для соблюдения требований производительности.

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

**Critical Conflict Points Identified:**
4 области, где AI-агенты могли бы принять разные решения (Структура папок, Именование данных, Архитектура компонентов, Обработка ошибок).

### Structure Patterns

**Project Organization (Feature-based with UI exceptions):**
Код организован по фичам, а не по типу файлов. Каждая фича имеет свою изолированную папку в `src/features/*`.
*Исключение:* Базовые "глупые" элементы интерфейса (кнопки, инпуты) хранятся централизованно в `src/components/ui/` для глобального переиспользования.
- **Good:** `src/features/feed/components/`, `src/features/feed/api/`, `src/components/ui/Button.tsx`
- **Anti-pattern:** Сваливать все компоненты приложения в `src/components` (кроме базовых UI) или создавать изолированные кнопки внутри каждой фичи.

### Naming & Data Format Patterns

**Database & TS Models Naming (Supabase Direct):**
Используем `snake_case` как стандарт для моделей данных, чтобы избежать маппинга между БД (PostgreSQL) и клиентом. Используем типы, сгенерированные SupabaseCLI напрямую.
*Критическое правило:* В конфигурации ESLint обязательно отключается проверка `camelcase` для свойств объектов базы данных.
- **Good:** `user.first_name`, `post.created_at`
- **Anti-pattern:** Написание кастомных сериализаторов/мапперов для перевода в `camelCase` (например, `const user = { firstName: data.first_name }`).

### Component Patterns

**Smart Container / Dumb UI & Skeletons:**
Строгое разделение визуального представления и бизнес-логики.
- **Dumb UI:** Визуальные компоненты (например, `PostCard`) "глупые", получают только `props` и вызывают `callbacks`. Они не импортируют Zustand или Supabase.
- **Skeleton State:** Dumb-компоненты принимают проп `isLoading` и самостоятельно рендерят свое Skeleton-состояние (а не оборачиваются в Skeleton снаружи), чтобы обеспечить плавные UI-переходы.
- **Smart Containers:** Обертки-контейнеры подписываются на Zustand, делают вызовы к Supabase API и прокидывают данные и состояние загрузки вниз в Dumb UI компоненты.

### Process Patterns

**Error Handling (Hybrid Approach):**
Централизованная обработка системных ошибок + локальная для форм.
- **Системные ошибки (загрузка данных, мутации API):** AI-агенты должны вызывать глобальный стор уведомлений (Toasts) для информирования пользователя.
- **Ошибки валидации (формы):** Должны отображаться инлайн рядом с полем ввода.
- **Good:** `toast.error(error.message)` в блоке catch сервиса; текст под инпутом для ошибок формы.
- **Anti-pattern:** Локальный `useState` для системной ошибки (пользователь не заметит) или Toast для ошибки "пароль слишком короткий".

### Enforcement Guidelines

**All AI Agents MUST:**
- Создавать новые модули внутри `src/features/`.
- Использовать `src/components/ui/` для базовых компонентов.
- Использовать `snake_case` для полей данных БД (ESLint настроен на это).
- Разделять UI и получение данных на Dumb/Smart сущности.
- Реализовывать Skeletons внутри Dumb-компонентов.
- Использовать Toasts для системных ошибок и inline-вывод для ошибок форм.

## Project Structure & Boundaries

### Complete Project Directory Structure

```text
procontent/
├── package.json
├── next.config.mjs
├── tailwind.config.ts
├── tsconfig.json
├── .eslintrc.json              # Настроен на игнорирование camelcase для DB
├── .env.local                  # Supabase & Stripe ключи
├── supabase/                   # Конфигурация локального Supabase
│   └── config.toml
├── scripts/                    # Изолированные скрипты вне production
│   └── telegram_migration.ts   # Скрипт миграции архива (v1)
├── tests/                      # Инфраструктура тестирования
│   ├── unit/
│   └── e2e/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (public)/           # Публичная зона (Лендинг, SSR/SSG в v1.1)
│   │   │   └── page.tsx        
│   │   ├── (app)/              # Приватная SPA-зона (Лента, Поиск, Профиль)
│   │   │   ├── layout.tsx      # Содержит MobileNav и UI State Provider
│   │   │   └── feed/page.tsx   
│   │   ├── (admin)/            # Защищенная зона автора
│   │   │   ├── layout.tsx      # Проверка роли 'admin'
│   │   │   └── dashboard/page.tsx
│   │   ├── api/                # Next.js Route Handlers
│   │   │   └── webhooks/
│   │   │       └── stripe/     # Защищенный эндпоинт для Stripe
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/                 # Изолированные "глупые" компоненты (Button, Input, Skeleton, Toast)
│   │   └── layout/             # Глобальные слои (MobileNav, ErrorBoundary, BottomSheetWrapper)
│   ├── features/               # Бизнес-логика (Feature-based)
│   │   ├── auth/               # Авторизация и доступ (Stripe)
│   │   │   ├── components/     # Формы логина, пейволы
│   │   │   ├── api/            # Supabase auth calls
│   │   │   └── store.ts        # Zustand auth state
│   │   ├── feed/               # Лента и контент
│   │   │   ├── components/     # Smart: FeedContainer / Dumb: PostCard
│   │   │   ├── api/            # Supabase data calls
│   │   │   └── store.ts        # Zustand feed state (кэш, активная категория)
│   │   ├── comments/           # Обсуждения
│   │   │   └── components/     # DiscussionNode
│   │   └── admin/              # Панель автора (логика управления)
│   ├── lib/
│   │   ├── supabase/           # Инициализация Supabase Client
│   │   │   ├── server.ts       # Для серверных компонентов и Route Handlers
│   │   │   └── client.ts       # Для клиентских компонентов
│   │   ├── stripe/             # Stripe helpers
│   │   └── utils.ts            # Утилиты (например, tailwind-merge)
│   └── types/
│       ├── supabase.ts         # Автосгенерированные типы БД (snake_case)
│       └── index.ts            
```

### Architectural Boundaries

**API & Data Boundaries:**
- **Client-Side Data Fetching (SPA):** Все запросы на чтение данных (лента, комментарии) происходят напрямую из клиентских компонентов (`use client`) через `lib/supabase/client.ts`, минуя Next.js API Routes. Это обеспечивает мгновенный отклик и классический SPA-опыт.
- **Server-Side Mutations & Webhooks:** Next.js Route Handlers (`/api/webhooks/*`) и `lib/supabase/server.ts` используются ИСКЛЮЧИТЕЛЬНО для безопасного взаимодействия со сторонними серверами (Stripe Webhooks) и серверной логики админки.

**Component Boundaries:**
- Компоненты внутри `src/features/[name]/components/` делятся на `Containers` (Smart - имеют доступ к `store.ts` и `api/`) и `Views` (Dumb).
- `src/components/ui/` НЕ ИМЕЕТ права импортировать что-либо из `src/features/`.

**State Boundaries:**
- Глобальное UI-состояние (открыта ли шторка навигации, активный таб) живет в глобальном Zustand-сторе (layout слой).
- Бизнес-стейт (закэшированная лента, текущий пользователь) изолирован внутри `src/features/[name]/store.ts`.

### Requirements to Structure Mapping

**Feature/Epic Mapping:**
- **MVP Content Feed:** `src/features/feed/` (Включает `PostCard`, `CategoryScroll`, пагинацию через Supabase).
- **Stripe Subscription Management:** `src/features/auth/` (Проверка `app_metadata` статуса) + `src/app/api/webhooks/stripe` (Обновление статуса в Supabase).
- **Engagement / Comments:** `src/features/comments/` (Включает логику плоского списка комментариев из UX-спецификации).
- **Mobile Navigation UI:** `src/components/layout/MobileNav.tsx` (Отображается в `(app)/layout.tsx`).
- **Telegram Migration:** Изолирована в `scripts/telegram_migration.ts` (выполняется локально).

### Integration Points

**Data Flow (Authentication -> Content):**
1. Stripe Webhook обновляет статус подписки в таблице `users` и `auth.users` (metadata) в Supabase.
2. При входе в `(app)/layout.tsx` проверяется сессия Supabase через `client.ts`.
3. Если подписка неактивна, пользователь редиректится на Paywall (`src/features/auth/components/Paywall.tsx`).
4. Если активна, монтируется `FeedContainer`, который запрашивает данные напрямую из Supabase.

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:**
Стек Next.js (App Router) + Supabase + Zustand + Vercel работает без конфликтов. Использование `@supabase/ssr` для серверной части и `supabase-js` для клиентских компонентов (`use client`) обеспечивает безопасность и SPA-скорость одновременно.

**Pattern Consistency:**
Паттерн "Smart Container / Dumb UI" отлично сочетается с локализацией Zustand в `features/` и глобальным UI-стейтом в корневых Layouts. Исключение для `src/components/ui/` гарантирует переиспользование базовых элементов без нарушения Feature-based архитектуры.

**Structure Alignment:**
Изоляция админки в `(admin)/`, клиентских маршрутов в `(app)/` и вебхуков в `api/webhooks/` создает четкие границы ответственности и безопасности.

### Requirements Coverage Validation ✅

**Feature Coverage:**
Все MVP фичи из PRD учтены в структуре (Feed, Auth/Stripe, Comments). Разовая миграция из Telegram изолирована в скриптах.

**Non-Functional Requirements Coverage:**
- **Mobile-first Performance:** Решается через интеграцию `next/image` с Vercel CDN и встроенные в Dumb UI Skeletons.
- **Один разработчик (Maintainability):** Решается отказом от сложных мапперов (snake_case разрешен линтером) и делегированием инфраструктуры Vercel и Supabase (BaaS).

### Implementation Readiness Validation ✅

**Pattern Completeness:**
Определены четкие правила для именования (БД против клиента), структуры (Feature-based vs Global UI), управления состоянием и обработки ошибок. Документ готов служить инструкцией для AI-агентов-кодеров.

### Architecture Completeness Checklist

**✅ Requirements Analysis**
- [x] Project context thoroughly analyzed
- [x] Scale and complexity assessed
- [x] Technical constraints identified
- [x] Cross-cutting concerns mapped

**✅ Architectural Decisions**
- [x] Critical decisions documented (Next.js, Supabase 2.x, Zustand 5.x)
- [x] Technology stack fully specified
- [x] Integration patterns defined (Stripe Webhooks)
- [x] Performance considerations addressed

**✅ Implementation Patterns**
- [x] Naming conventions established (snake_case exception)
- [x] Structure patterns defined (Feature-based)
- [x] Communication patterns specified
- [x] Process patterns documented (Global/Local errors)

**✅ Project Structure**
- [x] Complete directory structure defined
- [x] Component boundaries established
- [x] Integration points mapped
- [x] Requirements to structure mapping complete

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION

**Confidence Level:** HIGH (Выбранный стек минимизирует риски одного разработчика через использование проверенных BaaS и Serverless решений, обеспечивая при этом гибкость для будущей фазы 1.1)

**Key Strengths:**
- Изоляция логики (Feature-based).
- Нулевое трение при переходе от SPA MVP к гибридному рендерингу в v1.1.
- Нулевая DevOps нагрузка.
- Четкие рамки для AI-ассистентов.

### Implementation Handoff

**AI Agent Guidelines:**
- Строго следуйте всем документированным архитектурным решениям и паттернам.
- Не пытайтесь переписывать `snake_case` свойства базы данных в `camelCase`.
- Размещайте все новые модули бизнес-логики в `src/features/`.
- Используйте этот документ (Architecture Decision Document) как главный источник правды при реализации любой задачи.

**First Implementation Priority:**
```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
# Затем настройка ESLint (отключение camelcase) и инициализация Supabase (server/client)
```
