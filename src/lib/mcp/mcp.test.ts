import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { safeLoginNext } from '@/lib/oauth'
import { ilikePattern } from './tools/helpers'
import { protectedResourceMetadata } from './config'
import { bearerToken } from './auth'

describe('safeLoginNext', () => {
  it('allows only the consent page', () => {
    expect(safeLoginNext('/oauth/consent?authorization_id=abc')).toBe('/oauth/consent?authorization_id=abc')
    expect(safeLoginNext('/oauth/consent')).toBe('/oauth/consent')
    expect(safeLoginNext('/timeline')).toBeNull()
    expect(safeLoginNext('//evil.example/oauth/consent')).toBeNull()
    expect(safeLoginNext('https://evil.example')).toBeNull()
    expect(safeLoginNext('/oauth/consent-evil')).toBeNull()
    expect(safeLoginNext(null)).toBeNull()
  })
})

describe('ilikePattern', () => {
  it('escapes LIKE wildcards', () => {
    expect(ilikePattern('ab')).toBe('%ab%')
    expect(ilikePattern('50%_x')).toBe('%50\\%\\_x%')
  })
})

describe('bearerToken', () => {
  it('reads only a bearer token', () => {
    expect(bearerToken(new Request('http://x', { headers: { Authorization: 'Bearer abc.def' } }))).toBe('abc.def')
    expect(bearerToken(new Request('http://x', { headers: { Authorization: 'Basic abc' } }))).toBeNull()
    expect(bearerToken(new Request('http://x'))).toBeNull()
  })
})

describe('protectedResourceMetadata', () => {
  const env = { ...process.env }
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://proj.supabase.co/'
    process.env.NEXT_PUBLIC_SITE_URL = 'https://planner.example.pl/'
  })
  afterEach(() => {
    process.env = { ...env }
  })

  it('points at the MCP endpoint and Supabase Auth', () => {
    const meta = protectedResourceMetadata(new Request('http://localhost:3000/x'))
    expect(meta.resource).toBe('https://planner.example.pl/api/mcp')
    expect(meta.authorization_servers).toEqual(['https://proj.supabase.co/auth/v1'])
  })

  it('falls back to forwarded headers without NEXT_PUBLIC_SITE_URL', () => {
    delete process.env.NEXT_PUBLIC_SITE_URL
    const meta = protectedResourceMetadata(
      new Request('http://127.0.0.1:3000/x', { headers: { 'x-forwarded-proto': 'https', 'x-forwarded-host': 'p.example' } })
    )
    expect(meta.resource).toBe('https://p.example/api/mcp')
  })
})
