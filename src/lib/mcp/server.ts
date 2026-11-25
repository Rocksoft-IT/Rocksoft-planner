import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { McpContext } from './auth'
import { registerWhoami } from './tools/whoami'
import { registerListProjects } from './tools/projects'

// Builds a fresh MCP server for one request. The endpoint is stateless: every
// HTTP request is authenticated on its own and gets its own server instance
// bound to the caller's Supabase client (so RLS applies per user).
export function createPlannerMcpServer(ctx: McpContext): McpServer {
  const server = new McpServer(
    { name: 'rs-planner', title: 'RS Planner', version: '0.1.0' },
    {
      instructions:
        'RS Planner is Rocksoft\'s resource planner: projects, people and their allocations to projects over time. ' +
        'Dates are yyyy-MM-dd in Europe/Warsaw. Look up ids with the list tools before using them; never guess ids. ' +
        'All tools act with the signed-in user\'s permissions.',
    }
  )

  registerWhoami(server, ctx)
  registerListProjects(server, ctx)

  return server
}
