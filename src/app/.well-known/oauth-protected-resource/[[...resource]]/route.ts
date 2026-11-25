import { NextResponse, type NextRequest } from 'next/server'
import { MCP_PATH, protectedResourceMetadata } from '@/lib/mcp/config'

export const dynamic = 'force-dynamic'

// GET /.well-known/oauth-protected-resource[/api/mcp]
// MCP clients try the path-suffixed form first; both describe /api/mcp.
export async function GET(request: NextRequest, ctx: RouteContext<'/.well-known/oauth-protected-resource/[[...resource]]'>) {
  const { resource } = await ctx.params
  if (resource && `/${resource.join('/')}` !== MCP_PATH) {
    return NextResponse.json({ error: 'Unknown resource.' }, { status: 404 })
  }
  return NextResponse.json(protectedResourceMetadata(request))
}
