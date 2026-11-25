export const CONSENT_PATH = '/oauth/consent'

// `next` after sign-in may only point at the OAuth consent screen, so it can't
// be used as an open redirect (e.g. `//evil.example`).
export function safeLoginNext(next: string | null | undefined): string | null {
  if (!next) return null
  if (next === CONSENT_PATH || next.startsWith(`${CONSENT_PATH}?`)) return next
  return null
}
