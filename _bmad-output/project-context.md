---
project_name: 'PROCONTENT'
user_name: 'Alex'
date: '2026-04-04'
sections_completed: ['technology_stack', 'critical_rules', 'auth_patterns', 'nextjs_16_specifics']
existing_patterns_found: 8
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

- **Framework:** Next.js 16.1.6 (App Router)
- **Language:** TypeScript 5
- **Styling:** Tailwind CSS 4, base-ui, lucide-react
- **Backend:** Supabase (Auth, DB, SSR, Storage)
- **State:** Zustand 5
- **Payments:** Stripe
- **Auth Flow:** PKCE / OTP (через `/auth/confirm`)
- **Forms:** React Hook Form, Zod
- **Testing:** Vitest, Testing Library

---

## Next.js 16 Specifics (CRITICAL)

### 1. Middleware vs Proxy
- **Rule:** В Next.js 16+ файл перехвата запросов называется `src/proxy.ts`, а не `src/middleware.ts`.
- **Export:** Основная функция должна называться `export async function proxy(request: NextRequest)`.

### 2. Auth Token Protection
- **Rule:** `src/proxy.ts` ОБЯЗАН игнорировать маршрут `/auth/confirm`. 
- **Reason:** Если прокси вызовет обновление сессии до того, как роут-обработчик подтвердит почту, одноразовый токен (PKCE/OTP) сгорит, и верификация не пройдет.
- **Code:** `if (request.nextUrl.pathname.startsWith('/auth/confirm')) return` — в самом начале `proxy.ts`.

---

## Critical Implementation Rules

### 1. Naming & Data Format (DB Consistency)
- **Rule:** Используем `snake_case` для всех полей данных, приходящих из базы (PostgreSQL/Supabase). 
- **Constraint:** Запрещено мапить `snake_case` в `camelCase` на клиенте. ESLint настроен на игнорирование `camelcase` для свойств объектов БД.
- **Example:** `post.created_at` — ПРАВИЛЬНО, `post.createdAt` — ОШИБКА.

### 2. Code Organization (Feature-based)
- **Rule:** Вся бизнес-логика и тяжелые компоненты живут в `src/features/[feature-name]/*`.
- **Atomic UI:** Базовые "глупые" компоненты (кнопки, инпуты, скелетоны) живут в `src/components/ui/`.
- **Constraint:** `src/components/ui/` не может импортировать ничего из `src/features/`.

### 3. Component Architecture (Smart/Dumb)
- **Smart Containers:** Обертки, которые работают со стором (Zustand) и API (Supabase).
- **Dumb Views:** Визуальные компоненты, получающие данные через props. 
- **Skeletons:** Каждый Dumb-компонент должен самостоятельно обрабатывать состояние `isLoading` и рендерить свой Skeleton-вариант внутри себя.

### 4. Auth & Stripe Integration
- **Admin Client:** Для обновления статуса подписки (`subscription_status`) в БД используем Supabase Admin Client (`service_role_key`), чтобы обойти RLS.
- **Stripe Pitfalls:** При проверке подписки всегда учитывать статус `trialing` наравне с `active`.
- **Safety:** Поле `current_period_end` в Stripe может быть `null/undefined`. Всегда использовать проверку перед `new Date()`, чтобы избежать `RangeError`.

### 5. State Management (Zustand)
- **Global UI State:** Открытые шторки, навигация, активные табы — в общем Zustand-сторе.
- **Feature State:** Кэш данных, состояние конкретной фичи — в `src/features/[feature_name]/store.ts`.

### 6. Error Handling Patterns
- **System Errors:** (API, Auth) — вызов глобального Toasts (Sonner).
- **Validation Errors:** (Forms) — инлайн-вывод под соответствующим полем ввода.
- **Env Guards:** Проверка переменных окружения должна быть ВНЕ блоков `try/catch`, чтобы ошибки конфигурации не замалчивались.
