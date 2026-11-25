import { NextResponse, type NextRequest } from 'next/server'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { authenticateMcpRequest } from '@/lib/mcp/auth'
import { PROTECTED_RESOURCE_METADATA_PATH, publicOrigin } from '@/lib/mcp/config'
import { createPlannerMcpServer } from '@/lib/mcp/server'

export const dynamic = 'force-dynamic'

// POST /api/mcp — remote MCP server (Streamable HTTP) for the Claude connector.
// Stateless: each request is authenticated on its own and answered with plain
// JSON (no SSE), so there is no session to keep and nothing for nginx to buffer.
export async function POST(request: NextRequest) {
  const auth = await authenticateMcpRequest(request)
  if (!auth.ok) {
    // The challenge tells MCP clients where to start the OAuth flow.
    const metadata = `resource_metadata="${publicOrigin(request)}${PROTECTED_RESOURCE_METADATA_PATH}"`
    const challenge = auth.reason === 'invalid_token' ? `Bearer error="invalid_token", ${metadata}` : `Bearer ${metadata}`
    return NextResponse.json(
      { error: auth.reason, error_description: 'Sign in to RS Planner via OAuth.' },
      { status: 401, headers: { 'WWW-Authenticate': challenge } }
    )
  }

  const server = createPlannerMcpServer(auth.context)
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
  try {
    await server.connect(transport)
    return await transport.handleRequest(request)
  } finally {
    await server.close()
  }
}

// No standalone SSE stream (GET) and no sessions to end (DELETE) in stateless mode.
function methodNotAllowed() {
  return NextResponse.json(
    { jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed.' }, id: null },
    { status: 405, headers: { Allow: 'POST' } }
  )
}

export { methodNotAllowed as GET, methodNotAllowed as DELETE }
