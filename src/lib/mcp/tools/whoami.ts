import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { McpContext } from '../auth'
import { errorResult, jsonResult } from '../result'

export function registerWhoami(server: McpServer, ctx: McpContext) {
  server.registerTool(
    'whoami',
    {
      title: 'Current planner user',
      description:
        'Returns the RS Planner account this connection acts as: name, email and whether it is an admin. ' +
        'All other tools run with exactly this user\'s permissions. Use it when the user asks who they are logged in as, ' +
        'or before an action to explain whose permissions apply.',
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => {
      const { data, error } = await ctx.supabase
        .from('profiles')
        .select('id, email, full_name, role, is_admin')
        .eq('id', ctx.user.id)
        .maybeSingle()

      if (error) return errorResult(`Nie udało się pobrać profilu: ${error.message}`)

      return jsonResult({
        id: ctx.user.id,
        email: data?.email ?? ctx.user.email,
        full_name: data?.full_name ?? null,
        role: data?.role || null,
        is_admin: data?.is_admin ?? false,
      })
    }
  )
}
