import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { McpContext } from '../auth'
import { errorResult, ilikePattern, jsonResult, uuid } from './helpers'

const DEFAULT_EXPERT_LIMIT = 10
// Same bounds as POST /api/search/experts.
const MAX_SLUGS = 50
const MAX_BRIEF_LEN = 2000

const slugs = z.array(z.string().trim().min(1).max(100)).max(MAX_SLUGS)

export function registerCompetencyTools(server: McpServer, ctx: McpContext) {
  server.registerTool(
    'search_experts',
    {
      title: 'Search experts',
      description:
        'Ranks people by how well their skills, technologies and project experience match a free-text brief ' +
        '(e.g. a pasted project description) and/or exact skill/technology slugs. Returns the matched competencies ' +
        'per person. Use it for "who knows X" or "who fits this project"; then get_person_competencies on the top ' +
        'hits to justify a recommendation and get_availability to check they have time. Slugs come from list_competencies.',
      inputSchema: {
        description: z.string().trim().min(1).optional().describe(`Free-text brief; only the first ${MAX_BRIEF_LEN} characters are used.`),
        skills: slugs.optional().describe('Skill slugs, e.g. ["frontend", "ux-design"].'),
        technologies: slugs.optional().describe('Technology slugs, e.g. ["react", "typescript"].'),
        limit: z.number().int().min(1).max(50).optional().describe(`Default ${DEFAULT_EXPERT_LIMIT}.`),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ description, skills, technologies, limit }) => {
      if (!description && !skills?.length && !technologies?.length) {
        return errorResult('Podaj opis (description) albo przynajmniej jedną umiejętność lub technologię.')
      }

      const { data, error } = await ctx.supabase.rpc('search_experts', {
        p_skill_slugs: skills ?? [],
        p_tech_slugs: technologies ?? [],
        p_query: description ? description.slice(0, MAX_BRIEF_LEN) : null,
      })
      if (error) return errorResult(`Nie udało się wyszukać ekspertów: ${error.message}`)

      const experts = (data ?? []) as unknown[]
      const max = limit ?? DEFAULT_EXPERT_LIMIT
      return jsonResult({ total_matches: experts.length, experts: experts.slice(0, max) })
    }
  )

  server.registerTool(
    'get_person_competencies',
    {
      title: 'Get person competencies',
      description:
        'One person\'s skills and technologies (with proficiency and years of experience) and their project experience ' +
        'history. Use it to justify an expert recommendation or answer "what does X know".',
      inputSchema: { person_id: uuid },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ person_id }) => {
      const { data, error } = await ctx.supabase
        .from('team_members')
        .select(
          `id, full_name, email, role,
           competencies:team_member_competencies(
             proficiency, years_experience,
             tag:competency_tags(kind, name, slug)
           ),
           experience:project_experience(
             title, role, description, start_date, end_date, project_id,
             tags:project_experience_tags(tag:competency_tags(kind, name, slug))
           )`
        )
        .eq('id', person_id)
        .maybeSingle()

      if (error) return errorResult(`Nie udało się pobrać kompetencji: ${error.message}`)
      if (!data) return errorResult('Nie ma osoby o takim id. Sprawdź id przez list_people.')
      return jsonResult({ person: data })
    }
  )

  server.registerTool(
    'list_competencies',
    {
      title: 'List competencies',
      description:
        'The skill and technology catalog (name + slug). Use it to find exact slugs for search_experts ' +
        'or to answer "what skills do we track".',
      inputSchema: {
        kind: z.enum(['skill', 'technology']).optional(),
        query: z.string().trim().min(1).max(100).optional().describe('Case-insensitive part of the name.'),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ kind, query }) => {
      let request = ctx.supabase.from('competency_tags').select('kind, name, slug').order('kind').order('name')
      if (kind) request = request.eq('kind', kind)
      if (query) request = request.ilike('name', ilikePattern(query))

      const { data, error } = await request
      if (error) return errorResult(`Nie udało się pobrać katalogu kompetencji: ${error.message}`)
      return jsonResult({ competencies: data ?? [] })
    }
  )
}
