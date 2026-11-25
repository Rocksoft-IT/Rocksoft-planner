import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { Allocation } from '@/lib/types'
import { PROJECT_COLORS } from '@/lib/utils'
import type { McpContext } from '../auth'
import { allocationFields } from './allocations'
import { errorResult, ilikePattern, isoDate, jsonResult, peopleById, uuid } from './helpers'

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200

const PROJECT_FIELDS = 'id, name, description, color, start_date, end_date'

const name = z.string().trim().min(1).max(200)
const description = z.string().trim().max(2000)
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a hex color like #6366f1')

function datesError(start: string | null | undefined, end: string | null | undefined): string | null {
  return start && end && end < start ? 'Data końcowa projektu nie może być wcześniejsza niż początkowa.' : null
}

export function registerProjectTools(server: McpServer, ctx: McpContext) {
  server.registerTool(
    'list_projects',
    {
      title: 'List projects',
      description:
        'Lists RS Planner projects (id, name, description, start/end date). ' +
        'Use it to answer "what projects do we have / are running in <period>" and to find a project\'s id by name ' +
        'before calling any tool that takes project_id — never guess ids. ' +
        'Filter by part of the name with `query`, or by a day the project is running with `active_on` ' +
        '(projects without a start or end date count as open-ended).',
      inputSchema: {
        query: z.string().trim().min(1).max(100).optional().describe('Case-insensitive part of the project name.'),
        active_on: isoDate.optional().describe('Only projects running on this day (yyyy-MM-dd, Europe/Warsaw).'),
        limit: z.number().int().min(1).max(MAX_LIMIT).optional().describe(`Default ${DEFAULT_LIMIT}.`),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ query, active_on, limit }) => {
      const max = limit ?? DEFAULT_LIMIT
      let request = ctx.supabase.from('projects').select(PROJECT_FIELDS).order('name').limit(max + 1)

      if (query) request = request.ilike('name', ilikePattern(query))
      if (active_on) {
        request = request
          .or(`start_date.is.null,start_date.lte.${active_on}`)
          .or(`end_date.is.null,end_date.gte.${active_on}`)
      }

      const { data, error } = await request
      if (error) return errorResult(`Nie udało się pobrać projektów: ${error.message}`)

      const rows = data ?? []
      return jsonResult({ projects: rows.slice(0, max), truncated: rows.length > max })
    }
  )

  server.registerTool(
    'get_project',
    {
      title: 'Get project',
      description:
        'Full detail of one project: its data plus every allocation on it (who, when, hours per day, confirmed or tentative) ' +
        'and total booked hours (Mon–Fri days × hours per day; time off is not subtracted). ' +
        'Use it for "who works on project X and how much".',
      inputSchema: { project_id: uuid },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ project_id }) => {
      const [project, allocations] = await Promise.all([
        ctx.supabase.from('projects').select(PROJECT_FIELDS).eq('id', project_id).maybeSingle(),
        ctx.supabase.from('allocations').select('*').eq('project_id', project_id).order('start_date'),
      ])
      if (project.error) return errorResult(`Nie udało się pobrać projektu: ${project.error.message}`)
      if (!project.data) return errorResult('Nie ma projektu o takim id. Sprawdź id przez list_projects.')
      if (allocations.error) return errorResult(`Nie udało się pobrać przydziałów: ${allocations.error.message}`)

      const rows = (allocations.data ?? []) as Allocation[]
      const people = await peopleById(ctx, rows.map((r) => r.person_id))
      const views = rows.map((r) => allocationFields(r, people))
      const booked = (status: Allocation['status']) =>
        views.filter((v) => v.status === status).reduce((sum, v) => sum + v.workdays * v.hours_per_day, 0)

      return jsonResult({
        project: project.data,
        allocations: views,
        booked_hours: { confirmed: booked('confirmed'), tentative: booked('tentative') },
      })
    }
  )

  server.registerTool(
    'create_project',
    {
      title: 'Create project',
      description:
        'Creates a project. Only `name` is required; dates are optional (an open-ended project has none). ' +
        'Check with list_projects that it doesn\'t already exist first.',
      inputSchema: {
        name,
        description: description.optional(),
        start_date: isoDate.optional(),
        end_date: isoDate.optional(),
        color: color.optional().describe(`Hex color for the timeline; default ${PROJECT_COLORS[0]}.`),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (input) => {
      const invalid = datesError(input.start_date, input.end_date)
      if (invalid) return errorResult(invalid)

      const { data, error } = await ctx.supabase
        .from('projects')
        .insert({
          name: input.name,
          description: input.description || null,
          start_date: input.start_date ?? null,
          end_date: input.end_date ?? null,
          color: input.color ?? PROJECT_COLORS[0],
        })
        .select(PROJECT_FIELDS)
        .single()
      if (error) return errorResult(`Nie udało się utworzyć projektu: ${error.message}`)
      return jsonResult({ result: 'created', project: data })
    }
  )

  server.registerTool(
    'update_project',
    {
      title: 'Update project',
      description:
        'Changes a project\'s name, description, dates or color. Pass only the fields to change; ' +
        'null clears description or a date.',
      inputSchema: {
        project_id: uuid,
        name: name.optional(),
        description: description.nullable().optional(),
        start_date: isoDate.nullable().optional(),
        end_date: isoDate.nullable().optional(),
        color: color.optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ project_id, ...changes }) => {
      const patch = Object.fromEntries(Object.entries(changes).filter(([, v]) => v !== undefined))
      if ('description' in patch) patch.description = patch.description || null
      if (Object.keys(patch).length === 0) return errorResult('Nie podano żadnych zmian.')

      const { data: current, error: readError } = await ctx.supabase.from('projects').select(PROJECT_FIELDS).eq('id', project_id).maybeSingle()
      if (readError) return errorResult(`Nie udało się pobrać projektu: ${readError.message}`)
      if (!current) return errorResult('Nie ma projektu o takim id. Sprawdź id przez list_projects.')

      const merged = { ...current, ...patch }
      const invalid = datesError(merged.start_date, merged.end_date)
      if (invalid) return errorResult(invalid)

      const { data, error } = await ctx.supabase.from('projects').update(patch).eq('id', project_id).select(PROJECT_FIELDS)
      if (error) return errorResult(`Nie udało się zapisać projektu: ${error.message}`)
      if (!data?.length) return errorResult('Brak uprawnień do zmiany tego projektu.')
      return jsonResult({ result: 'updated', project: data[0] })
    }
  )
}
