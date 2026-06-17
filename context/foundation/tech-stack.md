---
project: Drag and drop reallocation on the timeline
context_type: brownfield
created: 2026-06-17
updated: 2026-06-17
source: detected-from-cwd
---

# Rocksoft Planner — Tech Stack

## Languages & Runtimes

- TypeScript 5 / Node 20

## Frontend

- Framework: Next.js 16 (React 19, App Router)
- Styling: Tailwind CSS v4

## Data & Storage

- Database: PostgreSQL via Supabase (hosted)
- Auth: Supabase Auth (email/password)

## CI/CD

- GitHub Actions

## Issue Tracker

- GitHub Issues

## Tooling

- Package manager (JS): npm (deviation from palette default pnpm — package-lock.json present)

## Open Stack Questions

1. **Testing** — No Vitest or Playwright detected; confirm whether unit/E2E tests are planned and which runner to adopt.
2. **Deploy target** — No Dockerfile, Vercel config, or Terraform files found; concrete deploy target unknown — pin before first production deployment.
