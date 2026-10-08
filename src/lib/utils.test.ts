import { describe, expect, it } from 'vitest'
import { calcUtilization, compareByContractType, countWorkdays, formatAvailability, isWeekendDate, matchesContractTypeFilter, NO_CONTRACT_TYPE, validateAllocationDates, WEEKEND_ALLOCATION_ERROR } from './utils'
import type { Allocation, ContractType, TeamMember } from './types'

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

describe('matchesContractTypeFilter', () => {
  const bartek = makePerson('Bartek', 'UoP')
  const celina = makePerson('Celina', 'B2B')
  const anna = makePerson('Anna', 'Freelance')
  const ewa = makePerson('Ewa', null)
  const everyone = [bartek, celina, anna, ewa]

  it('passes everyone when nothing is selected', () => {
    expect(everyone.filter((p) => matchesContractTypeFilter(p, []))).toEqual(everyone)
  })

  it('keeps only people with a selected contract type', () => {
    const shown = everyone.filter((p) => matchesContractTypeFilter(p, ['B2B', 'Freelance']))
    expect(shown.map((p) => p.full_name)).toEqual(['Celina', 'Anna'])
  })

  it('matches people with no contract type via NO_CONTRACT_TYPE', () => {
    const shown = everyone.filter((p) => matchesContractTypeFilter(p, [NO_CONTRACT_TYPE]))
    expect(shown.map((p) => p.full_name)).toEqual(['Ewa'])
  })
})

function makeAllocation(
  hours_per_day: number,
  status: Allocation['status'],
  start_date = '2026-10-05',
  end_date = '2026-10-09',
): Allocation {
  return {
    id: `${status}-${hours_per_day}`,
    person_id: 'p1',
    project_id: 'proj',
    start_date,
    end_date,
    hours_per_day,
    status,
    notes: null,
    created_by: null,
    updated_by: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  }
}

describe('calcUtilization', () => {
  // Mon 2026-10-05 .. Fri 2026-10-09 — five workdays, 40h capacity at 8h/day.
  const week = [5, 6, 7, 8, 9].map((d) => new Date(2026, 9, d))

  it('ignores tentative allocations, so they never cause overload', () => {
    const util = calcUtilization(
      [makeAllocation(8, 'confirmed'), makeAllocation(8, 'tentative')],
      week,
      8,
    )
    expect(util.allocatedHours).toBe(40)
    expect(util.allocated).toBe(100)
    expect(formatAvailability(util).isOver).toBe(false)
  })

  it('still flags overload from confirmed allocations', () => {
    const util = calcUtilization(
      [makeAllocation(8, 'confirmed'), makeAllocation(2, 'confirmed')],
      week,
      8,
    )
    expect(util.allocatedHours).toBe(50)
    expect(formatAvailability(util).isOver).toBe(true)
  })

  it('books no hours on Saturday and Sunday of an allocation spanning a weekend', () => {
    // Fri 2026-10-09 .. Mon 2026-10-12 — Sat/Sun inside the range book nothing.
    const span = [9, 10, 11, 12].map((d) => new Date(2026, 9, d))
    const util = calcUtilization([makeAllocation(8, 'confirmed', '2026-10-09', '2026-10-12')], span, 8)
    expect(util.allocatedHours).toBe(16)
    expect(util.capacityHours).toBe(16)
  })
})

describe('weekend allocation rules', () => {
  it('detects Saturday and Sunday', () => {
    expect(isWeekendDate('2026-10-09')).toBe(false) // Fri
    expect(isWeekendDate('2026-10-10')).toBe(true) // Sat
    expect(isWeekendDate('2026-10-11')).toBe(true) // Sun
    expect(isWeekendDate('2026-10-12')).toBe(false) // Mon
  })

  it('rejects an allocation that starts or ends on a weekend', () => {
    expect(validateAllocationDates('2026-10-10', '2026-10-12')).toBe(WEEKEND_ALLOCATION_ERROR)
    expect(validateAllocationDates('2026-10-09', '2026-10-11')).toBe(WEEKEND_ALLOCATION_ERROR)
    expect(validateAllocationDates('2026-10-10', '2026-10-10')).toBe(WEEKEND_ALLOCATION_ERROR)
  })

  it('allows an allocation spanning a weekend between two workdays', () => {
    expect(validateAllocationDates('2026-10-09', '2026-10-12')).toBeNull()
  })

  it('counts only workdays in a range', () => {
    expect(countWorkdays('2026-10-05', '2026-10-18')).toBe(10)
    expect(countWorkdays('2026-10-09', '2026-10-12')).toBe(2)
    expect(countWorkdays('2026-10-12', '2026-10-09')).toBe(0)
  })
})
