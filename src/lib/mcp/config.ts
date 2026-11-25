// URLs for the RS Planner MCP connector (OAuth protected resource).
//
// The MCP endpoint is a protected resource (RFC 9728); Supabase Auth is the
// OAuth 2.1 authorization server that issues its access tokens.

export const MCP_PATH = '/api/mcp'
export const PROTECTED_RESOURCE_METADATA_PATH = `/.well-known/oauth-protected-resource${MCP_PATH}`

// Public origin of the app. Behind the RunCloud/nginx proxy the request URL is
// the internal one, so prefer NEXT_PUBLIC_SITE_URL, then forwarded headers.
export function publicOrigin(request: Request): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '')
  if (configured) return configured
  const url = new URL(request.url)
  const proto = request.headers.get('x-forwarded-proto') ?? url.protocol.replace(':', '')
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? url.host
  return `${proto}://${host}`
}

export function authorizationServerUrl(): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/+$/, '')}/auth/v1`
}

export function protectedResourceMetadata(request: Request) {
  const origin = publicOrigin(request)
  return {
    resource: `${origin}${MCP_PATH}`,
    authorization_servers: [authorizationServerUrl()],
    bearer_methods_supported: ['header'],
    resource_name: 'RS Planner',
    resource_documentation: `${origin}/`,
  }
}

// CORS for browser-based MCP clients (e.g. MCP Inspector). Access is gated by
// the bearer token, never by cookies, so a wildcard origin is safe here.
export const MCP_CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID',
  'Access-Control-Expose-Headers': 'Mcp-Session-Id, WWW-Authenticate',
}
