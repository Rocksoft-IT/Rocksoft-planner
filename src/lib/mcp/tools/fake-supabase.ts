// Test-only in-memory stand-in for the Supabase query builder: just the
// PostgREST subset the MCP tools use, so every tool can run end to end in tests.
import type { SupabaseClient } from '@supabase/supabase-js'

type Row = Record<string, unknown>
type Filter = (row: Row) => boolean

export interface FakeOptions {
  tables: Record<string, Row[]>
  rpc?: Record<string, (args: Record<string, unknown>) => unknown>
  // Tables whose update/delete RLS lets nothing through (0 rows, no error).
  writeBlocked?: string[]
}

export interface FakeSupabase {
  client: SupabaseClient
  tables: Record<string, Row[]>
  rpcCalls: { name: string; args: Record<string, unknown> }[]
}

function likeToRegExp(pattern: string): RegExp {
  let out = ''
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i]
    if (c === '\\') out += escapeRe(pattern[++i] ?? '')
    else if (c === '%') out += '.*'
    else if (c === '_') out += '.'
    else out += escapeRe(c)
  }
  return new RegExp(`^${out}$`, 'is')
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Split `a.eq.1,b.ilike."x,y"` on top-level commas, honouring quotes.
function splitOr(expr: string): string[] {
  const parts: string[] = []
  let current = ''
  let quoted = false
  for (let i = 0; i < expr.length; i++) {
    const c = expr[i]
    if (c === '\\' && quoted) {
      current += c + (expr[++i] ?? '')
      continue
    }
    if (c === '"') quoted = !quoted
    if (c === ',' && !quoted) {
      parts.push(current)
      current = ''
    } else current += c
  }
  parts.push(current)
  return parts
}

function topLevel(spec: string): string[] {
  const parts: string[] = []
  let depth = 0
  let current = ''
  for (const c of spec) {
    if (c === '(') depth++
    if (c === ')') depth--
    if (c === ',' && depth === 0) {
      parts.push(current.trim())
      current = ''
    } else current += c
  }
  parts.push(current.trim())
  return parts.filter(Boolean)
}

function unquote(value: string): string {
  if (!value.startsWith('"')) return value
  return value.slice(1, -1).replace(/\\(.)/g, '$1')
}

function orCondition(part: string): Filter {
  const [column, op, ...rest] = part.split('.')
  const value = unquote(rest.join('.'))
  switch (op) {
    case 'is':
      return (r) => (value === 'null' ? r[column] == null : String(r[column]) === value)
    case 'lte':
      return (r) => r[column] != null && String(r[column]) <= value
    case 'gte':
      return (r) => r[column] != null && String(r[column]) >= value
    case 'eq':
      return (r) => String(r[column]) === value
    case 'ilike':
      return (r) => likeToRegExp(value).test(String(r[column] ?? ''))
    default:
      throw new Error(`fake-supabase: unsupported or() operator ${op}`)
  }
}

let nextId = 1
function newId(): string {
  return `00000000-0000-4000-8000-${String(nextId++).padStart(12, '0')}`
}

export function createFakeSupabase(options: FakeOptions): FakeSupabase {
  const tables = options.tables
  const rpcCalls: FakeSupabase['rpcCalls'] = []

  function from(table: string) {
    const rows = (tables[table] ??= [])
    const filters: Filter[] = []
    const orders: string[] = []
    let op: 'select' | 'insert' | 'update' | 'delete' = 'select'
    let payload: Row = {}
    let selectSpec: string | null = null
    let max: number | null = null
    let mode: 'many' | 'single' | 'maybeSingle' = 'many'

    // Applies the select list like PostgREST: plain top-level columns are
    // projected, `*` keeps everything; embeds other than project are ignored.
    function withEmbeds(row: Row): Row {
      const columns = topLevel(selectSpec ?? '*').filter((c) => !c.includes('('))
      const out = columns.includes('*') ? { ...row } : Object.fromEntries(columns.map((c) => [c, row[c]]))
      if (selectSpec?.includes('project:projects')) {
        const p = tables.projects?.find((x) => x.id === row.project_id)
        out.project = p ? { id: p.id, name: p.name } : null
      }
      return out
    }

    function run(): { data: unknown; error: { message: string } | null } {
      const matching = rows.filter((r) => filters.every((f) => f(r)))
      let result: Row[]

      if (op === 'insert') {
        const row = { id: newId(), ...payload }
        rows.push(row)
        result = [row]
      } else if (op === 'update') {
        result = options.writeBlocked?.includes(table) ? [] : matching
        for (const r of result) Object.assign(r, payload)
      } else if (op === 'delete') {
        result = options.writeBlocked?.includes(table) ? [] : matching
        for (const r of result) rows.splice(rows.indexOf(r), 1)
      } else {
        result = [...matching]
        for (const col of [...orders].reverse()) {
          result.sort((a, b) => String(a[col] ?? '').localeCompare(String(b[col] ?? '')))
        }
        if (max !== null) result = result.slice(0, max)
      }

      if (op !== 'select' && selectSpec === null) return { data: null, error: null }
      const data = result.map(withEmbeds)
      if (mode === 'single') {
        return data.length === 1 ? { data: data[0], error: null } : { data: null, error: { message: 'JSON object requested, multiple (or no) rows returned' } }
      }
      if (mode === 'maybeSingle') return { data: data[0] ?? null, error: null }
      return { data, error: null }
    }

    const builder = {
      select(spec = '*') {
        selectSpec = spec
        return builder
      },
      insert(row: Row) {
        op = 'insert'
        payload = row
        return builder
      },
      update(patch: Row) {
        op = 'update'
        payload = patch
        return builder
      },
      delete() {
        op = 'delete'
        return builder
      },
      eq(column: string, value: unknown) {
        filters.push((r) => r[column] === value)
        return builder
      },
      in(column: string, values: unknown[]) {
        filters.push((r) => values.includes(r[column]))
        return builder
      },
      lte(column: string, value: string) {
        filters.push((r) => r[column] != null && String(r[column]) <= value)
        return builder
      },
      gte(column: string, value: string) {
        filters.push((r) => r[column] != null && String(r[column]) >= value)
        return builder
      },
      is(column: string, value: null) {
        filters.push((r) => r[column] == value)
        return builder
      },
      ilike(column: string, pattern: string) {
        const re = likeToRegExp(pattern)
        filters.push((r) => re.test(String(r[column] ?? '')))
        return builder
      },
      or(expr: string) {
        const conditions = splitOr(expr).map(orCondition)
        filters.push((r) => conditions.some((c) => c(r)))
        return builder
      },
      order(column: string) {
        orders.push(column)
        return builder
      },
      limit(n: number) {
        max = n
        return builder
      },
      single() {
        mode = 'single'
        return builder
      },
      maybeSingle() {
        mode = 'maybeSingle'
        return builder
      },
      then<T>(resolve: (value: ReturnType<typeof run>) => T, reject?: (reason: unknown) => T) {
        try {
          return Promise.resolve(resolve(run()))
        } catch (e) {
          return reject ? Promise.resolve(reject(e)) : Promise.reject(e)
        }
      },
    }
    return builder
  }

  async function rpc(name: string, args: Record<string, unknown>) {
    rpcCalls.push({ name, args })
    const fn = options.rpc?.[name]
    if (!fn) return { data: null, error: { message: `function ${name} not found` } }
    return { data: fn(args), error: null }
  }

  return { client: { from, rpc } as unknown as SupabaseClient, tables, rpcCalls }
}
