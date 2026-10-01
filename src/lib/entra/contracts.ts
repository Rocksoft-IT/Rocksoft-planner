import { CONTRACT_TYPES, type ContractType } from '@/lib/types'
import type { GraphUser } from './graph'
import { readAttribute } from './graph'

export function contractMapping(raw = process.env.ENTRA_CONTRACT_VALUE_MAP): Record<string, ContractType | null> {
  const mapping: Record<string, ContractType | null> = {
    ...Object.fromEntries(CONTRACT_TYPES.map((type) => [type.toLowerCase(), type])),
    'umowa o pracę': 'UoP',
    '-': null,
  }
  if (!raw?.trim()) return mapping
  const extra: unknown = JSON.parse(raw)
  if (!extra || Array.isArray(extra) || typeof extra !== 'object') throw new Error('Invalid ENTRA_CONTRACT_VALUE_MAP.')
  for (const [key, value] of Object.entries(extra)) {
    if ((value !== null && !CONTRACT_TYPES.includes(value as ContractType)) || !key.trim()) {
      throw new Error('Invalid ENTRA_CONTRACT_VALUE_MAP.')
    }
    mapping[key.trim().toLowerCase()] = value as ContractType | null
  }
  return mapping
}

export function planContractSync(
  members: { id: string; email: string }[], users: GraphUser[], attribute: string,
  mapping: Record<string, ContractType | null>,
) {
  const byEmail = new Map<string, Map<string, GraphUser>>()
  for (const user of users) {
    for (const email of [user.mail, user.userPrincipalName]) {
      if (typeof email !== 'string' || !email.trim()) continue
      const key = email.trim().toLowerCase()
      const matches = byEmail.get(key) ?? new Map<string, GraphUser>()
      matches.set(user.id, user)
      byEmail.set(key, matches)
    }
  }
  const updates: { id: string; email: string; entra_user_id: string; contract_type: ContractType | null }[] = []
  const skipped = { unmatched: 0, ambiguous: 0, missing: 0, unknown: 0 }
  for (const member of members) {
    const matches = byEmail.get(member.email?.trim().toLowerCase())
    if (!matches?.size) { skipped.unmatched++; continue }
    if (matches.size !== 1) { skipped.ambiguous++; continue }
    const user = [...matches.values()][0]
    const raw = readAttribute(user, attribute)
    if (raw === null || raw === undefined || raw === '') { skipped.missing++; continue }
    const value = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
    const type = Object.hasOwn(mapping, value) ? mapping[value] : undefined
    // null is an explicit "no contract" value, distinct from unknown/missing data.
    if (type === undefined) { skipped.unknown++; continue }
    updates.push({ id: member.id, email: member.email, entra_user_id: user.id, contract_type: type })
  }
  return { updates, skipped }
}
