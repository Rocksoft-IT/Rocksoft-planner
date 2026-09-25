import { describe, expect, it } from 'vitest'
import { compareByContractType } from './utils'
import type { ContractType, TeamMember } from './types'

function makePerson(full_name: string, contract_type: ContractType | null): TeamMember {
  return {
    id: full_name,
    full_name,
    role: 'Developer',
    email: `${full_name.toLowerCase()}@example.com`,
    capacity_hours_per_day: 8,
    avatar_color: '#6366f1',
    contract_type,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  }
}

describe('compareByContractType', () => {
  it('orders UoP -> B2B -> Freelance -> unset, alphabetically by name within each group (AC-02)', () => {
    const anna = makePerson('Anna', 'Freelance')
    const bartek = makePerson('Bartek', 'UoP')
    const celina = makePerson('Celina', 'B2B')
    const damian = makePerson('Damian', 'UoP')
    const ewa = makePerson('Ewa', null)

    const sorted = [anna, bartek, celina, damian, ewa].sort(compareByContractType)

    expect(sorted.map((p) => p.full_name)).toEqual(['Bartek', 'Damian', 'Celina', 'Anna', 'Ewa'])
  })

  it('sorts people with the same contract type alphabetically by full name', () => {
    const zack = makePerson('Zack', 'B2B')
    const amy = makePerson('Amy', 'B2B')

    const sorted = [zack, amy].sort(compareByContractType)

    expect(sorted.map((p) => p.full_name)).toEqual(['Amy', 'Zack'])
  })

  it('sorts unset people alphabetically by full name, after every typed person', () => {
    const zack = makePerson('Zack', null)
    const amy = makePerson('Amy', null)
    const bartek = makePerson('Bartek', 'UoP')

    const sorted = [zack, amy, bartek].sort(compareByContractType)

    expect(sorted.map((p) => p.full_name)).toEqual(['Bartek', 'Amy', 'Zack'])
  })
})
