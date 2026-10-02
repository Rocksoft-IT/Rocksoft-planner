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

export type SyncMember = { id: string; email: string; full_name: string }

export function normalizeName(value: string | null | undefined): string {
  return (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
}

export function planContractSync(
  members: SyncMember[], users: GraphUser[], attribute: string,
  mapping: Record<string, ContractType | null>, nameMembers: SyncMember[] = members,
) {
  const byEmail = new Map<string, Map<string, GraphUser>>()
  const byName = new Map<string, Map<string, GraphUser>>()
  const membersByName = new Map<string, Set<string>>()
  const memberEmails = new Map<string, Set<string>>()
  for (const member of nameMembers) {
    const email = member.email?.trim().toLowerCase()
    if (email) {
      const owners = memberEmails.get(email) ?? new Set<string>()
      owners.add(member.id)
      memberEmails.set(email, owners)
    }
    const name = normalizeName(member.full_name)
    if (!name) continue
    const matches = membersByName.get(name) ?? new Set<string>()
    matches.add(member.id)
    membersByName.set(name, matches)
  }
  for (const user of users) {
    for (const email of [user.mail, user.userPrincipalName]) {
      if (typeof email !== 'string' || !email.trim()) continue
      const key = email.trim().toLowerCase()
      const matches = byEmail.get(key) ?? new Map<string, GraphUser>()
      matches.set(user.id, user)
      byEmail.set(key, matches)
    }
    const name = normalizeName(user.displayName)
    if (name) {
      const matches = byName.get(name) ?? new Map<string, GraphUser>()
      matches.set(user.id, user)
      byName.set(name, matches)
    }
  }
  const updates: {
    id: string; email: string; full_name: string; match_by_name: boolean
    entra_user_id: string; contract_type: ContractType | null
    email_to_fill: string | null; sync_contract: boolean
  }[] = []
  const skipped = { unmatched: 0, ambiguous: 0, missing: 0, unknown: 0 }
  for (const member of members) {
    const email = member.email?.trim().toLowerCase()
    const name = normalizeName(member.full_name)
    // A nonempty but unmatched email never falls back to the less stable name.
    if (!email && name && (membersByName.get(name)?.size ?? 0) > 1) {
      skipped.ambiguous++; continue
    }
    const matches = email ? byEmail.get(email) : byName.get(name)
    if (!matches?.size) { skipped.unmatched++; continue }
    if (matches.size !== 1) { skipped.ambiguous++; continue }
    const user = [...matches.values()][0]
    // Prefer mail; use a real UPN only when mail is unavailable/unsafe.
    // Guest #EXT# login names are not employee email addresses.
    const emailToFill = !email ? [user.mail, user.userPrincipalName]
      .find((candidate) => {
        if (typeof candidate !== 'string') return false
        const key = candidate.trim().toLowerCase()
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(key) && !key.includes('#ext#')
          && byEmail.get(key)?.size === 1
          && ![...(memberEmails.get(key) ?? [])].some((id) => id !== member.id)
      })?.trim().toLowerCase() ?? null : null
    const raw = readAttribute(user, attribute)
    let type: ContractType | null | undefined
    if (raw === null || raw === undefined || raw === '') {
      skipped.missing++
    } else {
      const value = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
      type = Object.hasOwn(mapping, value) ? mapping[value] : undefined
      if (type === undefined) skipped.unknown++
    }
    // Filling an email does not require a known contract. Preserve the existing
    // contract in that case; null is reserved for an explicit mapped "-".
    if (type === undefined && !emailToFill) continue
    updates.push({
      id: member.id, email: member.email, full_name: member.full_name,
      match_by_name: !email, entra_user_id: user.id, contract_type: type ?? null,
      email_to_fill: emailToFill, sync_contract: type !== undefined,
    })
  }
  return { updates, skipped }
}
