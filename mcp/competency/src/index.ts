#!/usr/bin/env node
/**
 * RS Planner — Competency MCP server (expert recommender).
 *
 * A thin, stateless client over the public competency API (see
 * ../../docs/competency-api.md). It performs NO reasoning and holds NO LLM: it
 * retrieves and ranks people, and the calling model (e.g. Claude) does the
 * matching from a pasted project brief.
 *
 * Transport: stdio. Config via env:
 *   COMPETENCY_API_BASE_URL  — e.g. https://planner.rocksoft.pl  (no trailing /api)
 *   COMPETENCY_API_KEY       — one of the server's COMPETENCY_API_KEYS values
 *
 * Nothing in this file reads a .env: MCP clients pass env directly, and `npm start`
 * opts into Node's --env-file-if-exists (see package.json). Unlike the Next.js app,
 * which gets .env.local loading for free, a plain Node process loads nothing.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

const BASE_URL = (process.env.COMPETENCY_API_BASE_URL ?? '').replace(/\/+$/, '')
const API_KEY = process.env.COMPETENCY_API_KEY ?? ''

if (!BASE_URL || !API_KEY) {
  // Fail fast and loudly on stderr — stdout is reserved for the MCP protocol.
  console.error(
    '[competency-mcp] Missing config. Set COMPETENCY_API_BASE_URL and COMPETENCY_API_KEY.'
  )
  process.exit(1)
}

/** Give up on a hung deployment rather than leaking the socket for the process lifetime. */
const REQUEST_TIMEOUT_MS = 30_000

/** A proxy/platform 502 answers with a whole HTML page — don't paste that into the model's context. */
const MAX_ERROR_DETAIL_LEN = 500

/** Default page size for search_experts; see applyLimit for why one is needed. */
const DEFAULT_EXPERT_LIMIT = 10

/** The search route silently caps free-text briefs at this length (cleanText). */
const MAX_BRIEF_LEN = 2000

type Json = Record<string, unknown> | unknown[] | null

function truncate(text: string): string {
  return text.length > MAX_ERROR_DETAIL_LEN
    ? `${text.slice(0, MAX_ERROR_DETAIL_LEN)}… (${text.length} chars total)`
    : text
}

/** Call the public competency API with bearer auth; throw a readable error on non-2xx. */
async function api(path: string, init?: RequestInit): Promise<Json> {
  const url = `${BASE_URL}${path}`
  let res: Response
  try {
    res = await fetch(url, {
      ...init,
      // Deliberately overrides any caller-supplied signal: no call here should hang forever.
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(init?.headers ?? {}),
      },
    })
  } catch (err) {
    // fetch reports every network-level failure as a bare "fetch failed" and hides the real
    // reason (ECONNREFUSED, ENOTFOUND, TLS) on .cause. A wrong COMPETENCY_API_BASE_URL is the
    // likeliest thing to go wrong here, so surface something the agent can act on.
    if (err instanceof Error && err.name === 'TimeoutError') {
      throw new Error(`Competency API timed out after ${REQUEST_TIMEOUT_MS / 1000}s: ${url}`)
    }
    const reason = err instanceof Error ? (err.cause ?? err.message) : err
    throw new Error(`Competency API unreachable (${url}): ${String(reason)}`)
  }

  const raw = await res.text()
  let body: Json = null
  try {
    body = raw ? (JSON.parse(raw) as Json) : null
  } catch {
    body = { raw } as Json
  }

  if (!res.ok) {
    const detail =
      body && typeof body === 'object' && !Array.isArray(body) && 'error' in body
        ? String((body as Record<string, unknown>).error)
        : truncate(raw || res.statusText)
    throw new Error(`Competency API ${res.status}: ${detail}`)
  }
  return body
}

/**
 * Trim the expert list client-side.
 *
 * The API contract ({ query, count, experts }) is frozen by PR 1 and takes no limit param,
 * and the RPC deliberately ORs every token of the brief — so a real pasted brief matches on
 * filler words and returns nearly the whole company, each row carrying its full experience
 * array. `count` stays the true total; `returned`/`truncated` say what actually shipped.
 */
function applyLimit(result: Json, limit: number): Json {
  if (!result || typeof result !== 'object' || Array.isArray(result)) return result
  const record = result as Record<string, unknown>
  if (!Array.isArray(record.experts)) return result

  const experts = record.experts.slice(0, limit)
  return {
    ...record,
    experts,
    returned: experts.length,
    truncated: record.experts.length > experts.length,
  }
}

/** Wrap a JSON payload as an MCP text result. */
function ok(payload: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }] }
}

/** Wrap an error as an MCP error result (so the model sees it instead of a transport crash). */
function fail(err: unknown) {
  const message = err instanceof Error ? err.message : String(err)
  return { content: [{ type: 'text' as const, text: `Error: ${message}` }], isError: true }
}

const server = new McpServer({
  name: 'rockplanner-competency',
  version: '0.1.0',
})

// ── search_experts ──────────────────────────────────────────────────────────
// The primary tool: hand it a project brief (and/or explicit skill/tech slugs)
// and it returns people ranked by matching competencies + project experience.
server.registerTool(
  'search_experts',
  {
    title: 'Search experts',
    description:
      'Find employees matching a project brief. Pass a free-text `description` (e.g. a pasted ' +
      'project brief such as "konfigurator 3D w przeglądarce") and/or explicit `skills`/`technologies` ' +
      'slugs. Returns people ranked by number of matched skill/technology tags plus full-text match ' +
      'against their project experience, with the matched detail for each person. Discover valid slugs ' +
      'with list_competencies. Provide at least one of description/skills/technologies.',
    inputSchema: {
      description: z
        .string()
        .optional()
        .describe(
          'Free-text brief matched against project-experience full text. Only the first ' +
            `${MAX_BRIEF_LEN} characters are used, so summarize a long brief rather than pasting it ` +
            'whole; matching ORs every word, so trimming filler improves ranking.'
        ),
      skills: z
        .array(z.string())
        .optional()
        .describe('Skill slugs (from list_competencies, kind="skill").'),
      technologies: z
        .array(z.string())
        .optional()
        .describe('Technology slugs (from list_competencies, kind="technology").'),
      limit: z
        .number()
        .int()
        .min(1)
        .max(50)
        .optional()
        .describe(
          `Max people to return (default ${DEFAULT_EXPERT_LIMIT}); "count" stays the true total. ` +
            'Raise it only when the top matches are not enough.'
        ),
    },
  },
  async ({ description, skills, technologies, limit }) => {
    if (!description && !skills?.length && !technologies?.length) {
      return fail('Provide at least one of: description, skills, technologies.')
    }
    try {
      const result = await api('/api/search/experts', {
        method: 'POST',
        body: JSON.stringify({
          description: description ?? undefined,
          skills: skills ?? [],
          technologies: technologies ?? [],
        }),
      })
      return ok(applyLimit(result, limit ?? DEFAULT_EXPERT_LIMIT))
    } catch (err) {
      return fail(err)
    }
  }
)

// ── get_employee_competencies ───────────────────────────────────────────────
server.registerTool(
  'get_employee_competencies',
  {
    title: 'Get employee competencies',
    description:
      "Full detail for one employee: their skills/technologies (with proficiency and years) and their " +
      'project-experience entries (with technology tags). `employeeId` is the team_member id returned by ' +
      'search_experts (as team_member_id).',
    inputSchema: {
      // team_members.id is a uuid column: a non-UUID makes Postgres raise 22P02, so the route
      // answers 500 before it can answer its documented 404. Reject it here instead.
      employeeId: z.string().uuid().describe('team_members.id of the employee (UUID).'),
    },
  },
  async ({ employeeId }) => {
    try {
      const result = await api(
        `/api/employees/${encodeURIComponent(employeeId)}/competencies`
      )
      return ok(result)
    } catch (err) {
      return fail(err)
    }
  }
)

// ── list_competencies ───────────────────────────────────────────────────────
// Discovery: enumerate the skill/technology catalog to learn valid slugs before
// calling search_experts with explicit filters.
server.registerTool(
  'list_competencies',
  {
    title: 'List competencies',
    description:
      'List the skill/technology catalog (the tag vocabulary). Use it to discover valid slugs before ' +
      'filtering search_experts by skills/technologies. Optionally filter by `kind` and/or a name ' +
      'substring `q`.',
    inputSchema: {
      kind: z
        .enum(['skill', 'technology'])
        .optional()
        .describe('Restrict to skills or technologies.'),
      q: z.string().optional().describe('Case-insensitive name substring filter.'),
    },
  },
  async ({ kind, q }) => {
    try {
      const params = new URLSearchParams()
      if (kind) params.set('kind', kind)
      if (q) params.set('q', q)
      const qs = params.toString()
      const result = await api(`/api/competencies${qs ? `?${qs}` : ''}`)
      return ok(result)
    } catch (err) {
      return fail(err)
    }
  }
)

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('[competency-mcp] ready on stdio')
}

main().catch((err) => {
  console.error('[competency-mcp] fatal:', err)
  process.exit(1)
})
