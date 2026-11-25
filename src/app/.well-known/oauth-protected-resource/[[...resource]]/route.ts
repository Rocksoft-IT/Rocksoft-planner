import { MCP_CORS_HEADERS, protectedResourceMetadata } from '@/lib/mcp/config'

// OAuth 2.0 Protected Resource Metadata (RFC 9728) for the MCP endpoint.
// Served at both /.well-known/oauth-protected-resource and
// /.well-known/oauth-protected-resource/api/mcp — MCP clients try the
// path-suffixed form first, and /api/mcp's 401 points at it explicitly.
export function GET(request: Request) {
  return Response.json(protectedResourceMetadata(request), {
    headers: { ...MCP_CORS_HEADERS, 'Cache-Control': 'public, max-age=3600' },
  })
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: MCP_CORS_HEADERS })
}
