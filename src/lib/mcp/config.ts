import { NextResponse } from 'next/server'

export const MCP_PATH = '/api/mcp'

// Where the 401 challenge points MCP clients. Under /api because RunCloud's
// nginx returns 403 for dot paths such as /.well-known/*; clients must follow
// `resource_metadata` from WWW-Authenticate. The RFC 9728 well-known URL is
// served too, for clients that probe it directly once nginx lets it through.
export const PROTECTED_RESOURCE_METADATA_PATH = `${MCP_PATH}/oauth-protected-resource`
export const WELL_KNOWN_METADATA_PATH = `/.well-known/oauth-protected-resource${MCP_PATH}`

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

export function protectedResourceMetadataResponse(request: Request) {
  return NextResponse.json(protectedResourceMetadata(request))
}
