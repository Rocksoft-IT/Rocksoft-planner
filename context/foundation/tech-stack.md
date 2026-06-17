---
project: Drag and drop reallocation on the timeline
source: detected-from-cwd
context_type: brownfield
created: 2026-06-17
updated: 2026-06-17
---

# Tech Stack

## Frontend

- **Framework:** Next.js 16 (App Router) + React 19
- **Language:** TypeScript 5
- **Styling:** Tailwind CSS v4 + Radix UI primitives (Avatar, Dialog, DropdownMenu, Popover, Select, Tooltip)
- **UI utilities:** clsx, tailwind-merge, class-variance-authority, lucide-react
- **Drag-and-drop:** @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities
- **Date utilities:** date-fns v4

## Backend / Data

- **Database:** Supabase (PostgreSQL); schema in `supabase-schema.sql`
- **Auth:** Supabase Auth (email/password); session checked server-side via `@supabase/ssr`
- **API:** No custom API route handlers — data mutations via Supabase client calls directly from the frontend

## Tooling

- **Package manager:** npm (package-lock.json)
- **Linter:** ESLint 9 (eslint-config-next)
- **CI:** GitHub Actions (`.github/workflows/`)

## Open Stack Questions

- **Deploy target:** No Vercel config or Dockerfile detected — deployment target not confirmed. TODO: identify hosting (Vercel, self-hosted, etc.)
