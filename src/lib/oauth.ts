// Helpers for the OAuth consent flow (Supabase Auth acting as the OAuth 2.1
// server for the RS Planner MCP connector, see docs/mcp-connector.md).

export const CONSENT_PATH = '/oauth/consent'

// The login page may send the user back to the consent page after sign-in.
// Only that exact path is allowed, so `next` can't be abused as an open
// redirect (e.g. `//evil.example` or `https://…`).
export function safeLoginNext(next: string | null | undefined): string | null {
  if (!next) return null
  if (next === CONSENT_PATH || next.startsWith(`${CONSENT_PATH}?`)) return next
  return null
}
