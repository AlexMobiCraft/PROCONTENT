# PROCONTENT Workflow

## Development Workflow

### 1. Start Development

```bash
npm run dev
```

### 2. Make Changes

- Follow feature-driven architecture in `src/features/*/`
- Smart Container / Dumb UI pattern
- RSC for pages, Client Components for interactivity

### 3. Validate

```bash
npm run lint          # ESLint
npm run typecheck     # TypeScript
npm run test          # Run tests
```

### 4. Build

```bash
npm run build
```

## BMAD Workflow Integration

This project uses BMAD framework for structured development:

### Available Workflows

- `brainstorming` — Interactive ideation sessions
- `party-mode` — Multi-agent discussions
- `create-prd` — Product requirements documents
- `create-architecture` — Technical architecture design
- `create-epics-and-stories` — Epic and story breakdown
- `sprint-planning` — Generate sprint plans
- `dev-story` — Implement stories
- `code-review` — Review code changes
- `quick-dev` — Rapid development

### Usage

Invoke workflows via their corresponding skills or commands.

## Architecture Patterns

### Feature Structure

```
src/features/[name]/
├── api/           # Data fetching functions
├── components/    # React components (Containers + Views)
├── store.ts       # Zustand store
└── types.ts       # TypeScript types
```

### State Management

- Global UI State → `src/app/(app)/layout.tsx`
- Business State → `src/features/[name]/store.ts`

### Data Layer

- Server-side: `createClient()` with await (Server Components)
- Client-side: `createClient()` without await (Client Components)

## Language

- Code/comments: Russian
- Technical terms: English
- UI content: Slovenian
