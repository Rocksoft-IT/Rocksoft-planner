import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export interface McpUser {
  id: string
  email: string | null
  /** OAuth client that obtained the token (e.g. Claude), when issued via the OAuth server. */
  clientId: string | null
}

export interface McpContext {
  user: McpUser
  /** Supabase client acting AS the user: every query goes through RLS. */
  supabase: SupabaseClient
  token: string
}

export type McpAuthResult =
  | { ok: true; context: McpContext }
  | { ok: false; reason: 'missing_token' | 'invalid_token' }

function supabaseFor(token?: string): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
  })
}

// Module-level client used only to verify tokens: getClaims() verifies the
// asymmetric (ES256) signature against the project's JWKS and caches the keys.
let verifier: SupabaseClient | null = null

export function bearerToken(request: Request): string | null {
  const match = (request.headers.get('authorization') ?? '').match(/^Bearer\s+(.+)$/i)
  return match?.[1]?.trim() || null
}

// Authenticate an MCP request by its OAuth access token (issued by Supabase
// Auth's OAuth 2.1 server). Never uses the service-role key: the returned
// client carries the user's token, so RLS applies exactly as in the app.
export async function authenticateMcpRequest(request: Request): Promise<McpAuthResult> {
  const token = bearerToken(request)
  if (!token) return { ok: false, reason: 'missing_token' }

  verifier ??= supabaseFor()
  const { data, error } = await verifier.auth.getClaims(token)
  const claims = data?.claims
  if (error || !claims?.sub || claims.role !== 'authenticated') {
    return { ok: false, reason: 'invalid_token' }
  }

  const clientId = typeof claims.client_id === 'string' ? claims.client_id : null
  return {
    ok: true,
    context: {
      user: { id: claims.sub, email: typeof claims.email === 'string' ? claims.email : null, clientId },
      supabase: supabaseFor(token),
      token,
    },
  }
}
