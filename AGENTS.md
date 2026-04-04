# AGENTS.md — PROCONTENT

## Commands

```bash
npm run dev              # Dev server (Next.js 16)
npm run build            # Production build
npm run lint             # ESLint
npm run typecheck        # TypeScript (tsc --noEmit)
npm run test             # Vitest — run all tests
npm run test:watch       # Vitest — watch mode
```

### Running a single test

```bash
npx vitest run tests/unit/features/feed/components/FeedContainer.test.tsx
npx vitest run -t "specific test name pattern"
npx vitest run tests/unit --reporter=verbose
```

Test files live in `tests/unit/**/*.{test,spec}.{ts,tsx}`. Config: `vitest.config.ts`.

## Code Style

- **Prettier**: `singleQuote`, `semi: false`, `tabWidth: 2`, `trailingComma: 'es5'`, `prettier-plugin-tailwindcss`
- **TypeScript**: `strict: true`, `noEmit: true`, path alias `@/*` → `./src/*`
- **ESLint**: `eslint-config-next` (core-web-vitals + typescript). `camelcase` rule relaxed for `properties: "never"` to allow Supabase `snake_case` fields.
- **No comments** unless explicitly requested by the user.

## Naming Conventions

- **Database fields**: use `snake_case` directly from Supabase. NEVER map to `camelCase`.
  - Good: `post.created_at`, `user.first_name`
  - Bad: `const post = { createdAt: data.created_at }`
- **Components**: PascalCase (`FeedContainer`, `PostCard`)
- **Functions/variables**: camelCase
- **Files**: match component name (PascalCase for components, camelCase for utilities)

## Architecture

- **Framework**: Next.js 16 (App Router) + React 19
- **Styling**: Tailwind CSS v4 + `tw-animate-css` + Shadcn design tokens + `@base-ui/react` (NOT Radix) + CVA variants
- **Class merging**: `clsx` + `tailwind-merge` → `cn()` in `@/lib/utils`
- **Fonts**: Inter (`--font-sans`) + DM Sans (`--font-heading`) via `next/font/google`
- **State**: Zustand — feature-scoped stores in `src/features/*/store.ts`
- **Data**: Supabase — server (`createClient` with await) and client (no await) patterns

### Design System

- Theme "Warm Minimalism" via CSS custom properties (oklch) in `src/app/globals.css`
- Dark theme via `.dark` class
- Tailwind uses `@theme inline` for CSS variable → Tailwind token mapping
- Shadcn tokens via `@import 'shadcn/tailwind.css'`

### Feature-driven structure (`src/features/*/`)

- `api/` — data fetching functions (server + client)
- `components/` — React components (Containers + Views/Dumb)
- `store.ts` — Zustand store (business state, cache)
- `types.ts` — TypeScript types

### State Boundaries (CRITICAL)

- **Global UI State** (nav open/closed, active tab) → global Zustand in `src/app/(app)/layout.tsx`
- **Business State** (cached feed, current user) → isolated in `src/features/[name]/store.ts`

### RSC + Client Components

- Page (`page.tsx`) = React Server Component → loads data, passes to Client Component
- Client Component = `'use client'` → interactivity, client state
- Example: `src/app/(app)/feed/page.tsx` (RSC) → `src/features/feed/components/FeedContainer.tsx` (Client)

### ui/ Components

- Built on `@base-ui/react` (not Radix), wrapped in CVA variants, always `'use client'`

### Environment Variables

- `NEXT_PUBLIC_SITE_URL` — base site URL

### Smart Container / Dumb UI (MANDATORY)

- **Dumb UI** components receive only props, call callbacks. NEVER import Zustand/Supabase.
- **Smart Containers** subscribe to Zustand, call Supabase API, pass data + `isLoading` to dumb components.
- `src/components/ui/` MUST NOT import from `src/features/`.

### API Boundaries

- **Client-side reads**: directly via `lib/supabase/client.ts` from `'use client'` components — NO Route Handlers
- **Server-side mutations & webhooks**: `lib/supabase/server.ts` + Route Handlers (`/api/`) — ONLY for Stripe webhooks, email confirmation, auth callbacks

### Supabase Patterns

- **Server-side**: `import { createClient } from '@/lib/supabase/server'` + `await createClient()`
- **Client-side**: `createClient()` (no await, uses client key)
- **Pagination**: composite cursor `created_at|id`
- **RPC calls**: `toggle_like` (like/unlike with Supabase-side logic)
- **Optimistic updates**: update UI immediately, rollback on error
- **Auth**: `supabase.auth.getUser()` — returns current user

### Zustand Store Pattern

- Granular subscriptions: `useFeedStore((s) => s.posts)`
- Optimistic updates: `store.updatePost(postId, { is_liked: true, likes_count: newCount })`
- Rollback on error: restore previous values

## UI Conventions

- Minimum touch target: `min-h-[44px] min-w-[44px]` for all interactive elements
- Use `cn()` from `@/lib/utils` for class merging
- Design theme: "Warm Minimalism" via CSS custom properties in `src/app/globals.css`

## Language

- Communication, comments, docs, commits: **Russian**
- Technical terms, code identifiers, tool names: **English**
- UI content and user-facing text: **Slovenian**
