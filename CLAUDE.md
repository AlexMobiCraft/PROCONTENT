# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start dev server (Next.js)
npm run build      # Production build
npm run lint       # ESLint check
npm run typecheck  # TypeScript type check (tsc --noEmit)
```

No test runner is configured yet.

## Architecture

**PROCONTENT** — закрытый клуб для создателей контента. Next.js 16 app на React 19 с App Router.

### Stack

- **Framework**: Next.js 16 (App Router) + React 19
- **Styling**: Tailwind CSS v4 + `tw-animate-css` + Shadcn design tokens
- **UI primitives**: `@base-ui/react` (headless, a11y-first) — NOT Radix UI
- **Component variants**: `class-variance-authority` (CVA)
- **Class merging**: `clsx` + `tailwind-merge` → утилита `cn()` в `src/lib/utils.ts`
- **Fonts**: Inter (`--font-sans`) + DM Sans (`--font-heading`) через `next/font/google`
- **Language**: `lang="ru"`, контент на русском

### Design System

Тема "Warm Minimalism" определена в `src/app/globals.css` через CSS-переменные oklch. Основные токены: `--primary` (Muted Terracotta), `--background` (теплый кремовый). Темная тема через класс `.dark`.

Tailwind использует `@theme inline` для маппинга CSS-переменных → Tailwind-токены. Shadcn-токены подключаются через `@import 'shadcn/tailwind.css'`.

### Структура `src/`

```
src/
  app/
    layout.tsx      # Root layout: шрифты, метаданные, lang="ru"
    page.tsx        # Главная (placeholder)
    globals.css     # Tailwind + CSS-переменные темы
    error.tsx       # Top-level error boundary
    loading.tsx     # Top-level loading boundary
  components/
    ui/
      button.tsx    # Базовый Button поверх @base-ui/react
    navigation/     # Навигационные компоненты
      DesktopSidebar.tsx  # Фиксированный sidebar (md+), содержит nav-items
  lib/
    utils.ts        # cn() helper
```

### Язык

Вся коммуникация, комментарии в коде, документация и commit-сообщения ведутся на **русском языке**. Технические термины, идентификаторы кода и названия инструментов остаются на английском.

### Соглашения

- **Компоненты `ui/`**: строятся поверх `@base-ui/react` (не Radix), оборачиваются в CVA-варианты, всегда `'use client'`
- **Минимальный touch target**: `min-h-[44px] min-w-[44px]` для всех интерактивных элементов
- **Camelcase**: включен ESLint-rule с `properties: "never"` — поля snake_case из БД (Supabase) в destructuring и imports допустимы; авто-генерированные типы должны лежать в `src/types/supabase.ts` или `src/types/database.types.ts` (camelcase там отключен)
- **Prettier**: `singleQuote`, `semi: false`, `trailingComma: 'es5'`, плагин сортировки Tailwind-классов
- **Переменная окружения**: `NEXT_PUBLIC_SITE_URL` — базовый URL сайта

### `_bmad/`

Директория содержит BMAD-фреймворк для AI-агентов (workflows, templates, agents). Не является частью приложения Next.js — это инструментарий разработки процессов.
