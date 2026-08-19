# Competency API

Public, agent-facing read API over the employee competency base. API-first by
design: the web UI, external apps, and the MCP server (PR 2) all consume these
endpoints. Backed by Supabase via a **service-role** client, guarded by an
**API-key** check — it is not tied to a browser session.

## Auth

Every endpoint requires a bearer token:

```
Authorization: Bearer <key>
```

`<key>` must be one of the comma-separated values in the server's
`COMPETENCY_API_KEYS` env var. Missing/invalid → `401`. If no keys are configured
on the server → `503`.

## Data model (recap)

- **People** are `team_members` (the full directory). `id` is the employee id used below.
- **Competencies** are tags of `kind` `"skill"` or `"technology"`, identified by a `slug`.
- **Project experience** entries are free-text (title/role/description/dates), optionally tagged with technologies, and full-text searchable.

## Endpoints

### `GET /api/competencies`
List the skill/technology catalog.

Query params: `kind` (`skill` | `technology`, optional), `q` (name substring, optional).

```json
{ "competencies": [ { "id": "…", "kind": "technology", "name": "Three.js", "slug": "three-js", "is_curated": true } ] }
```

### `GET /api/employees`
All employees with a summary of their skills/technologies.

```json
{ "employees": [
  { "id": "…", "full_name": "…", "email": "…", "role": "…",
    "competencies": [ { "proficiency": 4, "years_experience": 3.0,
      "tag": { "kind": "technology", "name": "React", "slug": "react" } } ] }
] }
```

### `GET /api/employees/:id/competencies`
Full detail for one employee — competencies + project experience (with tags).
`404` if the id is unknown.

```json
{ "employee": {
  "id": "…", "full_name": "…", "email": "…", "role": "…",
  "competencies": [ { "id": "…", "proficiency": 4, "years_experience": 3.0,
    "tag": { "kind": "technology", "name": "React", "slug": "react" } } ],
  "experience": [ { "id": "…", "title": "Konfigurator 3D…", "role": "…",
    "description": "…", "start_date": "…", "end_date": "…", "project_id": null,
    "tags": [ { "tag": { "kind": "technology", "name": "Three.js", "slug": "three-js" } } ] } ]
} }
```

### `GET /api/search/experts`
Rank experts by matching skills/technologies + free-text experience match.

Query params (all optional; provide at least one): `skills` (comma-separated
slugs), `technologies` (comma-separated slugs), `q` (free text).

```
GET /api/search/experts?technologies=three-js,webgl&q=konfigurator%203D
```

### `POST /api/search/experts`
Same search, JSON body. This is the entry point for an LLM/MCP handed a project brief.

```json
{ "skills": ["frontend-development"], "technologies": ["three-js"], "description": "Szukamy osoby do konfiguratora 3D w przeglądarce…" }
```

`description` (or `query`) is free text and is matched against project-experience
full-text. Response for both GET and POST:

```json
{ "query": { "skills": [], "technologies": ["three-js"], "text": "konfigurator 3D" },
  "count": 2,
  "experts": [ { "team_member_id": "…", "full_name": "…", "email": "…", "role": "…",
    "score": 3.15,
    "matched": {
      "skills_technologies": [ { "kind": "technology", "name": "Three.js", "slug": "three-js" } ],
      "experience": [ { "id": "…", "title": "Konfigurator 3D…", "role": "…" } ]
    } } ] }
```

`score` = number of matched skill/technology tags + full-text rank of matched
experience. Results are ordered by `score` descending. Slugs come from
`GET /api/competencies` — call it to discover valid slugs.

## Notes

- Read-only in this version. Writes happen through the web UI (self-service).
- `search_experts` is a Postgres function (`public.search_experts`) — the web app
  calls it via PostgREST RPC as the authenticated user; the API calls it via the
  service-role client. Same ranking logic in both paths.
- The MCP server (PR 2) is a thin client over `POST /api/search/experts` and the
  employee endpoints — this JSON contract is frozen once PR 1 merges.
