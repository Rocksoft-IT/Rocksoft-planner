import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { McpContext } from '../auth'
import { errorResult, ilikePattern, ISO_DATE, jsonResult } from './helpers'

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200

export function registerListProjects(server: McpServer, ctx: McpContext) {
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
        active_on: z
          .string()
          .regex(ISO_DATE, 'Use yyyy-MM-dd')
          .optional()
          .describe('Only projects running on this day (yyyy-MM-dd, Europe/Warsaw).'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(MAX_LIMIT)
          .optional()
          .describe(`Max number of projects to return (default ${DEFAULT_LIMIT}).`),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ query, active_on, limit }) => {
      const max = limit ?? DEFAULT_LIMIT
      let request = ctx.supabase
        .from('projects')
        .select('id, name, description, start_date, end_date')
        .order('name')
        .limit(max + 1)

      if (query) request = request.ilike('name', ilikePattern(query))
      if (active_on) {
        request = request
          .or(`start_date.is.null,start_date.lte.${active_on}`)
          .or(`end_date.is.null,end_date.gte.${active_on}`)
      }

      const { data, error } = await request
      if (error) return errorResult(`Nie udało się pobrać projektów: ${error.message}`)

      const rows = data ?? []
      return jsonResult({
        projects: rows.slice(0, max),
        truncated: rows.length > max,
      })
    }
  )
}
