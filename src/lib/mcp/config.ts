export const MCP_PATH = '/api/mcp'
export const PROTECTED_RESOURCE_METADATA_PATH = `/.well-known/oauth-protected-resource${MCP_PATH}`

// Behind the RunCloud/nginx proxy request.url is the internal address, so
// prefer NEXT_PUBLIC_SITE_URL, then the forwarded headers.
export function publicOrigin(request: Request): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '')
  if (configured) return configured
  const url = new URL(request.url)
  const proto = request.headers.get('x-forwarded-proto') ?? url.protocol.replace(':', '')
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? url.host
  return `${proto}://${host}`
}

// OAuth 2.0 Protected Resource Metadata (RFC 9728): Supabase Auth's OAuth 2.1
// server issues the access tokens accepted by /api/mcp.
export function protectedResourceMetadata(request: Request) {
  return {
    resource: `${publicOrigin(request)}${MCP_PATH}`,
    authorization_servers: [`${process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/+$/, '')}/auth/v1`],
    bearer_methods_supported: ['header'],
    resource_name: 'RS Planner',
  }
}
