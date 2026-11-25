import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export interface McpContext {
  user: { id: string; email: string | null }
  // Acts AS the user (their access token), so every query goes through RLS.
  supabase: SupabaseClient
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

// Reused across requests so getClaims() keeps its cached JWKS.
let verifier: SupabaseClient | null = null

export function bearerToken(request: Request): string | null {
  const match = (request.headers.get('authorization') ?? '').match(/^Bearer\s+(.+)$/i)
  return match?.[1]?.trim() || null
}

// Verifies the OAuth access token issued by Supabase Auth (ES256 signature
// against the project's JWKS). Never uses the service-role key.
export async function authenticateMcpRequest(request: Request): Promise<McpAuthResult> {
  const token = bearerToken(request)
  if (!token) return { ok: false, reason: 'missing_token' }

  verifier ??= supabaseFor()
  const { data, error } = await verifier.auth.getClaims(token)
  const claims = data?.claims
  if (error || !claims?.sub || claims.role !== 'authenticated') {
    return { ok: false, reason: 'invalid_token' }
  }

  return {
    ok: true,
    context: {
      user: { id: claims.sub, email: typeof claims.email === 'string' ? claims.email : null },
      supabase: supabaseFor(token),
    },
  }
}
