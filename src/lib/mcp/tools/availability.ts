import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { addDays, eachDayOfInterval, format, parseISO } from 'date-fns'
import { z } from 'zod'
import type { Allocation, TeamMember, TimeOff } from '@/lib/types'
import { calcUtilization, formatAvailability, getAvailabilityWindow } from '@/lib/utils'
import type { McpContext } from '../auth'
import { errorResult, ilikePattern, isoDate, jsonResult, rangeError, uuid } from './helpers'

type AvailabilityState = 'free' | 'busy' | 'full' | 'overloaded' | 'unavailable'

// Availability exactly as the People page shows it: confirmed allocations only
// (tentative ones don't make anyone busy), weekends skipped, time off reduces capacity.
export function personAvailability(
  person: Pick<TeamMember, 'id' | 'full_name' | 'role' | 'capacity_hours_per_day'>,
  allocations: Allocation[],
  timeOff: TimeOff[],
  days: Date[]
) {
  const util = calcUtilization(allocations, days, Number(person.capacity_hours_per_day), timeOff)
  const av = formatAvailability(util)
  const state: AvailabilityState = av.isUnavailable
    ? 'unavailable'
    : av.isOver
      ? 'overloaded'
      : av.isFull
        ? 'full'
        : av.freePct <= 15
          ? 'busy'
          : 'free'

  return {
    person: { id: person.id, full_name: person.full_name, role: person.role },
    state,
    free_hours: av.freeHours,
    allocated_hours: util.allocatedHours,
    capacity_hours: util.capacityHours,
    tentative_hours: tentativeHours(allocations, days, timeOff),
    time_off_workdays: util.ooodays,
    label: av.label,
  }
}

// Hours on not-yet-confirmed work — reported separately, never counted as busy.
function tentativeHours(allocations: Allocation[], days: Date[], timeOff: TimeOff[]): number {
  const tentative = allocations.filter((a) => a.status === 'tentative').map((a) => ({ ...a, status: 'confirmed' as const }))
  return calcUtilization(tentative, days, 1, timeOff).allocatedHours
}

export function registerAvailabilityTools(server: McpServer, ctx: McpContext) {
  server.registerTool(
    'get_availability',
    {
      title: 'Get availability',
      description:
        'Free and booked hours per person in a period, computed exactly like the planner\'s People page: ' +
        'only confirmed allocations count as busy (tentative hours are listed separately in `tentative_hours`), ' +
        'weekends are skipped and time off reduces capacity. Sorted by most free hours first. ' +
        'Use it for "who is free next week", "does X have capacity in March", "who has 20h free". ' +
        'Defaults to the next 14 days.',
      inputSchema: {
        from: isoDate.optional().describe('Start of the period (yyyy-MM-dd); default today.'),
        to: isoDate.optional().describe('End of the period (yyyy-MM-dd); default today + 13 days.'),
        person_ids: z.array(uuid).min(1).max(100).optional().describe('Only these people (ids from list_people).'),
        role: z.string().trim().min(1).max(100).optional().describe('Case-insensitive part of the job title.'),
        min_free_hours: z.number().min(0).optional().describe('Only people with at least this many free hours.'),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ from, to, person_ids, role, min_free_hours }) => {
      // Default: the People page's window (14 days), starting at `from` if given.
      const window = getAvailabilityWindow()
      const start = from ?? format(window[0], 'yyyy-MM-dd')
      const end = to ?? format(addDays(parseISO(start), window.length - 1), 'yyyy-MM-dd')
      const invalid = rangeError(start, end)
      if (invalid) return errorResult(invalid)

      let peopleRequest = ctx.supabase.from('team_members').select('id, full_name, role, capacity_hours_per_day').order('full_name')
      if (person_ids) peopleRequest = peopleRequest.in('id', person_ids)
      if (role) peopleRequest = peopleRequest.ilike('role', ilikePattern(role))
      const people = await peopleRequest
      if (people.error) return errorResult(`Nie udało się pobrać osób: ${people.error.message}`)

      const ids = (people.data ?? []).map((p) => p.id)
      if (ids.length === 0) return jsonResult({ from: start, to: end, people: [] })

      const [allocations, timeOff] = await Promise.all([
        ctx.supabase.from('allocations').select('*').in('person_id', ids).lte('start_date', end).gte('end_date', start),
        ctx.supabase.from('time_off').select('*').in('person_id', ids).lte('start_date', end).gte('end_date', start),
      ])
      // A failed read would show people as freer than they are — fail instead.
      if (allocations.error) return errorResult(`Nie udało się pobrać przydziałów: ${allocations.error.message}`)
      if (timeOff.error) return errorResult(`Nie udało się pobrać nieobecności: ${timeOff.error.message}`)

      const days = eachDayOfInterval({ start: parseISO(start), end: parseISO(end) })
      const allocs = (allocations.data ?? []) as Allocation[]
      const offs = (timeOff.data ?? []) as TimeOff[]

      const result = (people.data ?? [])
        .map((p) => personAvailability(p, allocs.filter((a) => a.person_id === p.id), offs.filter((t) => t.person_id === p.id), days))
        .filter((r) => min_free_hours === undefined || r.free_hours >= min_free_hours)
        .sort((a, b) => b.free_hours - a.free_hours)

      return jsonResult({ from: start, to: end, people: result })
    }
  )
}
