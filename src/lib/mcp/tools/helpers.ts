import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { differenceInCalendarDays, isValid, parseISO } from 'date-fns'
import { z } from 'zod'
import type { McpContext } from '../auth'

// Longest date range a read tool accepts, so one call can't pull the whole history.
export const MAX_RANGE_DAYS = 186

export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use yyyy-MM-dd')
  .refine((v) => isValid(parseISO(v)), 'Not a valid date')

export const uuid = z.string().uuid()

export function jsonResult(data: unknown): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
}

// A tool-level error the model sees and can react to (not a protocol error).
export function errorResult(message: string): CallToolResult {
  return { content: [{ type: 'text', text: message }], isError: true }
}

// Escape LIKE metacharacters so the caller's `%`/`_` are matched literally.
export function ilikePattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, '\\$&')}%`
}

export function rangeError(from: string, to: string, maxDays = MAX_RANGE_DAYS): string | null {
  if (to < from) return 'Data końcowa nie może być wcześniejsza niż początkowa.'
  if (differenceInCalendarDays(parseISO(to), parseISO(from)) + 1 > maxDays) {
    return `Zakres dat może mieć najwyżej ${maxDays} dni.`
  }
  return null
}

export interface PersonRef {
  id: string
  full_name: string
}

// allocations / time_off reference people by team_members.id without a FK
// PostgREST can embed, so names are looked up separately.
export async function peopleById(ctx: McpContext, ids: string[]): Promise<Map<string, PersonRef>> {
  const unique = [...new Set(ids)]
  if (unique.length === 0) return new Map()
  const { data, error } = await ctx.supabase.from('team_members').select('id, full_name').in('id', unique)
  if (error) throw new Error(`Nie udało się pobrać osób: ${error.message}`)
  return new Map((data ?? []).map((p) => [p.id, p]))
}

export function personRef(people: Map<string, PersonRef>, id: string): PersonRef {
  return people.get(id) ?? { id, full_name: '(nieznana osoba)' }
}
