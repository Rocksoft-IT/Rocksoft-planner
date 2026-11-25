// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { POST, GET as mcpGet } from '@/app/api/mcp/route'
import { GET as apiMetadata } from '@/app/api/mcp/oauth-protected-resource/route'
import { GET as wellKnownMetadata } from '@/app/.well-known/oauth-protected-resource/[[...resource]]/route'

const ORIGIN = 'https://planner.example.pl'
const env = { ...process.env }

beforeEach(() => {
  process.env.NEXT_PUBLIC_SITE_URL = ORIGIN
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://proj.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon'
})
afterEach(() => {
  process.env = { ...env }
})

const expectedMetadata = {
  resource: `${ORIGIN}/api/mcp`,
  authorization_servers: ['https://proj.supabase.co/auth/v1'],
  bearer_methods_supported: ['header'],
  resource_name: 'RS Planner',
}

describe('/api/mcp', () => {
  it('answers an unauthenticated request with a challenge pointing at metadata under /api', async () => {
    const res = await POST(new NextRequest('http://127.0.0.1:3000/api/mcp', { method: 'POST', body: '{}' }))
    expect(res.status).toBe(401)
    // Not /.well-known: RunCloud's nginx answers 403 for dot paths.
    expect(res.headers.get('www-authenticate')).toBe(`Bearer resource_metadata="${ORIGIN}/api/mcp/oauth-protected-resource"`)
  })

  it('rejects GET in stateless mode', async () => {
    expect((await mcpGet()).status).toBe(405)
  })
})

describe('protected resource metadata', () => {
  it('is served under /api', async () => {
    const res = apiMetadata(new NextRequest('http://127.0.0.1:3000/api/mcp/oauth-protected-resource'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(expectedMetadata)
  })

  it('is served at the RFC 9728 well-known URLs, 404 for other resources', async () => {
    const req = new NextRequest('http://127.0.0.1:3000/.well-known/oauth-protected-resource/api/mcp')
    const call = (resource?: string[]) => wellKnownMetadata(req, { params: Promise.resolve({ resource }) })
    expect(await (await call(['api', 'mcp'])).json()).toEqual(expectedMetadata)
    expect(await (await call(undefined)).json()).toEqual(expectedMetadata)
    expect((await call(['other'])).status).toBe(404)
  })
})
