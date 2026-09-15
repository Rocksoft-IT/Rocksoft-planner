---
project: RS Planner
context_type: brownfield
created: 2026-09-15
updated: 2026-09-15
source: detected-from-cwd
---

# RS Planner — Tech Stack

## Languages & Runtimes
- Node (TypeScript 5) — `package.json`, `tsconfig.json`

## Frontend
- Framework: Next 16.2.6 (React 19.2.4)
- Styling: Tailwind CSS 4

## Data & Storage
- Database: PostgreSQL (Supabase) — `supabase-schema.sql`, `@supabase/supabase-js`, `@supabase/ssr`, dated migrations in `migrations/`

## Testing
- No automated test runner present (no Vitest/Jest/Playwright config or scripts in `package.json`) — deviation from palette default (Vitest); noted, not invented.

## CI/CD
- No CI workflows present (`.github/workflows/` is empty after the prior `roadmap-from-spec.yml` removal) — deviation from palette default (GitHub Actions).

## Issue Tracker
- GitHub Issues (repo hosted on GitHub; issues driven via `gh`)

## Tooling
- Package manager (JS): npm (`package-lock.json` present, no `pnpm-lock.yaml`) — deviation from palette default (pnpm)
- Lint: ESLint 9 (`eslint-config-next`)

## Open Stack Questions
1. **Deploy target** — no Dockerfile, Terraform, or hosting config found in the repo; not evident from cwd. Leave open until a change needs it.
2. **Unit/E2E test runner** — no test tooling installed; if a change needs automated coverage, pin one (palette default: Vitest for JS/TS, Playwright for E2E) at that time.
