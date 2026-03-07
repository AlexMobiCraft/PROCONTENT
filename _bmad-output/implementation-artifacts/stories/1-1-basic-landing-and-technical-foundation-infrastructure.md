# Story 1.1: Базовый лендинг и технический фундамент (Infrastructure)

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a посетительница,
I want быстро и безопасно открыть главную страницу платформы,
so that я могла ознакомиться с клубом без задержек и технических проблем.

## Acceptance Criteria

1. **Given** пустой репозиторий и развернутая инфраструктура (Vercel, Supabase)
   **When** пользователь открывает корневой маршрут (`/`)
   **Then** быстро загружается базовая страница-заглушка или каркас лендинга
2. **And** настроен Next.js (App Router), Tailwind CSS и ESLint (без правила camelcase для БД)
3. **And** метрики производительности (LCP, TTI) соответствуют NFR
4. **And** проект успешно деплоится на Vercel

## Tasks / Subtasks

- [x] Task 1 (AC: 1, 2) Инициализация проекта Next.js
  - [x] Subtask 1.1 Создать Next.js приложение с App Router, Tailwind, TypeScript (флаги: `--typescript --tailwind --eslint --app --src-dir --import-alias "@/*"`)
  - [x] Subtask 1.2 Настроить ESLint: отключить правило `camelcase` на уровне конфига для совместимости с типами Supabase (согласно архитектуре)
  - [x] Subtask 1.3 Инициализировать Shadcn UI (`npx shadcn@latest init`) с базовой темой
  - [x] Subtask 1.4 Настроить базовую структуру папок (`src/features`, `src/components/ui`, `src/components/layouts`, `src/lib`, `src/app`)
- [x] Task 2 (AC: 1, 3) Подготовка базового лендинга
  - [x] Subtask 2.1 Подготовить `src/app/page.tsx` с приветственным сообщением-заглушкой и базовой версткой (будет заменено в Story 1.3)
  - [x] Subtask 2.2 Добавить базовый layout (`src/app/layout.tsx`) с общими стилями "Warm Minimalism" (из `ux-design-specification.md`) и настроить дефолтные метаданные
- [x] Task 3 (AC: 1, 4) Настройка инфраструктуры и CI/CD
  - [x] Subtask 3.1 Создать/подготовить Supabase проект (взять ключи URL и ANON KEY)
  - [x] Subtask 3.2 Добавить файлы `.env.local` (Git-ignored) и `.env.example` (с шаблонами ключей)
  - [x] Subtask 3.3 Привязать репозиторий GitHub к Vercel для автоматических деплоев
  - [x] Subtask 3.4 Настроить production переменные окружения на платформе Vercel

## Dev Notes

- Relevant architecture patterns and constraints:
  - Mobile-First подход (брейкпоинты 375px/390px). Tailwind-классы писать начиная с мобильных.
  - Feature-based архитектура (`src/features/*`), но пока создаем базовую структуру, базовые UI-элементы в `src/components/ui/` (shadcn).
  - Стейт-менеджемент Zustand v5.x пока не интегрируем (рано), но стоит иметь в виду для следующих стори.
  - Нулевая конфигурация Vercel - инфраструктура берет Next.js SSR автоматически.
- Source tree components to touch:
  - Корневые конфиги: `package.json`, `components.json`, `tailwind.config.ts`, `.eslintrc.json` или `eslint.config.mjs`, `tsconfig.json`.
  - Директории: `src/app/`, `src/components/`, `src/features/`, `src/lib/`.
- Testing standards summary:
  - Проверка LCP <= 2.5 сек и TTI <= 4 сек на мобайле (3G сеть) в Lighthouse-репортах продакшена или локально (согласно NFR1, NFR2).
  - Проверка успешного билда (`next build`) и деплоя на Vercel (чтобы зеленый статус в PR).

### Project Structure Notes

- Alignment with unified project structure (paths, modules, naming):
  - Используем `src/` директорию для строгого разделения кода и конфигурационных файлов.
  - `snake_case` используется для БД-типов (это важно для Supabase-совместимости, поэтому отключаем camelcase в ESLint заранее).
- Detected conflicts or variances (with rationale):
  - None at this stage.

### References

- Architecture Constraints: `_bmad-output/planning-artifacts/architecture.md#Starter-Template` и `_bmad-output/planning-artifacts/architecture.md#Additional-Requirements`
- Requirements: `_bmad-output/planning-artifacts/epics.md#FR-Coverage-Map` (Epic 1)
- UX Specifications & Design System: `_bmad-output/planning-artifacts/ux-design-specification.md#Design-System-Options` (Warm Minimalism)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Next.js 16.1.6 + Turbopack, `next build` успешен, 0 ошибок линтера
- Shadcn UI v4 инициализирован с Tailwind v4
- `npm run build` отработал за ~3 секунды (Turbopack)

### Completion Notes List

**Task 1.1:** Проект создан через `npx create-next-app@latest` во временной директории (workaround: имя директории PROCONTENT содержит заглавные буквы, что нарушает npm-правила). Файлы скопированы в корень PROCONTENT. `package.json name` исправлен на `"procontent"`.

**Task 1.2:** ESLint правило `camelcase: "off"` добавлено в `eslint.config.mjs` в отдельном объекте rules для совместимости с Supabase snake_case типами.

**Task 1.3:** Shadcn UI v4 инициализирован с `--defaults --yes`. Создано: `src/components/ui/button.tsx`, `src/lib/utils.ts`. Обновлён `src/app/globals.css`.

**Task 1.4:** Созданы директории `src/features/` и `src/components/layouts/` с `.gitkeep`.

**Task 2.1:** `src/app/page.tsx` переписан — минималистичная заглушка с именем платформы и подзаголовком. Mobile-first, использует CSS-переменные shadcn.

**Task 2.2:** `src/app/layout.tsx` обновлён — шрифты Inter + DM_Sans (с кириллической поддержкой), метаданные PROCONTENT, `lang="ru"`. `globals.css` — CSS-переменные `:root` обновлены под "Warm Minimalism" (теплый кремовый фон `oklch(0.993 0.006 90)`, dark charcoal foreground, Muted Terracotta primary accent).

**Task 3.2:** Созданы `.env.local` (gitignored) и `.env.example` с шаблонами для Supabase URL/ANON_KEY и NEXT_PUBLIC_SITE_URL. Создан `.gitignore`.

**Task 3.1:** Supabase проект создан, ключи `NEXT_PUBLIC_SUPABASE_URL` и `NEXT_PUBLIC_SUPABASE_ANON_KEY` прописаны в `.env.local`.

**Task 3.3:** Репозиторий GitHub привязан к Vercel, автодеплои настроены.

**Task 3.4:** Production переменные окружения настроены в Vercel dashboard.

### File List

- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `next.config.ts`
- `next-env.d.ts`
- `postcss.config.mjs`
- `eslint.config.mjs`
- `components.json`
- `.gitignore`
- `.env.example`
- `.env.local`
- `src/app/layout.tsx`
- `src/app/page.tsx`
- `src/app/globals.css`
- `src/components/ui/button.tsx`
- `src/lib/utils.ts`
- `src/features/.gitkeep`
- `src/components/layouts/.gitkeep`
