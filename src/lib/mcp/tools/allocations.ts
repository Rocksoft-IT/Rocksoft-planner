import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { eachDayOfInterval, parseISO } from 'date-fns'
import { z } from 'zod'
import type { Allocation, TimeOff } from '@/lib/types'
import { calcUtilization, countWorkdays, validateAllocationDates } from '@/lib/utils'
import type { McpContext } from '../auth'
import { errorResult, isoDate, jsonResult, peopleById, personRef, rangeError, uuid, type PersonRef } from './helpers'

const STATUSES = ['confirmed', 'tentative'] as const
const DEFAULT_LIMIT = 200
const MAX_LIMIT = 500

const hoursPerDay = z
  .number()
  .min(0.5)
  .max(24)
  .multipleOf(0.5)
  .describe('Hours per working day, 0.5–24 in 0.5 steps.')

type AllocationRow = Allocation & { project?: { id: string; name: string } | null }

export function allocationView(a: AllocationRow, people: Map<string, PersonRef>) {
  return {
    project: a.project ? { id: a.project.id, name: a.project.name } : { id: a.project_id },
    ...allocationFields(a, people),
  }
}

// Without the project — for listings that are already per project.
export function allocationFields(a: Allocation, people: Map<string, PersonRef>) {
  return {
    id: a.id,
    person: personRef(people, a.person_id),
    start_date: a.start_date,
    end_date: a.end_date,
    hours_per_day: Number(a.hours_per_day),
    status: a.status,
    notes: a.notes,
    workdays: countWorkdays(a.start_date, a.end_date),
  }
}

// Mirrors the AllocationModal checks; the database enforces end >= start too.
export function allocationError(a: { start_date: string; end_date: string }): string | null {
  if (a.end_date < a.start_date) return 'Data końcowa nie może być wcześniejsza niż początkowa.'
  return validateAllocationDates(a.start_date, a.end_date)
}

// Same rule as the Timeline/People pages (calcUtilization): confirmed work only,
// weekends and time off excluded. Returns a warning when the person is overbooked.
async function overloadWarning(ctx: McpContext, personId: string, from: string, to: string): Promise<string | null> {
  const [person, allocations, timeOff] = await Promise.all([
    ctx.supabase.from('team_members').select('capacity_hours_per_day').eq('id', personId).maybeSingle(),
    ctx.supabase.from('allocations').select('*').eq('person_id', personId).lte('start_date', to).gte('end_date', from),
    ctx.supabase.from('time_off').select('*').eq('person_id', personId).lte('start_date', to).gte('end_date', from),
  ])
  if (person.error || allocations.error || timeOff.error || !person.data) return null

  const days = eachDayOfInterval({ start: parseISO(from), end: parseISO(to) })
  const util = calcUtilization(
    (allocations.data ?? []) as Allocation[],
    days,
    Number(person.data.capacity_hours_per_day),
    (timeOff.data ?? []) as TimeOff[]
  )
  if (util.allocatedHours <= util.capacityHours) return null
  return `Uwaga: osoba jest przeciążona w okresie ${from} – ${to}: ${util.allocatedHours}h potwierdzonej pracy przy ${util.capacityHours}h dostępnych.`
}

async function checkRefs(ctx: McpContext, personId?: string, projectId?: string): Promise<string | null> {
  if (personId) {
    const { data, error } = await ctx.supabase.from('team_members').select('id').eq('id', personId).maybeSingle()
    if (error) return `Nie udało się sprawdzić osoby: ${error.message}`
    if (!data) return 'Nie ma osoby o takim id. Sprawdź id przez list_people.'
  }
  if (projectId) {
    const { data, error } = await ctx.supabase.from('projects').select('id').eq('id', projectId).maybeSingle()
    if (error) return `Nie udało się sprawdzić projektu: ${error.message}`
    if (!data) return 'Nie ma projektu o takim id. Sprawdź id przez list_projects.'
  }
  return null
}

async function respondWithAllocation(ctx: McpContext, row: AllocationRow, action: string) {
  const people = await peopleById(ctx, [row.person_id])
  const warning = row.status === 'confirmed' ? await overloadWarning(ctx, row.person_id, row.start_date, row.end_date) : null
  return jsonResult({ result: action, allocation: allocationView(row, people), warning })
}

const SELECT = '*, project:projects(id, name)'

export function registerAllocationTools(server: McpServer, ctx: McpContext) {
  server.registerTool(
    'list_allocations',
    {
      title: 'List allocations',
      description:
        'Lists allocations — a person assigned to a project for a date range at N hours per working day — that overlap ' +
        '[from, to]. Filter by person_id, project_id or status (confirmed = agreed with the client, tentative = not yet). ' +
        'Use it for "what is X working on" or "who is on project Y in <period>". For free capacity use get_availability. ' +
        'Weekends inside a range book no hours; `workdays` is the number of Mon–Fri days.',
      inputSchema: {
        from: isoDate.describe('Start of the period (yyyy-MM-dd).'),
        to: isoDate.describe('End of the period (yyyy-MM-dd), at most ~6 months after `from`.'),
        person_id: uuid.optional(),
        project_id: uuid.optional(),
        status: z.enum(STATUSES).optional(),
        limit: z.number().int().min(1).max(MAX_LIMIT).optional().describe(`Default ${DEFAULT_LIMIT}.`),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ from, to, person_id, project_id, status, limit }) => {
      const invalid = rangeError(from, to)
      if (invalid) return errorResult(invalid)
      const max = limit ?? DEFAULT_LIMIT

      let request = ctx.supabase.from('allocations').select(SELECT).lte('start_date', to).gte('end_date', from)
      if (person_id) request = request.eq('person_id', person_id)
      if (project_id) request = request.eq('project_id', project_id)
      if (status) request = request.eq('status', status)

      const { data, error } = await request.order('start_date').limit(max + 1)
      if (error) return errorResult(`Nie udało się pobrać przydziałów: ${error.message}`)

      const rows = (data ?? []) as AllocationRow[]
      const people = await peopleById(ctx, rows.map((r) => r.person_id))
      return jsonResult({ allocations: rows.slice(0, max).map((r) => allocationView(r, people)), truncated: rows.length > max })
    }
  )

  server.registerTool(
    'create_allocation',
    {
      title: 'Create allocation',
      description:
        'Assigns a person to a project for a date range (inclusive) at N hours per working day. ' +
        'Start and end must be working days (Mon–Fri); weekends inside the range book nothing. ' +
        'Use status "tentative" when the work is not yet confirmed by the client. ' +
        'Look up person_id with list_people and project_id with list_projects first. ' +
        'Returns a `warning` when the person becomes overbooked — tell the user about it.',
      inputSchema: {
        person_id: uuid,
        project_id: uuid,
        start_date: isoDate,
        end_date: isoDate,
        hours_per_day: hoursPerDay.default(8),
        status: z.enum(STATUSES).default('confirmed'),
        notes: z.string().trim().max(1000).optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (input) => {
      const invalid = allocationError(input) ?? (await checkRefs(ctx, input.person_id, input.project_id))
      if (invalid) return errorResult(invalid)

      const { data, error } = await ctx.supabase
        .from('allocations')
        .insert({ ...input, notes: input.notes || null })
        .select(SELECT)
        .single()
      if (error) return errorResult(`Nie udało się zapisać przydziału: ${error.message}`)
      return respondWithAllocation(ctx, data as AllocationRow, 'created')
    }
  )

  server.registerTool(
    'update_allocation',
    {
      title: 'Update allocation',
      description:
        'Changes an existing allocation: move dates, change hours per day, switch project or person, confirm a tentative ' +
        'allocation (status "confirmed") or edit notes. Pass only the fields to change; the same rules as ' +
        'create_allocation apply to the result. Get the allocation id from list_allocations or get_project.',
      inputSchema: {
        allocation_id: uuid,
        person_id: uuid.optional(),
        project_id: uuid.optional(),
        start_date: isoDate.optional(),
        end_date: isoDate.optional(),
        hours_per_day: hoursPerDay.optional(),
        status: z.enum(STATUSES).optional(),
        notes: z.string().trim().max(1000).nullable().optional().describe('null or "" clears the notes.'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ allocation_id, ...changes }) => {
      const { data: current, error: readError } = await ctx.supabase.from('allocations').select('*').eq('id', allocation_id).maybeSingle()
      if (readError) return errorResult(`Nie udało się pobrać przydziału: ${readError.message}`)
      if (!current) return errorResult('Nie ma przydziału o takim id.')

      const patch = Object.fromEntries(Object.entries(changes).filter(([, v]) => v !== undefined))
      if ('notes' in patch) patch.notes = patch.notes || null
      if (Object.keys(patch).length === 0) return errorResult('Nie podano żadnych zmian.')

      const merged = { ...current, ...patch }
      const invalid = allocationError(merged) ?? (await checkRefs(ctx, changes.person_id, changes.project_id))
      if (invalid) return errorResult(invalid)

      const { data, error } = await ctx.supabase.from('allocations').update(patch).eq('id', allocation_id).select(SELECT)
      if (error) return errorResult(`Nie udało się zapisać przydziału: ${error.message}`)
      if (!data?.length) return errorResult('Brak uprawnień do zmiany tego przydziału.')
      return respondWithAllocation(ctx, data[0] as AllocationRow, 'updated')
    }
  )

  server.registerTool(
    'delete_allocation',
    {
      title: 'Delete allocation',
      description:
        'Permanently removes an allocation. Confirm with the user which allocation (person, project, dates) before calling. ' +
        'To only shorten or move it, use update_allocation instead.',
      inputSchema: { allocation_id: uuid },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ allocation_id }) => {
      const { data, error } = await ctx.supabase.from('allocations').delete().eq('id', allocation_id).select(SELECT)
      if (error) return errorResult(`Nie udało się usunąć przydziału: ${error.message}`)
      if (!data?.length) return errorResult('Nie ma przydziału o takim id albo brak uprawnień do jego usunięcia.')
      const row = data[0] as AllocationRow
      const people = await peopleById(ctx, [row.person_id])
      return jsonResult({ result: 'deleted', allocation: allocationView(row, people) })
    }
  )
}
