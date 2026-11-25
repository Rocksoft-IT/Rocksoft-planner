import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { CONTRACT_TYPES } from '@/lib/types'
import type { McpContext } from '../auth'
import { errorResult, ilikePattern, jsonResult } from './helpers'

export function registerPeopleTools(server: McpServer, ctx: McpContext) {
  server.registerTool(
    'list_people',
    {
      title: 'List people',
      description:
        'Lists people on the RS Planner team (id, name, email, job title, contract type, working hours per day). ' +
        'Use it to find a person\'s id by name before calling tools that take person_id or person_ids — never guess ids. ' +
        'For "who is free" questions use get_availability; for "who knows X" use search_experts.',
      inputSchema: {
        query: z.string().trim().min(1).max(100).optional().describe('Case-insensitive part of the name or email.'),
        role: z.string().trim().min(1).max(100).optional().describe('Case-insensitive part of the job title, e.g. "frontend".'),
        contract_type: z
          .enum([...CONTRACT_TYPES, 'none'])
          .optional()
          .describe('Contract type; "none" = not set.'),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ query, role, contract_type }) => {
      let request = ctx.supabase
        .from('team_members')
        .select('id, full_name, email, role, contract_type, capacity_hours_per_day')
        .order('full_name')

      if (query) request = request.or(`full_name.ilike.${quoted(ilikePattern(query))},email.ilike.${quoted(ilikePattern(query))}`)
      if (role) request = request.ilike('role', ilikePattern(role))
      if (contract_type) request = contract_type === 'none' ? request.is('contract_type', null) : request.eq('contract_type', contract_type)

      const { data, error } = await request
      if (error) return errorResult(`Nie udało się pobrać osób: ${error.message}`)
      return jsonResult({ people: data ?? [] })
    }
  )
}

// PostgREST `or=(…)` values containing commas/parentheses must be double-quoted.
function quoted(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}
