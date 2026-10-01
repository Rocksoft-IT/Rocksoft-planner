// Server/CLI only: contains credentials. Never import into client components.
export type GraphUser = {
  id: string
  mail?: string | null
  userPrincipalName?: string | null
  [attribute: string]: unknown
}

export function getGraphCredentials() {
  const tenantId = process.env.ENTRA_TENANT_ID?.trim()
  const clientId = process.env.ENTRA_CLIENT_ID?.trim()
  const clientSecret = process.env.ENTRA_CLIENT_SECRET
  if (!tenantId || !clientId || !clientSecret) {
    throw new Error('Configure ENTRA_TENANT_ID, ENTRA_CLIENT_ID and ENTRA_CLIENT_SECRET.')
  }
  if (!/^[a-zA-Z0-9.-]+$/.test(tenantId)) throw new Error('Invalid ENTRA_TENANT_ID.')
  return { tenantId, clientId, clientSecret }
}

export function getContractAttribute() {
  const attribute = process.env.ENTRA_CONTRACT_ATTRIBUTE?.trim()
  // Standard properties, on-premises extension attributes and directory/schema extensions.
  if (!attribute || !/^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)?$/.test(attribute)) {
    throw new Error('Set ENTRA_CONTRACT_ATTRIBUTE (employeeType for the Rocksoft directory).')
  }
  return attribute
}

export function readAttribute(user: GraphUser, path: string): unknown {
  return path.split('.').reduce<unknown>((value, key) =>
    value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined,
  user)
}

export async function getGraphUsers(attributes: string[], email?: string): Promise<GraphUser[]> {
  const { tenantId, clientId, clientSecret } = getGraphCredentials()
  const tokenResponse = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    body: new URLSearchParams({
      client_id: clientId, client_secret: clientSecret,
      scope: 'https://graph.microsoft.com/.default', grant_type: 'client_credentials',
    }),
    cache: 'no-store', signal: AbortSignal.timeout(15_000), redirect: 'error',
  })
  // Do not expose response bodies: they can contain tenant/user information.
  if (!tokenResponse.ok) throw new Error(`Entra token request failed (${tokenResponse.status}).`)
  const token = await tokenResponse.json().catch(() => {
    throw new Error('Invalid Entra token response.')
  })
  if (typeof token.access_token !== 'string' || !token.access_token) throw new Error('Invalid Entra token response.')

  const query = new URLSearchParams({
    '$select': [...new Set(['id', 'mail', 'userPrincipalName', ...attributes.map((a) => a.split('.')[0])])].join(','),
    '$top': '999',
  })
  if (email !== undefined) {
    if (!email.trim()) throw new Error('An email is required for an individual Graph lookup.')
    const literal = email.trim().toLowerCase().replaceAll("'", "''")
    query.set('$filter', `mail eq '${literal}' or userPrincipalName eq '${literal}'`)
  }
  let next: string | undefined = `https://graph.microsoft.com/v1.0/users?${query}`
  const users: GraphUser[] = []
  const visited = new Set<string>()
  const deadline = Date.now() + 45_000
  while (next) {
    const url = new URL(next)
    if (url.origin !== 'https://graph.microsoft.com' || url.pathname !== '/v1.0/users' || visited.has(next)) {
      throw new Error('Invalid Graph pagination link.')
    }
    visited.add(next)
    if (Date.now() >= deadline) throw new Error('Graph directory read timed out.')
    const response: Response = await fetch(next, {
      headers: { Authorization: `Bearer ${token.access_token}` },
      cache: 'no-store', signal: AbortSignal.timeout(Math.min(15_000, deadline - Date.now())), redirect: 'error',
    })
    if (!response.ok) throw new Error(`Graph users request failed (${response.status}).`)
    const page: { value?: GraphUser[]; '@odata.nextLink'?: string } = await response.json().catch(() => {
      throw new Error('Invalid Graph users response.')
    })
    if (!Array.isArray(page.value) || page.value.some((u: GraphUser) => !u || typeof u.id !== 'string')) {
      throw new Error('Invalid Graph users response.')
    }
    users.push(...page.value)
    next = page['@odata.nextLink']
    if (next !== undefined && typeof next !== 'string') throw new Error('Invalid Graph pagination response.')
  }
  return users
}
