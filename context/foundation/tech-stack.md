---
project: RS Planner
context_type: brownfield
created: 2026-06-17
updated: 2026-06-17
source: detected-from-cwd
---

# RS Planner — Tech Stack

## Languages & Runtimes

- TypeScript 5 / Node 20
- React 19

## Frontend

- Framework: Next.js 16 (App Router, RSC)
- Styling: Tailwind CSS v4

## Backend

- Supabase (PostgreSQL, Auth, row-level security, SSR client)

## Data & Storage

- Database: PostgreSQL (via Supabase)

## Testing

> **Deviation note:** No test runner is currently wired into the project.
> `@dnd-kit` is tested indirectly through manual/E2E flows. Palette default
> is Vitest (JS/TS unit) + Playwright (E2E); neither is installed yet.

## CI/CD

- GitHub Actions

## Issue Tracker

- GitHub Issues

## Tooling

- Package manager (JS): npm (deviation — palette default is pnpm; `package-lock.json` is present)
- Date utilities: date-fns
- UI primitives: Radix UI
- Drag-and-drop: @dnd-kit/core, @dnd-kit/sortable

## Open Stack Questions

1. **Deploy target** — Not evident from the working directory. Confirm the hosting target (VPS, Vercel, cloud provider) before the first production deploy.
2. **Test runner** — No Vitest or Playwright installed. Decide whether to introduce one (Vitest for unit, Playwright for E2E) before shipping the drag-to-move feature.
