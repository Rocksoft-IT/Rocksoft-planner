import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { McpContext } from './auth'
import { registerAllocationTools } from './tools/allocations'
import { registerAvailabilityTools } from './tools/availability'
import { registerCompetencyTools } from './tools/competencies'
import { registerPeopleTools } from './tools/people'
import { registerProjectTools } from './tools/projects'
import { registerTimeOffTools } from './tools/time-off'
import { registerWhoami } from './tools/whoami'

// One server per request, bound to the caller's RLS-scoped Supabase client.
export function createPlannerMcpServer(ctx: McpContext): McpServer {
  const server = new McpServer(
    { name: 'rs-planner', title: 'RS Planner', version: '0.2.0' },
    {
      instructions:
        'RS Planner is Rocksoft\'s resource planner: projects, people, allocations (a person on a project for a date ' +
        'range at N hours per working day, confirmed or tentative) and time off. Dates are yyyy-MM-dd in Europe/Warsaw. ' +
        'Look up ids with list_people / list_projects / list_allocations before using them; never guess ids. ' +
        'Before any create/update/delete, state exactly what will change and get the user\'s confirmation. ' +
        'All tools act with the signed-in user\'s permissions. Not available here: deleting projects, adding or ' +
        'removing people, editing competencies, account and admin settings — those are done in the planner app.',
    }
  )

  registerWhoami(server, ctx)
  registerPeopleTools(server, ctx)
  registerProjectTools(server, ctx)
  registerAllocationTools(server, ctx)
  registerAvailabilityTools(server, ctx)
  registerTimeOffTools(server, ctx)
  registerCompetencyTools(server, ctx)

  return server
}
