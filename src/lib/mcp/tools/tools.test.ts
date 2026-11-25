import { describe, expect, it } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import type { SupabaseClient } from '@supabase/supabase-js'
import { eachDayOfInterval, parseISO } from 'date-fns'
import type { Allocation, TimeOff } from '@/lib/types'
import { WEEKEND_ALLOCATION_ERROR } from '@/lib/utils'
import { createPlannerMcpServer } from '../server'
import { allocationError } from './allocations'
import { personAvailability } from './availability'
import { isoDate, rangeError } from './helpers'

// Any database access fails the test: these checks must happen before the DB.
const noDb = new Proxy({}, {
  get() {
    throw new Error('unexpected database access')
  },
}) as SupabaseClient

async function connect() {
  const server = createPlannerMcpServer({ user: { id: 'u1', email: 'u@example.com' }, supabase: noDb })
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const client = new Client({ name: 'test', version: '1' })
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])
  return client
}

const P = '11111111-1111-4111-8111-111111111111'
const Q = '22222222-2222-4222-8222-222222222222'

describe('MCP tool registry', () => {
  it('exposes the agreed 18 tools, read-only ones marked as such', async () => {
    const client = await connect()
    const { tools } = await client.listTools()
    const byName = Object.fromEntries(tools.map((t) => [t.name, t]))

    expect(Object.keys(byName).sort()).toEqual([
      'create_allocation', 'create_project', 'create_time_off',
      'delete_allocation', 'delete_time_off',
      'get_availability', 'get_person_competencies', 'get_project',
      'list_allocations', 'list_competencies', 'list_people', 'list_projects', 'list_time_off',
      'search_experts',
      'update_allocation', 'update_project', 'update_time_off',
      'whoami',
    ])
    for (const tool of tools) {
      const writes = /^(create|update|delete)_/.test(tool.name)
      expect(tool.annotations?.readOnlyHint, tool.name).toBe(!writes)
      expect(tool.annotations?.destructiveHint ?? false, tool.name).toBe(tool.name.startsWith('delete_'))
      expect(tool.description?.length, tool.name).toBeGreaterThan(40)
    }
  })

  it('rejects a weekend allocation before touching the database', async () => {
    const client = await connect()
    const result = await client.callTool({
      name: 'create_allocation',
      arguments: { person_id: P, project_id: Q, start_date: '2026-11-28', end_date: '2026-12-04' },
    })
    expect(result.isError).toBe(true)
    expect(JSON.stringify(result.content)).toContain(WEEKEND_ALLOCATION_ERROR)
  })

  it('rejects too long ranges and empty expert searches before the database', async () => {
    const client = await connect()
    const range = await client.callTool({ name: 'list_allocations', arguments: { from: '2026-01-01', to: '2027-01-01' } })
    expect(range.isError).toBe(true)
    const search = await client.callTool({ name: 'search_experts', arguments: {} })
    expect(search.isError).toBe(true)
  })
})

describe('allocationError', () => {
  it('mirrors the allocation modal rules', () => {
    expect(allocationError({ start_date: '2026-11-23', end_date: '2026-11-27' })).toBeNull()
    expect(allocationError({ start_date: '2026-11-27', end_date: '2026-11-23' })).toMatch(/wcześniejsza/)
    expect(allocationError({ start_date: '2026-11-23', end_date: '2026-11-29' })).toBe(WEEKEND_ALLOCATION_ERROR)
  })
})

describe('rangeError / isoDate', () => {
  it('validates ranges and dates', () => {
    expect(rangeError('2026-01-01', '2026-06-30')).toBeNull()
    expect(rangeError('2026-01-02', '2026-01-01')).not.toBeNull()
    expect(rangeError('2026-01-01', '2026-12-31')).not.toBeNull()
    expect(isoDate.safeParse('2026-02-30').success).toBe(false)
    expect(isoDate.safeParse('25.11.2026').success).toBe(false)
  })
})

describe('personAvailability', () => {
  const person = { id: P, full_name: 'Anna', role: 'Dev', capacity_hours_per_day: 8 }
  const week = eachDayOfInterval({ start: parseISO('2026-11-23'), end: parseISO('2026-11-29') }) // Mon–Sun
  const alloc = (status: Allocation['status'], hours: number) =>
    ({ id: status, person_id: P, project_id: Q, start_date: '2026-11-23', end_date: '2026-11-27', hours_per_day: hours, status }) as Allocation

  it('counts confirmed work only and reports tentative hours separately', () => {
    const r = personAvailability(person, [alloc('confirmed', 4), alloc('tentative', 2)], [], week)
    expect(r.capacity_hours).toBe(40)
    expect(r.allocated_hours).toBe(20)
    expect(r.free_hours).toBe(20)
    expect(r.tentative_hours).toBe(10)
    expect(r.state).toBe('free')
  })

  it('subtracts time off and flags overload', () => {
    const off = [{ id: 't', person_id: P, start_date: '2026-11-26', end_date: '2026-11-27', type: 'vacation', notes: null, created_at: '' }] as TimeOff[]
    const r = personAvailability(person, [alloc('confirmed', 10)], off, week)
    expect(r.capacity_hours).toBe(24)
    expect(r.time_off_workdays).toBe(2)
    expect(r.state).toBe('overloaded')
  })
})
