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

type Json = Record<string, unknown> | unknown[] | null

/** Call the public competency API with bearer auth; throw a readable error on non-2xx. */
async function api(path: string, init?: RequestInit): Promise<Json> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(init?.headers ?? {}),
    },
  })

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
        : raw || res.statusText
    throw new Error(`Competency API ${res.status}: ${detail}`)
  }
  return body
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
        .describe('Free-text brief matched against project-experience full text.'),
      skills: z
        .array(z.string())
        .optional()
        .describe('Skill slugs (from list_competencies, kind="skill").'),
      technologies: z
        .array(z.string())
        .optional()
        .describe('Technology slugs (from list_competencies, kind="technology").'),
    },
  },
  async ({ description, skills, technologies }) => {
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
      return ok(result)
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
      employeeId: z.string().describe('team_members.id of the employee.'),
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
