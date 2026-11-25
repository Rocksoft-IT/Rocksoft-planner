import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { authenticateMcpRequest } from '@/lib/mcp/auth'
import { MCP_CORS_HEADERS, PROTECTED_RESOURCE_METADATA_PATH, publicOrigin } from '@/lib/mcp/config'
import { createPlannerMcpServer } from '@/lib/mcp/server'

// RS Planner remote MCP server (Streamable HTTP, stateless, JSON responses).
// Added in Claude as a custom connector: https://<planner>/api/mcp
// Auth: OAuth 2.1 access tokens issued by Supabase Auth — see docs/mcp-connector.md.

function withCors(response: Response): Response {
  const headers = new Headers(response.headers)
  for (const [key, value] of Object.entries(MCP_CORS_HEADERS)) headers.set(key, value)
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
}

function unauthorized(request: Request, reason: 'missing_token' | 'invalid_token'): Response {
  const metadataUrl = `${publicOrigin(request)}${PROTECTED_RESOURCE_METADATA_PATH}`
  const challenge =
    reason === 'invalid_token'
      ? `Bearer error="invalid_token", error_description="The access token is missing, expired or invalid", resource_metadata="${metadataUrl}"`
      : `Bearer resource_metadata="${metadataUrl}"`
  return withCors(
    Response.json(
      { error: reason, error_description: 'Authentication required: sign in to RS Planner via OAuth.' },
      { status: 401, headers: { 'WWW-Authenticate': challenge } }
    )
  )
}

export async function POST(request: Request) {
  const auth = await authenticateMcpRequest(request)
  if (!auth.ok) return unauthorized(request, auth.reason)

  const server = createPlannerMcpServer(auth.context)
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless: no session to keep between requests
    enableJsonResponse: true, // plain JSON instead of SSE — nothing to buffer in nginx
  })

  try {
    await server.connect(transport)
    const response = await transport.handleRequest(request, {
      authInfo: { token: auth.context.token, clientId: auth.context.user.clientId ?? 'unknown', scopes: [] },
    })
    return withCors(response)
  } finally {
    await server.close()
  }
}

// Stateless server: no standalone SSE stream (GET) and no sessions to end (DELETE).
function methodNotAllowed() {
  return withCors(
    Response.json(
      { jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed.' }, id: null },
      { status: 405, headers: { Allow: 'POST, OPTIONS' } }
    )
  )
}

export async function GET(request: Request) {
  // Unauthenticated probes still get the OAuth challenge so clients can discover auth.
  const auth = await authenticateMcpRequest(request)
  if (!auth.ok) return unauthorized(request, auth.reason)
  return methodNotAllowed()
}

export function DELETE() {
  return methodNotAllowed()
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: MCP_CORS_HEADERS })
}
