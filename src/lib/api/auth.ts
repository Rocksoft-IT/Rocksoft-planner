import { timingSafeEqual } from 'crypto'
import { NextResponse, type NextRequest } from 'next/server'

// Constant-time string compare, so a valid key can't be recovered by timing the
// response. Bailing on a length mismatch leaks only the key length, which is fine.
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

// API-key auth for the public competency API. Callers pass:
//   Authorization: Bearer <key>
// checked against COMPETENCY_API_KEYS (comma-separated list of valid keys).
//
// Returns a 401 NextResponse when the key is missing/invalid, otherwise null
// (meaning: proceed). Usage in a route handler:
//   const denied = requireApiKey(request)
//   if (denied) return denied
export function requireApiKey(request: NextRequest): NextResponse | null {
  const configured = (process.env.COMPETENCY_API_KEYS ?? '')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean)

  if (configured.length === 0) {
    return NextResponse.json(
      { error: 'API not configured: set COMPETENCY_API_KEYS on the server.' },
      { status: 503 }
    )
  }

  const header = request.headers.get('authorization') ?? ''
  const match = header.match(/^Bearer\s+(.+)$/i)
  const presented = match?.[1]?.trim()

  // Check every configured key (no short-circuit) so match time doesn't leak
  // which key — or how many — matched.
  let ok = false
  if (presented) for (const key of configured) ok = safeEqual(key, presented) || ok

  if (!ok) {
    return NextResponse.json(
      { error: 'Unauthorized: missing or invalid API key.' },
      { status: 401 }
    )
  }

  return null
}
