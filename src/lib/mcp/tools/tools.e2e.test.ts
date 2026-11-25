import { describe, expect, it } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { format } from 'date-fns'
import { PROJECT_COLORS, WEEKEND_ALLOCATION_ERROR } from '@/lib/utils'
import { createPlannerMcpServer } from '../server'
import { createFakeSupabase, type FakeOptions } from './fake-supabase'

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- tool results are free-form JSON
type Json = any

// Every MCP tool, end to end through a real MCP client, over an in-memory database.

const ANNA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const BARTEK = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const CELINA = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const ALPHA = '11111111-1111-4111-8111-111111111111'
const BETA = '22222222-2222-4222-8222-222222222222'
const GAMMA = '33333333-3333-4333-8333-333333333333'
const A1 = 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1'
const A2 = 'a2a2a2a2-a2a2-4a2a-8a2a-a2a2a2a2a2a2'
const T1 = 'f1f1f1f1-f1f1-4f1f-8f1f-f1f1f1f1f1f1'
const MISSING = '99999999-9999-4999-8999-999999999999'

function seed(): FakeOptions['tables'] {
  return {
    profiles: [{ id: 'user-1', email: 'jan@rocksoft.pl', full_name: 'Jan', role: 'admin', is_admin: false }],
    team_members: [
      { id: ANNA, full_name: 'Anna Nowak', email: 'anna@rocksoft.pl', role: 'Frontend Developer', contract_type: 'B2B', capacity_hours_per_day: 8 },
      { id: BARTEK, full_name: 'Bartek Kowal', email: 'bartek@rocksoft.pl', role: 'Backend Developer', contract_type: 'UoP', capacity_hours_per_day: 8 },
      { id: CELINA, full_name: 'Celina 50%_x', email: 'celina@rocksoft.pl', role: 'Designer', contract_type: null, capacity_hours_per_day: 4 },
    ],
    projects: [
      { id: ALPHA, name: 'Alpha', description: null, color: '#6366f1', start_date: null, end_date: null },
      { id: BETA, name: 'Beta', description: 'Opis', color: '#ec4899', start_date: '2026-01-01', end_date: '2026-06-30' },
      { id: GAMMA, name: 'Gamma', description: null, color: '#f59e0b', start_date: '2027-01-01', end_date: null },
    ],
    allocations: [
      { id: A1, person_id: ANNA, project_id: ALPHA, start_date: '2026-11-23', end_date: '2026-11-27', hours_per_day: 8, status: 'confirmed', notes: null },
      { id: A2, person_id: BARTEK, project_id: ALPHA, start_date: '2026-11-30', end_date: '2026-12-04', hours_per_day: 4, status: 'tentative', notes: 'wstępnie' },
    ],
    time_off: [{ id: T1, person_id: BARTEK, type: 'vacation', start_date: '2026-12-01', end_date: '2026-12-02', notes: null }],
    competency_tags: [
      { kind: 'technology', name: 'React', slug: 'react' },
      { kind: 'skill', name: 'UX design', slug: 'ux-design' },
    ],
  }
}

async function setup(options: Partial<FakeOptions> = {}) {
  const fake = createFakeSupabase({
    tables: seed(),
    rpc: { search_experts: () => Array.from({ length: 12 }, (_, i) => ({ team_member_id: `p${i}`, score: 12 - i })) },
    ...options,
  })
  const server = createPlannerMcpServer({ user: { id: 'user-1', email: 'jan@rocksoft.pl' }, supabase: fake.client })
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const client = new Client({ name: 'test', version: '1' })
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])

  async function call(name: string, args: Record<string, unknown> = {}) {
    const result = await client.callTool({ name, arguments: args })
    const text = (result.content as { type: string; text: string }[])[0]?.text ?? ''
    let json: Record<string, Json> = {}
    try {
      json = JSON.parse(text)
    } catch {}
    return { isError: Boolean(result.isError), text, json }
  }
  return { fake, call }
}

describe('read tools', () => {
  it('whoami: profile with is_admin separate from job title', async () => {
    const { call } = await setup()
    const r = await call('whoami')
    expect(r.isError).toBe(false)
    expect(r.json).toEqual({ id: 'user-1', email: 'jan@rocksoft.pl', full_name: 'Jan', job_title: 'admin', is_admin: false })
  })

  it('list_people: by name/email, job title, contract type; LIKE characters are literal', async () => {
    const { call } = await setup()
    expect((await call('list_people')).json.people).toHaveLength(3)
    expect((await call('list_people', { query: 'anna@' })).json.people.map((p: Json) => p.id)).toEqual([ANNA])
    expect((await call('list_people', { query: 'nowak' })).json.people.map((p: Json) => p.id)).toEqual([ANNA])
    expect((await call('list_people', { query: '50%_x' })).json.people.map((p: Json) => p.id)).toEqual([CELINA])
    expect((await call('list_people', { query: '%' })).json.people).toHaveLength(1)
    expect((await call('list_people', { role: 'developer' })).json.people).toHaveLength(2)
    expect((await call('list_people', { contract_type: 'none' })).json.people.map((p: Json) => p.id)).toEqual([CELINA])
    expect((await call('list_people', { contract_type: 'UoP' })).json.people.map((p: Json) => p.id)).toEqual([BARTEK])
    expect((await call('list_people', { contract_type: 'Etat' })).isError).toBe(true)
  })

  it('list_projects: name filter, active_on with open-ended dates, limit', async () => {
    const { call } = await setup()
    expect((await call('list_projects')).json.projects.map((p: Json) => p.name)).toEqual(['Alpha', 'Beta', 'Gamma'])
    expect((await call('list_projects', { query: 'et' })).json.projects.map((p: Json) => p.name)).toEqual(['Beta'])
    expect((await call('list_projects', { active_on: '2026-03-15' })).json.projects.map((p: Json) => p.name)).toEqual(['Alpha', 'Beta'])
    expect((await call('list_projects', { active_on: '2027-03-15' })).json.projects.map((p: Json) => p.name)).toEqual(['Alpha', 'Gamma'])
    const limited = await call('list_projects', { limit: 2 })
    expect(limited.json.projects).toHaveLength(2)
    expect(limited.json.truncated).toBe(true)
    expect((await call('list_projects', { active_on: '2026-02-30' })).isError).toBe(true)
  })

  it('get_project: allocations with names and booked hours', async () => {
    const { call } = await setup()
    const r = await call('get_project', { project_id: ALPHA })
    expect(r.json.project.name).toBe('Alpha')
    expect(r.json.allocations.map((a: Json) => a.person.full_name)).toEqual(['Anna Nowak', 'Bartek Kowal'])
    expect(r.json.booked_hours).toEqual({ confirmed: 40, tentative: 20 })
    expect((await call('get_project', { project_id: MISSING })).isError).toBe(true)
    expect((await call('get_project', { project_id: 'not-a-uuid' })).isError).toBe(true)
  })

  it('list_allocations: overlap with the period, filters, names and workdays', async () => {
    const { call } = await setup()
    const all = await call('list_allocations', { from: '2026-11-25', to: '2026-12-01' })
    expect(all.json.allocations.map((a: Json) => a.id)).toEqual([A1, A2])
    expect(all.json.allocations[0]).toMatchObject({ person: { id: ANNA, full_name: 'Anna Nowak' }, project: { id: ALPHA, name: 'Alpha' }, workdays: 5 })
    expect((await call('list_allocations', { from: '2026-11-28', to: '2026-11-29' })).json.allocations).toHaveLength(0)
    expect((await call('list_allocations', { from: '2026-11-01', to: '2026-12-31', person_id: BARTEK })).json.allocations.map((a: Json) => a.id)).toEqual([A2])
    expect((await call('list_allocations', { from: '2026-11-01', to: '2026-12-31', status: 'confirmed' })).json.allocations.map((a: Json) => a.id)).toEqual([A1])
    expect((await call('list_allocations', { from: '2026-12-31', to: '2026-11-01' })).isError).toBe(true)
  })

  it('get_availability: confirmed busy, tentative separate, time off reduces capacity', async () => {
    const { call } = await setup()
    const r = await call('get_availability', { from: '2026-11-23', to: '2026-12-04' })
    const byId = Object.fromEntries(r.json.people.map((p: Json) => [p.person.id, p]))
    expect(byId[ANNA]).toMatchObject({ capacity_hours: 80, allocated_hours: 40, free_hours: 40, tentative_hours: 0 })
    expect(byId[BARTEK]).toMatchObject({ capacity_hours: 64, allocated_hours: 0, free_hours: 64, tentative_hours: 12, time_off_workdays: 2 })
    expect(byId[CELINA]).toMatchObject({ capacity_hours: 40, free_hours: 40, state: 'free' })
    expect(r.json.people.map((p: Json) => p.person.id)).toEqual([BARTEK, ANNA, CELINA])

    const filtered = await call('get_availability', { from: '2026-11-23', to: '2026-11-27', role: 'developer', min_free_hours: 1 })
    expect(filtered.json.people.map((p: Json) => p.person.id)).toEqual([BARTEK])
    expect((await call('get_availability', { from: '2026-11-23', to: '2026-11-27', person_ids: [ANNA] })).json.people[0].state).toBe('full')

    const fromOnly = await call('get_availability', { from: '2026-11-23' })
    expect([fromOnly.json.from, fromOnly.json.to]).toEqual(['2026-11-23', '2026-12-06'])
    const byDefault = await call('get_availability')
    expect(byDefault.json.from).toBe(format(new Date(), 'yyyy-MM-dd'))
  })

  it('list_time_off: overlap, person filter, type label', async () => {
    const { call } = await setup()
    const r = await call('list_time_off', { from: '2026-12-02', to: '2026-12-31' })
    expect(r.json.time_off).toEqual([
      { id: T1, person: { id: BARTEK, full_name: 'Bartek Kowal' }, type: 'vacation', type_label: 'Urlop', start_date: '2026-12-01', end_date: '2026-12-02', notes: null },
    ])
    expect((await call('list_time_off', { from: '2026-12-01', to: '2026-12-31', person_id: ANNA })).json.time_off).toHaveLength(0)
  })

  it('search_experts: passes brief and slugs to the RPC, applies limit', async () => {
    const { call, fake } = await setup()
    const r = await call('search_experts', { description: 'x'.repeat(3000), technologies: ['react'] })
    expect(r.json.total_matches).toBe(12)
    expect(r.json.experts).toHaveLength(10)
    expect(fake.rpcCalls[0]).toEqual({ name: 'search_experts', args: { p_skill_slugs: [], p_tech_slugs: ['react'], p_query: 'x'.repeat(2000) } })
    expect((await call('search_experts', { skills: ['ux-design'], limit: 3 })).json.experts).toHaveLength(3)
    expect((await call('search_experts', {})).isError).toBe(true)
  })

  it('get_person_competencies and list_competencies', async () => {
    const { call } = await setup()
    expect((await call('get_person_competencies', { person_id: ANNA })).json.person.full_name).toBe('Anna Nowak')
    expect((await call('get_person_competencies', { person_id: MISSING })).isError).toBe(true)
    expect((await call('list_competencies')).json.competencies).toHaveLength(2)
    expect((await call('list_competencies', { kind: 'skill' })).json.competencies.map((c: Json) => c.slug)).toEqual(['ux-design'])
    expect((await call('list_competencies', { query: 'rea' })).json.competencies.map((c: Json) => c.slug)).toEqual(['react'])
  })
})

describe('allocation writes', () => {
  it('create_allocation: saves with defaults and returns names', async () => {
    const { call, fake } = await setup()
    const r = await call('create_allocation', { person_id: CELINA, project_id: BETA, start_date: '2026-12-07', end_date: '2026-12-11', hours_per_day: 2, notes: ' ' })
    expect(r.isError).toBe(false)
    expect(r.json).toMatchObject({ result: 'created', warning: null, allocation: { person: { full_name: 'Celina 50%_x' }, project: { name: 'Beta' }, status: 'confirmed', notes: null, workdays: 5 } })
    expect(fake.tables.allocations).toHaveLength(3)
  })

  it('create_allocation: warns when the person becomes overbooked, not for tentative', async () => {
    const { call } = await setup()
    const over = await call('create_allocation', { person_id: ANNA, project_id: BETA, start_date: '2026-11-23', end_date: '2026-11-27', hours_per_day: 4 })
    expect(over.json.warning).toMatch(/przeciążona.*60h.*40h/)
    const tentative = await call('create_allocation', { person_id: ANNA, project_id: BETA, start_date: '2026-11-23', end_date: '2026-11-27', status: 'tentative' })
    expect(tentative.json.warning).toBeNull()
  })

  it('create_allocation: rejects bad input without writing', async () => {
    const { call, fake } = await setup()
    const cases: [Record<string, unknown>, RegExp][] = [
      [{ person_id: ANNA, project_id: BETA, start_date: '2026-12-05', end_date: '2026-12-11' }, new RegExp(WEEKEND_ALLOCATION_ERROR)],
      [{ person_id: ANNA, project_id: BETA, start_date: '2026-12-11', end_date: '2026-12-07' }, /wcześniejsza/],
      [{ person_id: MISSING, project_id: BETA, start_date: '2026-12-07', end_date: '2026-12-11' }, /list_people/],
      [{ person_id: ANNA, project_id: MISSING, start_date: '2026-12-07', end_date: '2026-12-11' }, /list_projects/],
      [{ person_id: ANNA, project_id: BETA, start_date: '2026-12-07', end_date: '2026-12-11', hours_per_day: 0.3 }, /./],
      [{ person_id: ANNA, project_id: BETA, start_date: '2026-12-07', end_date: '2026-12-11', hours_per_day: 25 }, /./],
      [{ person_id: ANNA, project_id: BETA, start_date: '2026-12-07', end_date: '2026-12-11', status: 'maybe' }, /./],
    ]
    for (const [args, message] of cases) {
      const r = await call('create_allocation', args)
      expect(r.isError, JSON.stringify(args)).toBe(true)
      expect(r.text).toMatch(message)
    }
    expect(fake.tables.allocations).toHaveLength(2)
  })

  it('update_allocation: partial change, confirm tentative, validation on merged values', async () => {
    const { call, fake } = await setup()
    const confirmed = await call('update_allocation', { allocation_id: A2, status: 'confirmed', notes: null })
    expect(confirmed.json).toMatchObject({ result: 'updated', allocation: { status: 'confirmed', notes: null, hours_per_day: 4, project: { name: 'Alpha' } } })

    const moved = await call('update_allocation', { allocation_id: A1, start_date: '2026-11-24', project_id: BETA })
    expect(moved.json.allocation).toMatchObject({ start_date: '2026-11-24', end_date: '2026-11-27', project: { name: 'Beta' } })

    expect((await call('update_allocation', { allocation_id: A1, end_date: '2026-11-29' })).text).toBe(WEEKEND_ALLOCATION_ERROR)
    expect((await call('update_allocation', { allocation_id: A1, end_date: '2026-11-20' })).text).toMatch(/wcześniejsza/)
    expect((await call('update_allocation', { allocation_id: A1 })).text).toMatch(/Nie podano/)
    expect((await call('update_allocation', { allocation_id: MISSING, hours_per_day: 2 })).text).toMatch(/Nie ma przydziału/)
    expect((await call('update_allocation', { allocation_id: A1, person_id: MISSING })).text).toMatch(/list_people/)
    expect(fake.tables.allocations.find((a) => a.id === A1)).toMatchObject({ end_date: '2026-11-27', person_id: ANNA })
  })

  it('update/delete_allocation: report RLS-blocked writes instead of success', async () => {
    const { call, fake } = await setup({ writeBlocked: ['allocations'] })
    expect((await call('update_allocation', { allocation_id: A1, hours_per_day: 2 })).text).toMatch(/Brak uprawnień/)
    expect((await call('delete_allocation', { allocation_id: A1 })).text).toMatch(/brak uprawnień/)
    expect(fake.tables.allocations).toHaveLength(2)
  })

  it('delete_allocation: removes and echoes what was deleted', async () => {
    const { call, fake } = await setup()
    const r = await call('delete_allocation', { allocation_id: A1 })
    expect(r.json).toMatchObject({ result: 'deleted', allocation: { id: A1, person: { full_name: 'Anna Nowak' }, project: { name: 'Alpha' } } })
    expect(fake.tables.allocations.map((a) => a.id)).toEqual([A2])
    expect((await call('delete_allocation', { allocation_id: A1 })).isError).toBe(true)
  })
})

describe('project writes', () => {
  it('create_project: defaults and date validation', async () => {
    const { call, fake } = await setup()
    const r = await call('create_project', { name: '  Delta ', description: '' })
    expect(r.json).toMatchObject({ result: 'created', project: { name: 'Delta', description: null, start_date: null, end_date: null, color: PROJECT_COLORS[0] } })
    expect((await call('create_project', { name: 'Eps', start_date: '2027-02-01', end_date: '2027-01-01' })).text).toMatch(/wcześniejsza/)
    expect((await call('create_project', { name: '' })).isError).toBe(true)
    expect((await call('create_project', { name: 'X', color: 'red' })).isError).toBe(true)
    expect(fake.tables.projects).toHaveLength(4)
  })

  it('update_project: partial change, clearing, merged date validation, RLS', async () => {
    const { call } = await setup()
    const r = await call('update_project', { project_id: BETA, description: null, end_date: null })
    expect(r.json.project).toMatchObject({ name: 'Beta', description: null, start_date: '2026-01-01', end_date: null })
    expect((await call('update_project', { project_id: GAMMA, end_date: '2026-12-31' })).text).toMatch(/wcześniejsza/)
    expect((await call('update_project', { project_id: BETA })).text).toMatch(/Nie podano/)
    expect((await call('update_project', { project_id: MISSING, name: 'X' })).text).toMatch(/list_projects/)

    const blocked = await setup({ writeBlocked: ['projects'] })
    expect((await blocked.call('update_project', { project_id: BETA, name: 'X' })).text).toMatch(/Brak uprawnień/)
  })
})

describe('time off writes', () => {
  it('create, update and delete time off', async () => {
    const { call, fake } = await setup()
    const created = await call('create_time_off', { person_id: ANNA, start_date: '2026-12-21', end_date: '2026-12-31' })
    expect(created.json).toMatchObject({ result: 'created', time_off: { type: 'vacation', type_label: 'Urlop', person: { full_name: 'Anna Nowak' } } })
    const id = created.json.time_off.id

    const updated = await call('update_time_off', { time_off_id: id, type: 'sick_leave', end_date: '2026-12-23' })
    expect(updated.json.time_off).toMatchObject({ type: 'sick_leave', type_label: 'L4', start_date: '2026-12-21', end_date: '2026-12-23' })

    expect((await call('update_time_off', { time_off_id: id, end_date: '2026-12-01' })).text).toMatch(/wcześniejsza/)
    expect((await call('create_time_off', { person_id: MISSING, start_date: '2026-12-21', end_date: '2026-12-22' })).text).toMatch(/list_people/)
    expect((await call('create_time_off', { person_id: ANNA, type: 'holiday', start_date: '2026-12-21', end_date: '2026-12-22' })).isError).toBe(true)

    expect((await call('delete_time_off', { time_off_id: id })).json.result).toBe('deleted')
    expect(fake.tables.time_off.map((t) => t.id)).toEqual([T1])
    expect((await call('delete_time_off', { time_off_id: id })).isError).toBe(true)
  })
})
