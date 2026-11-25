import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { McpContext } from '../auth'
import { errorResult, jsonResult } from './helpers'

export function registerWhoami(server: McpServer, ctx: McpContext) {
  server.registerTool(
    'whoami',
    {
      title: 'Current planner user',
      description:
        'Returns the RS Planner account this connection acts as: name, email, job title and whether it is an admin. ' +
        'All other tools run with exactly this user\'s permissions. Admin rights come only from `is_admin`; ' +
        '`job_title` is descriptive text and grants nothing. Use it when the user asks who they are logged in as ' +
        'or whose permissions apply.',
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => {
      const { data, error } = await ctx.supabase
        .from('profiles')
        .select('email, full_name, role, is_admin')
        .eq('id', ctx.user.id)
        .maybeSingle()

      if (error) return errorResult(`Nie udało się pobrać profilu: ${error.message}`)

      return jsonResult({
        id: ctx.user.id,
        email: data?.email || ctx.user.email,
        full_name: data?.full_name || null,
        job_title: data?.role || null,
        is_admin: data?.is_admin ?? false,
      })
    }
  )
}
