# Rocksoft Planner

Internal team-capacity planner with a central employee competency database.
The application uses Next.js 16, Supabase Auth/PostgreSQL, and a read-only API
for external applications and AI agents.

## Local development

Requirements: Node.js 20.9 or newer and an existing Supabase project.

1. Copy `.env.local.example` to `.env.local` and fill in all required values.
2. Provision a fresh database with `supabase-schema.sql`, or apply every pending
   file in `migrations/` to an existing database in filename order.
3. Install dependencies and start the development server:

```bash
npm ci
npm run dev
```

The application is available at `http://localhost:3000` by default.

## Validation

```bash
npm test
npm run lint
npm run build
```

`next/font` downloads Inter during the production build, so the build host needs
outbound access to `fonts.googleapis.com` and `fonts.gstatic.com`.

## Database migrations

`supabase-schema.sql` is the consolidated schema for a fresh Supabase project.
Changes to an already-provisioned database use idempotent, dated SQL files under
`migrations/` and are applied manually through the Supabase SQL Editor.

Deploy database migrations before application code that depends on them. In
particular, `2026-08-24-competency-security-hardening.sql` adds the immutable
`team_members.profile_id` ownership link used by the competency UI and RLS.

The SQL Editor should report no error when a migration is applied again. Always
update `supabase-schema.sql` alongside a new migration so fresh installations
and upgraded installations converge on the same schema.

## Competency API

The read-only API is documented in `docs/competency-api.md`. Its machine-readable
OpenAPI contract is served as a static file at `/openapi/competency-api.yaml`.

Every data endpoint requires:

```text
Authorization: Bearer <COMPETENCY_API_KEY>
```

Use separate long random keys per external integration, rotate them through the
comma-separated `COMPETENCY_API_KEYS` variable, and configure request throttling
for `/api/` in the RunCloud/Nginx layer.

## RunCloud deployment

This is a self-hosted Node.js application; it does not require Vercel.

Recommended RunCloud configuration:

- application type: Node.js;
- Node.js version: 20.9 or newer;
- application root: this repository;
- build command: `npm ci && npm run build`;
- start command: `npm start`;
- process port: the value of `PORT` (Next.js defaults to `3000`);
- reverse proxy: HTTPS Nginx to the local Node.js port, preserving `Host`,
  `Authorization`, `X-Forwarded-Host`, and `X-Forwarded-Proto` headers;
- liveness URL: `/api/health`;
- deploy readiness URL: `/api/health?ready=1`.

Set the production variables from `.env.local.example` in RunCloud before the
build. `NEXT_PUBLIC_*` variables are embedded into browser assets at build time;
`SUPABASE_SERVICE_ROLE_KEY` and `COMPETENCY_API_KEYS` must remain server-only.

For a single persistent `next start` process, Next.js filesystem caching works
without extra configuration. If RunCloud is changed to multiple Node.js
instances or rolling deployments, also configure a shared cache,
`NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`, and `deploymentId` as described by the
installed Next.js self-hosting guide.

After deploying:

```bash
curl --fail https://YOUR_DOMAIN/api/health
curl --fail https://YOUR_DOMAIN/api/health?ready=1
```

The readiness check does not expose data or secrets; it verifies the competency
API configuration and Supabase connectivity.
