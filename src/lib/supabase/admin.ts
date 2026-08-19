import { createClient } from '@supabase/supabase-js'

// Service-role Supabase client for the public API. It BYPASSES Row Level Security,
// so it must only ever be used inside server-side route handlers that are already
// guarded by requireApiKey(). Never import this into a client component.
//
// Requires SUPABASE_SERVICE_ROLE_KEY (server-only secret, not NEXT_PUBLIC_*).
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — required for the competency API.'
    )
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
