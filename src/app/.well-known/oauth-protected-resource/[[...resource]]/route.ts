import { NextResponse, type NextRequest } from 'next/server'
import { MCP_PATH, protectedResourceMetadataResponse } from '@/lib/mcp/config'

export const dynamic = 'force-dynamic'

// GET /.well-known/oauth-protected-resource[/api/mcp]
// Standard discovery URLs for clients that probe them (RFC 9728); same body as
// /api/mcp/oauth-protected-resource.
export async function GET(request: NextRequest, ctx: RouteContext<'/.well-known/oauth-protected-resource/[[...resource]]'>) {
  const { resource } = await ctx.params
  if (resource && `/${resource.join('/')}` !== MCP_PATH) {
    return NextResponse.json({ error: 'Unknown resource.' }, { status: 404 })
  }
  return protectedResourceMetadataResponse(request)
}
