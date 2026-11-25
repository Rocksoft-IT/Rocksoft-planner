import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { TIME_OFF_LABELS, type TimeOff } from '@/lib/types'
import type { McpContext } from '../auth'
import { errorResult, isoDate, jsonResult, peopleById, personRef, rangeError, uuid, type PersonRef } from './helpers'

const TYPES = ['vacation', 'sick_leave', 'other'] as const
const TYPE_HELP = 'vacation = urlop, sick_leave = L4 (zwolnienie lekarskie), other = inna nieobecność.'

function timeOffView(t: TimeOff, people: Map<string, PersonRef>) {
  return {
    id: t.id,
    person: personRef(people, t.person_id),
    type: t.type,
    type_label: TIME_OFF_LABELS[t.type]?.label ?? t.type,
    start_date: t.start_date,
    end_date: t.end_date,
    notes: t.notes,
  }
}

async function respond(ctx: McpContext, row: TimeOff, action: string) {
  const people = await peopleById(ctx, [row.person_id])
  return jsonResult({ result: action, time_off: timeOffView(row, people) })
}

function datesError(start: string, end: string): string | null {
  return end < start ? 'Data końcowa nie może być wcześniejsza niż początkowa.' : null
}

export function registerTimeOffTools(server: McpServer, ctx: McpContext) {
  server.registerTool(
    'list_time_off',
    {
      title: 'List time off',
      description:
        'Lists vacations, sick leave and other absences overlapping [from, to], optionally for one person. ' +
        `Types: ${TYPE_HELP} Use it for "who is on vacation in <period>".`,
      inputSchema: {
        from: isoDate,
        to: isoDate,
        person_id: uuid.optional(),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ from, to, person_id }) => {
      const invalid = rangeError(from, to)
      if (invalid) return errorResult(invalid)

      let request = ctx.supabase.from('time_off').select('*').lte('start_date', to).gte('end_date', from)
      if (person_id) request = request.eq('person_id', person_id)
      const { data, error } = await request.order('start_date')
      if (error) return errorResult(`Nie udało się pobrać nieobecności: ${error.message}`)

      const rows = (data ?? []) as TimeOff[]
      const people = await peopleById(ctx, rows.map((r) => r.person_id))
      return jsonResult({ time_off: rows.map((r) => timeOffView(r, people)) })
    }
  )

  server.registerTool(
    'create_time_off',
    {
      title: 'Create time off',
      description:
        `Records a vacation, sick leave or other absence for a person (inclusive dates). ${TYPE_HELP} ` +
        'Look up person_id with list_people first; for "me" use whoami and find that person by email.',
      inputSchema: {
        person_id: uuid,
        type: z.enum(TYPES).default('vacation'),
        start_date: isoDate,
        end_date: isoDate,
        notes: z.string().trim().max(1000).optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (input) => {
      const invalid = datesError(input.start_date, input.end_date)
      if (invalid) return errorResult(invalid)

      const person = await ctx.supabase.from('team_members').select('id').eq('id', input.person_id).maybeSingle()
      if (person.error) return errorResult(`Nie udało się sprawdzić osoby: ${person.error.message}`)
      if (!person.data) return errorResult('Nie ma osoby o takim id. Sprawdź id przez list_people.')

      const { data, error } = await ctx.supabase
        .from('time_off')
        .insert({ ...input, notes: input.notes || null })
        .select('*')
        .single()
      if (error) return errorResult(`Nie udało się zapisać nieobecności: ${error.message}`)
      return respond(ctx, data as TimeOff, 'created')
    }
  )

  server.registerTool(
    'update_time_off',
    {
      title: 'Update time off',
      description: 'Changes the dates, type or notes of an existing absence. Pass only the fields to change.',
      inputSchema: {
        time_off_id: uuid,
        type: z.enum(TYPES).optional(),
        start_date: isoDate.optional(),
        end_date: isoDate.optional(),
        notes: z.string().trim().max(1000).nullable().optional().describe('null or "" clears the notes.'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ time_off_id, ...changes }) => {
      const patch = Object.fromEntries(Object.entries(changes).filter(([, v]) => v !== undefined))
      if ('notes' in patch) patch.notes = patch.notes || null
      if (Object.keys(patch).length === 0) return errorResult('Nie podano żadnych zmian.')

      const { data: current, error: readError } = await ctx.supabase.from('time_off').select('*').eq('id', time_off_id).maybeSingle()
      if (readError) return errorResult(`Nie udało się pobrać nieobecności: ${readError.message}`)
      if (!current) return errorResult('Nie ma nieobecności o takim id.')

      const merged = { ...current, ...patch }
      const invalid = datesError(merged.start_date, merged.end_date)
      if (invalid) return errorResult(invalid)

      const { data, error } = await ctx.supabase.from('time_off').update(patch).eq('id', time_off_id).select('*')
      if (error) return errorResult(`Nie udało się zapisać nieobecności: ${error.message}`)
      if (!data?.length) return errorResult('Brak uprawnień do zmiany tej nieobecności.')
      return respond(ctx, data[0] as TimeOff, 'updated')
    }
  )

  server.registerTool(
    'delete_time_off',
    {
      title: 'Delete time off',
      description: 'Permanently removes an absence. Confirm with the user which one (person, type, dates) before calling.',
      inputSchema: { time_off_id: uuid },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async ({ time_off_id }) => {
      const { data, error } = await ctx.supabase.from('time_off').delete().eq('id', time_off_id).select('*')
      if (error) return errorResult(`Nie udało się usunąć nieobecności: ${error.message}`)
      if (!data?.length) return errorResult('Nie ma nieobecności o takim id albo brak uprawnień do jej usunięcia.')
      return respond(ctx, data[0] as TimeOff, 'deleted')
    }
  )
}
